import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ProviderCatalogClient,
  ProviderServicePayload,
} from '../infrastructure/provider-catalog-client';
import { PROVIDER_CATALOG_CLIENT } from '../infrastructure/provider-catalog-client';
import { ProviderServiceRepository } from '../infrastructure/provider-service.repository';
import { StagedServiceRepository } from '../infrastructure/staged-service.repository';
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

type ItemFailureCode =
  | 'INVALID_RAW_PAYLOAD'
  | 'PROVIDER_SERVICE_LOOKUP_FAILED'
  | 'PROVIDER_SERVICE_UPSERT_FAILED'
  | 'STAGED_SERVICE_UPSERT_FAILED';

class ItemImportError extends Error {
  constructor(
    readonly externalId: string,
    readonly code: ItemFailureCode,
  ) {
    super(`Item import failed for externalId "${externalId}": ${code}`);
  }
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === undefined) return false;
  const type = typeof value;
  return (
    value === null ||
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'object'
  );
}

/**
 * Orchestrates provider import flow for the single configured provider
 * (BulkFollows): fetch provider services, upsert each `ProviderService`
 * record, and create/update corresponding pending `StagedService` entries.
 *
 * Provider-level failures (fetchServices) propagate unchanged. Item-level
 * failures are aggregated into deterministic summary fields, allowing the
 * caller to persist partial/failure SyncJob outcomes without false success.
 */
@Injectable()
export class ImportOrchestrator {
  constructor(
    @Inject(PROVIDER_CATALOG_CLIENT)
    private readonly providerClient: ProviderCatalogClient,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly stagedServiceRepository: StagedServiceRepository,
  ) {}

  async run(): Promise<ImportOrchestratorSummary> {
    if (!this.providerClient.fetchServices) {
      throw new Error(
        'Configured provider client does not implement fetchServices',
      );
    }

    const payloads = await this.providerClient.fetchServices();

    const summary: ImportOrchestratorSummary = {
      total: payloads.length,
      imported: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    };

    for (const payload of payloads) {
      try {
        await this.importOne(payload, summary);
      } catch (error) {
        summary.failed += 1;
        summary.errors += 1;
        summary.errorSummary.push(
          this.toDeterministicItemFailureSummary(payload, error),
        );
      }
    }

    return summary;
  }

  private async importOne(
    payload: ProviderServicePayload,
    summary: ImportOrchestratorSummary,
  ): Promise<void> {
    const externalId = payload.externalId;
    const rawPayload: unknown = payload.rawPayload;
    if (!isJsonValue(rawPayload)) {
      throw new ItemImportError(externalId, 'INVALID_RAW_PAYLOAD');
    }

    let existing: { id: string } | null;
    try {
      existing = await this.providerServiceRepository.findByOriginAndExternalId(
        BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId,
      );
    } catch {
      throw new ItemImportError(externalId, 'PROVIDER_SERVICE_LOOKUP_FAILED');
    }

    let providerService: { id: string };
    try {
      providerService =
        await this.providerServiceRepository.upsertByOriginAndExternalId({
          providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
          externalId,
          rawPayload,
        });
    } catch {
      throw new ItemImportError(externalId, 'PROVIDER_SERVICE_UPSERT_FAILED');
    }

    try {
      await this.stagedServiceRepository.upsertPendingFromProvider(
        providerService.id,
        {
          title: payload.title,
          description: payload.description,
          categoryId: payload.categoryId,
          socialNetwork: payload.socialNetwork,
        },
      );
    } catch {
      throw new ItemImportError(externalId, 'STAGED_SERVICE_UPSERT_FAILED');
    }

    if (existing) {
      summary.updated += 1;
    } else {
      summary.imported += 1;
    }
  }

  private toDeterministicItemFailureSummary(
    payload: ProviderServicePayload,
    error: unknown,
  ): string {
    const externalId = payload.externalId;
    if (error instanceof ItemImportError) {
      return `${externalId}:${error.code}`;
    }

    return `${externalId}:UNKNOWN_ITEM_FAILURE`;
  }
}
