import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface StagedServiceBatchItem {
  providerServiceId: string;
  title?: string;
  description?: string;
  categoryId?: string;
  socialNetwork?: string;
}

export interface PendingStagedServiceBatchItem extends StagedServiceBatchItem {
  id: string;
}

@Injectable()
export class StagedServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.stagedService.findUnique({
      where: { id },
    });
  }

  async findPendingByProviderServiceIds(providerServiceIds: string[]) {
    if (providerServiceIds.length === 0) {
      return [];
    }

    return this.prisma.stagedService.findMany({
      where: {
        providerServiceId: {
          in: providerServiceIds,
        },
        reviewStatus: 'pending',
      },
      select: {
        id: true,
        providerServiceId: true,
      },
    });
  }

  async createManyPending(items: StagedServiceBatchItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const ingestedAt = new Date();

    const result = await this.prisma.stagedService.createMany({
      data: items.map((item) => ({
        providerServiceId: item.providerServiceId,
        ingestedAt,
        reviewStatus: 'pending',
        proposedTitle: item.title ?? null,
        proposedDescription: item.description ?? null,
        proposedCategoryId: item.categoryId ?? null,
        proposedSocialNetwork: item.socialNetwork ?? null,
      })),
    });

    return result.count;
  }

  async updateManyPending(
    items: PendingStagedServiceBatchItem[],
    batchSize = 500,
  ): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    let updated = 0;

    for (let index = 0; index < items.length; index += batchSize) {
      const batch = items.slice(index, index + batchSize);
      const ingestedAt = new Date();

      await this.prisma.$transaction(
        batch.map((item) =>
          this.prisma.stagedService.update({
            where: {
              id: item.id,
            },
            data: {
              ingestedAt,
              proposedTitle: item.title ?? null,
              proposedDescription: item.description ?? null,
              proposedCategoryId: item.categoryId ?? null,
              proposedSocialNetwork: item.socialNetwork ?? null,
            },
          }),
        ),
      );

      updated += batch.length;
    }

    return updated;
  }

  async findPending(limit = 100) {
    return this.prisma.stagedService.findMany({
      where: {
        reviewStatus: 'pending',
      },
      orderBy: {
        ingestedAt: 'desc',
      },
      take: limit,
    });
  }

  async updateReviewStatus(id: string, status: 'approved' | 'rejected') {
    return this.prisma.stagedService.update({
      where: { id },
      data: {
        reviewStatus: status,
      },
    });
  }
}
