import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type MasterServiceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SnapshotItemInput {
  masterServiceId: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  socialNetwork: string;
  sellingPriceAmount: number;
  currency: string;
  serviceStatus: MasterServiceStatus | string;
}

export interface CreateDraftSnapshotInput {
  createdBy: string;
  masterServiceIds?: string[];
}

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftSnapshot(input: CreateDraftSnapshotInput) {
    this.ensureNonEmpty(input.createdBy, 'createdBy');

    const masterServices = await this.prisma.masterService.findMany({
      where: {
        status: 'active',
        isVisible: true,
        ...(input.masterServiceIds?.length
          ? { id: { in: input.masterServiceIds } }
          : {}),
      },
      orderBy: { title: 'asc' },
    });

    const categoryIds = [
      ...new Set(masterServices.map((service) => service.categoryId)),
    ];
    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
    });

    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const items = masterServices.map((service) => {
      const category = categoryById.get(service.categoryId);
      if (!category) {
        throw new NotFoundException(
          `Category not found for master service ${service.id}`,
        );
      }

      return {
        masterServiceId: service.id,
        title: service.title,
        description: service.description,
        categoryId: category.id,
        categoryName: category.name,
        socialNetwork: service.socialNetwork,
        sellingPriceAmount: service.defaultSellingPriceAmount,
        currency: service.defaultSellingPriceCurrency,
        serviceStatus: service.status,
      } satisfies Prisma.MasterCatalogSnapshotItemCreateWithoutSnapshotInput;
    });

    return this.prisma.masterCatalogSnapshot.create({
      data: {
        createdBy: input.createdBy,
        status: 'draft',
        items: {
          create: items,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async publishSnapshot(snapshotId: string) {
    this.ensureNonEmpty(snapshotId, 'snapshotId');

    const snapshot = await this.prisma.masterCatalogSnapshot.findUnique({
      where: { id: snapshotId },
      include: { items: true },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (snapshot.status === 'published') {
      throw new BadRequestException('Published snapshots cannot be modified');
    }

    if (snapshot.items.length === 0) {
      throw new BadRequestException(
        'Draft snapshot must contain at least one item',
      );
    }

    return this.prisma.masterCatalogSnapshot.update({
      where: { id: snapshotId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
      include: {
        items: true,
      },
    });
  }

  async getById(snapshotId: string) {
    this.ensureNonEmpty(snapshotId, 'snapshotId');

    const snapshot = await this.prisma.masterCatalogSnapshot.findUnique({
      where: { id: snapshotId },
      include: { items: true },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    return snapshot;
  }

  async list() {
    return this.prisma.masterCatalogSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async ensureImmutable(snapshotId: string) {
    const snapshot = await this.prisma.masterCatalogSnapshot.findUnique({
      where: { id: snapshotId },
      select: { status: true },
    });

    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (snapshot.status === 'published') {
      throw new BadRequestException('Published snapshots cannot be modified');
    }
  }

  private ensureNonEmpty(value: string, fieldName: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
  }
}
