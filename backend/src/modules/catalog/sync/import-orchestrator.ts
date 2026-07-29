import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ProviderCatalogClient,
  ProviderServicePayload,
} from '../infrastructure/provider-catalog-client';
import { PROVIDER_CATALOG_CLIENT } from '../infrastructure/provider-catalog-client';
import {
  ProviderServiceBatchItem,
  ProviderServiceRepository,
} from '../infrastructure/provider-service.repository';
import {
  PendingStagedServiceBatchItem,
  StagedServiceBatchItem,
  StagedServiceRepository,
} from '../infrastructure/staged-service.repository';
import { BULKFOLLOWS_PROVIDER_ORIGIN } from '../infrastructure/bulkfollows.client';

export interface ImportOrchestratorSummary {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: number;
  errorSummary: string[];
}

type ImportOperation = 'imported' | 'updated';

type PreparedPayload = {
  payload: ProviderServicePayload;
  rawPayload: Prisma.InputJsonValue;
};

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(
      (item) => item !== undefined && isJsonValue(item),
    );
  }

  return false;
}

@Injectable()
export class ImportOrchestrator {
  private readonly logger = new Logger(ImportOrchestrator.name);

  constructor(
    @Inject(PROVIDER_CATALOG_CLIENT)
    private readonly providerClient: ProviderCatalogClient,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly stagedServiceRepository: StagedServiceRepository,
  ) {}

  async run(): Promise<ImportOrchestratorSummary> {
    const totalStartedAt = Date.now();

    if (!this.providerClient.fetchServices) {
      throw new Error(
        'Configured provider client does not implement fetchServices',
      );
    }

    const fetchStartedAt = Date.now();
    const payloads = await this.providerClient.fetchServices();

    this.logDuration(
      'Fetch provider services',
      fetchStartedAt,
      payloads.length,
    );

    const summary: ImportOrchestratorSummary = {
      total: payloads.length,
      imported: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    };

    const preparationStartedAt = Date.now();
    const preparedPayloads = this.preparePayloads(payloads, summary);

    this.logDuration(
      'Prepare provider payloads',
      preparationStartedAt,
      preparedPayloads.length,
    );

    if (preparedPayloads.length === 0) {
      this.logDuration('Total import', totalStartedAt, summary.total);
      return summary;
    }

    const externalIds = preparedPayloads.map(
      ({ payload }) => payload.externalId,
    );

    const lookupStartedAt = Date.now();

    const existingProviderServices =
      await this.providerServiceRepository.findManyByOriginAndExternalIds(
        BULKFOLLOWS_PROVIDER_ORIGIN,
        externalIds,
      );

    this.logDuration(
      'Lookup existing ProviderService records',
      lookupStartedAt,
      existingProviderServices.length,
    );

    const existingExternalIds = new Set(
      existingProviderServices.map((service) => service.externalId),
    );

    const operationByExternalId = new Map<string, ImportOperation>();

    const newProviderItems: ProviderServiceBatchItem[] = [];
    const existingProviderItems: ProviderServiceBatchItem[] = [];

    for (const prepared of preparedPayloads) {
      const item: ProviderServiceBatchItem = {
        providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId: prepared.payload.externalId,
        rawPayload: prepared.rawPayload,
      };

      if (existingExternalIds.has(prepared.payload.externalId)) {
        existingProviderItems.push(item);
        operationByExternalId.set(prepared.payload.externalId, 'updated');
      } else {
        newProviderItems.push(item);
        operationByExternalId.set(prepared.payload.externalId, 'imported');
      }
    }

    const successfulExternalIds = new Set<string>();
    const providerWritesStartedAt = Date.now();

    if (newProviderItems.length > 0) {
      try {
        await this.providerServiceRepository.createMany(newProviderItems);

        for (const item of newProviderItems) {
          successfulExternalIds.add(item.externalId);
        }
      } catch {
        for (const item of newProviderItems) {
          this.registerFailure(
            summary,
            item.externalId,
            'PROVIDER_SERVICE_CREATE_FAILED',
          );
        }
      }
    }

    if (existingProviderItems.length > 0) {
      try {
        await this.providerServiceRepository.updateMany(existingProviderItems);

        for (const item of existingProviderItems) {
          successfulExternalIds.add(item.externalId);
        }
      } catch {
        for (const item of existingProviderItems) {
          this.registerFailure(
            summary,
            item.externalId,
            'PROVIDER_SERVICE_UPDATE_FAILED',
          );
        }
      }
    }

    this.logDuration(
      'ProviderService writes',
      providerWritesStartedAt,
      newProviderItems.length + existingProviderItems.length,
    );

    if (successfulExternalIds.size === 0) {
      this.logDuration('Total import', totalStartedAt, summary.total);
      return summary;
    }

    const refetchStartedAt = Date.now();

    const persistedProviderServices =
      await this.providerServiceRepository.findManyByOriginAndExternalIds(
        BULKFOLLOWS_PROVIDER_ORIGIN,
        [...successfulExternalIds],
      );

    this.logDuration(
      'Reload persisted ProviderService records',
      refetchStartedAt,
      persistedProviderServices.length,
    );

    const providerServiceByExternalId = new Map(
      persistedProviderServices.map((service) => [service.externalId, service]),
    );

    const preparedPayloadByExternalId = new Map(
      preparedPayloads.map((prepared) => [
        prepared.payload.externalId,
        prepared.payload,
      ]),
    );

    for (const externalId of successfulExternalIds) {
      if (!providerServiceByExternalId.has(externalId)) {
        this.registerFailure(
          summary,
          externalId,
          'PROVIDER_SERVICE_NOT_FOUND_AFTER_WRITE',
        );
      }
    }

    const providerServicesToStage = persistedProviderServices.filter(
      (service) => successfulExternalIds.has(service.externalId),
    );

    if (providerServicesToStage.length === 0) {
      this.logDuration('Total import', totalStartedAt, summary.total);
      return summary;
    }

    const stagedLookupStartedAt = Date.now();

    const pendingStagedServices =
      await this.stagedServiceRepository.findPendingByProviderServiceIds(
        providerServicesToStage.map((service) => service.id),
      );

    this.logDuration(
      'Lookup pending StagedService records',
      stagedLookupStartedAt,
      pendingStagedServices.length,
    );

    const pendingByProviderServiceId = new Map(
      pendingStagedServices.map((stagedService) => [
        stagedService.providerServiceId,
        stagedService,
      ]),
    );

    const stagedItemsToCreate: StagedServiceBatchItem[] = [];
    const stagedItemsToUpdate: PendingStagedServiceBatchItem[] = [];

    const externalIdByProviderServiceId = new Map<string, string>();

    for (const providerService of providerServicesToStage) {
      const payload = preparedPayloadByExternalId.get(
        providerService.externalId,
      );

      if (!payload) {
        this.registerFailure(
          summary,
          providerService.externalId,
          'PAYLOAD_NOT_FOUND',
        );
        continue;
      }

      externalIdByProviderServiceId.set(
        providerService.id,
        providerService.externalId,
      );

      const stagedData: StagedServiceBatchItem = {
        providerServiceId: providerService.id,
        title: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        socialNetwork: payload.socialNetwork,
      };

      const existingPending = pendingByProviderServiceId.get(
        providerService.id,
      );

      if (existingPending) {
        stagedItemsToUpdate.push({
          id: existingPending.id,
          ...stagedData,
        });
      } else {
        stagedItemsToCreate.push(stagedData);
      }
    }

    const stagedWritesStartedAt = Date.now();

    if (stagedItemsToCreate.length > 0) {
      try {
        await this.stagedServiceRepository.createManyPending(
          stagedItemsToCreate,
        );

        for (const item of stagedItemsToCreate) {
          const externalId = externalIdByProviderServiceId.get(
            item.providerServiceId,
          );

          if (externalId) {
            this.registerSuccess(summary, externalId, operationByExternalId);
          }
        }
      } catch {
        for (const item of stagedItemsToCreate) {
          const externalId = externalIdByProviderServiceId.get(
            item.providerServiceId,
          );

          if (externalId) {
            this.registerFailure(
              summary,
              externalId,
              'STAGED_SERVICE_CREATE_FAILED',
            );
          }
        }
      }
    }

    if (stagedItemsToUpdate.length > 0) {
      try {
        await this.stagedServiceRepository.updateManyPending(
          stagedItemsToUpdate,
        );

        for (const item of stagedItemsToUpdate) {
          const externalId = externalIdByProviderServiceId.get(
            item.providerServiceId,
          );

          if (externalId) {
            this.registerSuccess(summary, externalId, operationByExternalId);
          }
        }
      } catch {
        for (const item of stagedItemsToUpdate) {
          const externalId = externalIdByProviderServiceId.get(
            item.providerServiceId,
          );

          if (externalId) {
            this.registerFailure(
              summary,
              externalId,
              'STAGED_SERVICE_UPDATE_FAILED',
            );
          }
        }
      }
    }

    this.logDuration(
      'StagedService writes',
      stagedWritesStartedAt,
      stagedItemsToCreate.length + stagedItemsToUpdate.length,
    );

    this.logDuration('Total import', totalStartedAt, summary.total);

    return summary;
  }

  private preparePayloads(
    payloads: ProviderServicePayload[],
    summary: ImportOrchestratorSummary,
  ): PreparedPayload[] {
    const prepared: PreparedPayload[] = [];
    const seenExternalIds = new Set<string>();

    for (const payload of payloads) {
      if (!payload.externalId) {
        this.registerFailure(summary, 'unknown', 'INVALID_EXTERNAL_ID');
        continue;
      }

      if (seenExternalIds.has(payload.externalId)) {
        summary.skipped += 1;
        continue;
      }

      seenExternalIds.add(payload.externalId);

      if (!isJsonValue(payload.rawPayload)) {
        this.registerFailure(
          summary,
          payload.externalId,
          'INVALID_RAW_PAYLOAD',
        );
        continue;
      }

      prepared.push({
        payload,
        rawPayload: payload.rawPayload,
      });
    }

    return prepared;
  }

  private registerSuccess(
    summary: ImportOrchestratorSummary,
    externalId: string,
    operationByExternalId: Map<string, ImportOperation>,
  ): void {
    const operation = operationByExternalId.get(externalId);

    if (operation === 'imported') {
      summary.imported += 1;
      return;
    }

    if (operation === 'updated') {
      summary.updated += 1;
      return;
    }

    this.registerFailure(summary, externalId, 'IMPORT_OPERATION_NOT_FOUND');
  }

  private registerFailure(
    summary: ImportOrchestratorSummary,
    externalId: string,
    code: string,
  ): void {
    const error = `${externalId}:${code}`;

    if (summary.errorSummary.includes(error)) {
      return;
    }

    summary.failed += 1;
    summary.errors += 1;
    summary.errorSummary.push(error);
  }

  private logDuration(
    operation: string,
    startedAt: number,
    itemCount: number,
  ): void {
    const durationMs = Date.now() - startedAt;

    this.logger.log(`${operation}: ${durationMs} ms (${itemCount} items)`);
  }
}
