import { Injectable } from '@nestjs/common';
import { MasterServiceProviderOfferingRepository } from './master-service-provider-offering.repository';

export interface SmmgenSnapshotEvidence {
  complete: unknown;
  providerServiceIds: unknown;
}

@Injectable()
export class SmmgenReconciliationService {
  constructor(
    private readonly offeringRepository: MasterServiceProviderOfferingRepository,
  ) {}

  async reconcile(
    snapshot: SmmgenSnapshotEvidence,
  ): Promise<{ reconciled: boolean }> {
    const providerServiceIds = snapshot.providerServiceIds;
    if (
      snapshot.complete !== true ||
      !Array.isArray(providerServiceIds) ||
      providerServiceIds.some(
        (providerServiceId) =>
          typeof providerServiceId !== 'string' || !providerServiceId.trim(),
      )
    )
      return { reconciled: false };

    try {
      await this.offeringRepository.disableUnavailableProviderServices(
        providerServiceIds as string[],
        'smmgen',
      );
      return { reconciled: true };
    } catch {
      return { reconciled: false };
    }
  }
}
