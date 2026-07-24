import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../infrastructure/audit.service';
import { MasterServiceRepository } from '../infrastructure/master-service.repository';
import { ProviderServiceRepository } from '../infrastructure/provider-service.repository';

export interface DeprecationReviewItem {
  masterServiceId: string;
  title: string;
  providerServiceId: string;
  providerExternalId: string;
  lastImportedAt: string;
  reason: 'MISSING_FROM_PROVIDER_SYNC';
}

interface LatestCompletedSync {
  id: string;
  startedAt: Date;
}

@Injectable()
export class DeprecationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterServiceRepository: MasterServiceRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPendingReview(): Promise<DeprecationReviewItem[]> {
    const latestSync = await this.getLatestCompletedSync();
    if (!latestSync) {
      return [];
    }

    const activeMasterServices =
      await this.masterServiceRepository.findActiveWithProvenance();
    if (activeMasterServices.length === 0) {
      return [];
    }

    const providerIds = activeMasterServices
      .map((item) => item.provenanceRef)
      .filter((value): value is string => Boolean(value));

    const providerServices =
      await this.providerServiceRepository.findByIds(providerIds);
    const providerById = new Map(
      providerServices.map((item) => [item.id, item]),
    );

    return activeMasterServices
      .flatMap((item) => {
        const providerService = item.provenanceRef
          ? providerById.get(item.provenanceRef)
          : null;

        if (!providerService) {
          return [];
        }

        if (providerService.importTimestamp >= latestSync.startedAt) {
          return [];
        }

        return [
          {
            masterServiceId: item.id,
            title: item.title,
            providerServiceId: providerService.id,
            providerExternalId: providerService.externalId,
            lastImportedAt: providerService.importTimestamp.toISOString(),
            reason: 'MISSING_FROM_PROVIDER_SYNC' as const,
          },
        ];
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async confirmDeprecation(actorId: string, masterServiceId: string) {
    const masterService =
      await this.masterServiceRepository.findById(masterServiceId);
    if (!masterService) {
      throw new NotFoundException('Master service not found');
    }

    if (masterService.status !== 'active') {
      throw new BadRequestException(
        'Only active master services can be deprecated',
      );
    }

    const pending = await this.listPendingReview();
    const candidate = pending.find(
      (item) => item.masterServiceId === masterServiceId,
    );
    if (!candidate) {
      throw new BadRequestException(
        'Deprecation requires confirmation for services missing in latest provider sync',
      );
    }

    const deprecated = await this.masterServiceRepository.updateCuratedFields(
      masterServiceId,
      { status: 'deprecated' },
    );

    await this.auditService.recordDeprecation(actorId, {
      masterServiceId: candidate.masterServiceId,
      providerServiceId: candidate.providerServiceId,
      providerExternalId: candidate.providerExternalId,
      reason: candidate.reason,
    });

    return {
      masterServiceId: deprecated.id,
      status: deprecated.status,
    };
  }

  private async getLatestCompletedSync(): Promise<LatestCompletedSync | null> {
    return this.prisma.syncJob.findFirst({
      where: {
        status: {
          in: ['success', 'partial'],
        },
        finishedAt: {
          not: null,
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
      select: {
        id: true,
        startedAt: true,
      },
    });
  }
}
