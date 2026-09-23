import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizeBulkFollowsCapability } from '../infrastructure/capability-normalizer';
import { MasterServiceProviderOfferingRepository } from '../infrastructure/master-service-provider-offering.repository';

export type ProviderOfferingBackfillClassification =
  | 'created'
  | 'already_mapped'
  | 'missing_provider'
  | 'malformed_capability'
  | 'unsupported_provider'
  | 'duplicate_mapping';

export interface ProviderOfferingBackfillItem {
  masterServiceId: string;
  providerServiceId: string | null;
  classification: ProviderOfferingBackfillClassification;
}

@Injectable()
export class ProviderOfferingBackfillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly offerings: MasterServiceProviderOfferingRepository,
  ) {}

  async report(): Promise<ProviderOfferingBackfillItem[]> {
    const services = await this.prisma.masterService.findMany({
      where: { status: 'active', provenanceRef: { not: null } },
      select: { id: true, provenanceRef: true },
    });
    const result: ProviderOfferingBackfillItem[] = [];
    for (const service of services) {
      const providerServiceId = service.provenanceRef;
      if (!providerServiceId) continue;
      const provider = await this.prisma.providerService.findUnique({
        where: { id: providerServiceId },
        select: { id: true, providerOrigin: true, externalId: true, rawPayload: true },
      });
      if (!provider) {
        result.push({ masterServiceId: service.id, providerServiceId, classification: 'missing_provider' });
        continue;
      }
      const existing = await this.prisma.masterServiceProviderOffering.findMany({
        where: { masterServiceId: service.id },
        select: { providerServiceId: true },
      });
      if (existing.some((item) => item.providerServiceId === provider.id)) {
        result.push({ masterServiceId: service.id, providerServiceId, classification: 'already_mapped' });
        continue;
      }
      if (existing.length > 0) {
        result.push({ masterServiceId: service.id, providerServiceId, classification: 'duplicate_mapping' });
        continue;
      }
      if (provider.providerOrigin !== 'bulkfollows') {
        result.push({ masterServiceId: service.id, providerServiceId, classification: 'unsupported_provider' });
        continue;
      }
      if (!normalizeBulkFollowsCapability(provider.rawPayload, provider.externalId)) {
        result.push({ masterServiceId: service.id, providerServiceId, classification: 'malformed_capability' });
        continue;
      }
      result.push({ masterServiceId: service.id, providerServiceId, classification: 'created' });
    }
    return result;
  }

  async apply(): Promise<ProviderOfferingBackfillItem[]> {
    const report = await this.report();
    for (const item of report.filter((entry) => entry.classification === 'created')) {
      const provider = await this.prisma.providerService.findUniqueOrThrow({
        where: { id: item.providerServiceId! },
        select: { id: true, providerOrigin: true, externalId: true, rawPayload: true },
      });
      const normalized = normalizeBulkFollowsCapability(provider.rawPayload, provider.externalId);
      if (normalized) await this.offerings.createNormalized(item.masterServiceId, provider.id, normalized);
    }
    return report;
  }
}
