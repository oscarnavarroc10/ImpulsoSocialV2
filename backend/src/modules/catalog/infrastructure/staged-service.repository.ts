import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class StagedServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createFromProvider(
    providerServiceId: string,
    payload: {
      title?: string;
      description?: string;
      categoryId?: string;
      socialNetwork?: string;
    },
  ) {
    // Prevent duplicate pending staged entries for the same provider service
    const existing = await this.prisma.stagedService.findFirst({
      where: { providerServiceId, reviewStatus: 'pending' },
    });
    if (existing) return existing;

    return this.prisma.stagedService.create({
      data: {
        providerServiceId,
        ingestedAt: new Date(),
        reviewStatus: 'pending',
        proposedTitle: payload.title ?? null,
        proposedDescription: payload.description ?? null,
        proposedCategoryId: payload.categoryId ?? null,
        proposedSocialNetwork: payload.socialNetwork ?? null,
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
