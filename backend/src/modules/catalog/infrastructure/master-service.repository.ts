import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MasterServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.masterService.findUnique({ where: { id } });
  }
  // Master services are curated objects. Provider imports must not create or
  // overwrite curated business fields. Provide curated update operations only.

  async findByProvenance(provenanceRef: string) {
    return this.prisma.masterService.findFirst({ where: { provenanceRef } });
  }

  async createCurated(data: {
    title: string;
    description: string;
    categoryId: string;
    socialNetwork: string;
    providerCostAmount: number;
    providerCostCurrency: string;
    defaultSellingPriceAmount: number;
    defaultSellingPriceCurrency: string;
    isVisible: boolean;
    status: 'active';
    provenanceRef: string;
  }) {
    return this.prisma.masterService.create({ data });
  }

  async applyApproval(id: string, data: {
    title: string;
    description: string;
    categoryId: string;
    socialNetwork: string;
    providerCostAmount: number;
    providerCostCurrency: string;
    defaultSellingPriceAmount: number;
    defaultSellingPriceCurrency: string;
    isVisible: boolean;
    status: 'active';
    provenanceRef: string;
  }) {
    return this.prisma.masterService.update({
      where: { id },
      data,
    });
  }

  async updateCuratedFields(
    id: string,
    data: {
      title?: string;
      description?: string;
      categoryId?: string;
      socialNetwork?: string;
      defaultSellingPriceAmount?: number | null;
      defaultSellingPriceCurrency?: string | null;
      isVisible?: boolean | null;
      status?: string | null;
    },
  ) {
    // Only update curated fields explicitly provided
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.socialNetwork !== undefined)
      updateData.socialNetwork = data.socialNetwork;
    if (data.defaultSellingPriceAmount !== undefined)
      updateData.defaultSellingPriceAmount = data.defaultSellingPriceAmount;
    if (data.defaultSellingPriceCurrency !== undefined)
      updateData.defaultSellingPriceCurrency = data.defaultSellingPriceCurrency;
    if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.masterService.update({
      where: { id },
      data: updateData,
    });
  }
}
