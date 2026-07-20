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
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  [key: string]: number;
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
 * Orchestrates the normal-path provider import flow for the single
 * configured provider (BulkFollows): fetch provider services, upsert each
 * `ProviderService` record, and create the corresponding pending
 * `StagedService` entry. Only the successful/straightforward flow is
 * implemented here; partial-failure aggregation belongs to T021. Any
 * provider-client or repository failure propagates unchanged so the caller
 * (`SyncService`) can record an accurate `SyncJob` failure.
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
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const payload of payloads) {
      await this.importOne(payload, summary);
    }

    return summary;
  }

  private async importOne(
    payload: ProviderServicePayload,
    summary: ImportOrchestratorSummary,
  ): Promise<void> {
    const rawPayload: unknown = payload.rawPayload;
    if (!isJsonValue(rawPayload)) {
      throw new Error(
        `Provider payload for externalId "${payload.externalId}" is missing a raw payload`,
      );
    }

    const existing =
      await this.providerServiceRepository.findByOriginAndExternalId(
        BULKFOLLOWS_PROVIDER_ORIGIN,
        payload.externalId,
      );

    const providerService =
      await this.providerServiceRepository.upsertByOriginAndExternalId({
        providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId: payload.externalId,
        rawPayload,
      });

    if (existing) {
      summary.updated += 1;
    } else {
      summary.imported += 1;
    }

    await this.stagedServiceRepository.upsertPendingFromProvider(
      providerService.id,
      {
        title: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        socialNetwork: payload.socialNetwork,
      },
    );
  }
}
