import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StagedServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPendingFromProvider(
    providerServiceId: string,
    payload: {
      title?: string;
      description?: string;
      categoryId?: string;
      socialNetwork?: string;
    },
  ) {
    const existing = await this.prisma.stagedService.findFirst({
      where: {
        providerServiceId,
        reviewStatus: 'pending',
      },
    });

    const proposedData = {
      proposedTitle: payload.title ?? null,
      proposedDescription: payload.description ?? null,
      proposedCategoryId: payload.categoryId ?? null,
      proposedSocialNetwork: payload.socialNetwork ?? null,
      ingestedAt: new Date(),
    };

    if (existing) {
      return this.prisma.stagedService.update({
        where: { id: existing.id },
        data: proposedData,
      });
    }

    return this.prisma.stagedService.create({
      data: {
        providerServiceId,
        reviewStatus: 'pending',
        ...proposedData,
      },
    });
  }

  async findPending(limit = 100) {
    return this.prisma.stagedService.findMany({
      where: { reviewStatus: 'pending' },
      take: limit,
    });
  }

  async updateReviewStatus(id: string, status: 'approved' | 'rejected') {
    return this.prisma.stagedService.update({
      where: { id },
      data: { reviewStatus: status },
    });
  }
}
