import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface PublicCatalogFilters {
  socialNetwork?: string;
  categoryId?: string;
}

export interface PublicCatalogRow {
  id: string;
  title: string;
  description: string;
  socialNetwork: string;
  categoryId: string;
  defaultSellingPriceAmount: number;
  defaultSellingPriceCurrency: string;
  tenantOverride: {
    sellingPriceAmount: number | null;
    sellingPriceCurrency: string | null;
  } | null;
}

type RawRow = {
  id: string;
  title: string;
  description: string;
  socialNetwork: string;
  categoryId: string;
  defaultSellingPriceAmount: number;
  defaultSellingPriceCurrency: string;
  configuracionesTienda: {
    sellingPriceAmount: number | null;
    sellingPriceCurrency: string | null;
  }[];
};

function buildEligibleWhere(tenantId: string, filters: PublicCatalogFilters) {
  return {
    status: 'active' as const,
    isVisible: true,
    ...(filters.socialNetwork ? { socialNetwork: filters.socialNetwork } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    // A tenant-disabled override excludes the service; absence never enables it.
    NOT: {
      configuracionesTienda: {
        some: { tenantId, isEnabled: false },
      },
    },
  };
}

function buildSelect(tenantId: string) {
  return {
    id: true,
    title: true,
    description: true,
    socialNetwork: true,
    categoryId: true,
    defaultSellingPriceAmount: true,
    defaultSellingPriceCurrency: true,
    configuracionesTienda: {
      where: { tenantId },
      select: { sellingPriceAmount: true, sellingPriceCurrency: true },
      take: 1,
    },
  };
}

function mapRow(row: RawRow): PublicCatalogRow {
  const override = row.configuracionesTienda[0] ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    socialNetwork: row.socialNetwork,
    categoryId: row.categoryId,
    defaultSellingPriceAmount: row.defaultSellingPriceAmount,
    defaultSellingPriceCurrency: row.defaultSellingPriceCurrency,
    tenantOverride: override
      ? {
          sellingPriceAmount: override.sellingPriceAmount,
          sellingPriceCurrency: override.sellingPriceCurrency,
        }
      : null,
  };
}

@Injectable()
export class PublicCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveTenantIdBySlug(slug: string): Promise<string | null> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { slug },
      select: { id: true, activa: true },
    });

    return tienda && tienda.activa ? tienda.id : null;
  }

  async count(
    tenantId: string,
    filters: PublicCatalogFilters,
  ): Promise<number> {
    return this.prisma.masterService.count({
      where: buildEligibleWhere(tenantId, filters),
    });
  }

  async findMany(
    tenantId: string,
    filters: PublicCatalogFilters,
    skip: number,
    take: number,
  ): Promise<PublicCatalogRow[]> {
    const rows = await this.prisma.masterService.findMany({
      where: buildEligibleWhere(tenantId, filters),
      select: buildSelect(tenantId),
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip,
      take,
    });

    return rows.map(mapRow);
  }

  async findEligibleById(
    tenantId: string,
    masterServiceId: string,
  ): Promise<PublicCatalogRow | null> {
    const row = await this.prisma.masterService.findFirst({
      where: { ...buildEligibleWhere(tenantId, {}), id: masterServiceId },
      select: buildSelect(tenantId),
    });

    return row ? mapRow(row) : null;
  }
}
