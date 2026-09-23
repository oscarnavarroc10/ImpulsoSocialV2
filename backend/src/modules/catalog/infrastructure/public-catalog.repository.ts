import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { readQuantityBounds } from './quantity-bounds';
import { SUPPORTED_SOCIAL_NETWORKS } from '../application/taxonomy-normalizer';

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
  category: {
    id: string;
    name: string;
    description: string | null;
  };
  defaultSellingPriceAmount: number;
  defaultSellingPriceCurrency: string;
  tenantOverride: {
    sellingPriceAmount: number | null;
    sellingPriceCurrency: string | null;
  } | null;
  quantityBounds: { min: number; max: number } | null;
  providerMetadata?: { refill: boolean; cancel: boolean } | null;
  capability?: {
    key: 'STANDARD';
    input: { target: 'required'; quantity: 'required' };
    quantity: { min: number; max: number };
  } | null;
}

export interface PublicCatalogFacetRow {
  socialNetwork: string;
  category: PublicCatalogRow['category'];
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
  provenanceRef: string | null;
};

type RawFacetRow = {
  socialNetwork: string;
  categoryId: string;
};

function buildEligibleWhere(tenantId: string, filters: PublicCatalogFilters) {
  const requestedNetwork = filters.socialNetwork?.trim();
  const socialNetwork = requestedNetwork
    ? SUPPORTED_SOCIAL_NETWORKS.includes(requestedNetwork as never)
      ? requestedNetwork
      : { in: [] as string[] }
    : { in: [...SUPPORTED_SOCIAL_NETWORKS] };

  return {
    status: 'active' as const,
    isVisible: true,
    socialNetwork,
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
    provenanceRef: true,
    configuracionesTienda: {
      where: { tenantId },
      select: { sellingPriceAmount: true, sellingPriceCurrency: true },
      take: 1,
    },
  };
}

function mapRow(
  row: RawRow,
  provider: {
    providerOrigin: string;
    externalId: string;
    rawPayload: unknown;
  } | null,
  category: PublicCatalogRow['category'] | undefined,
  capability: PublicCatalogRow['capability'] = null,
): PublicCatalogRow {
  if (!category) {
    throw new Error(`Category not found for public catalog service ${row.id}`);
  }

  const override = row.configuracionesTienda[0] ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    socialNetwork: row.socialNetwork,
    categoryId: row.categoryId,
    category,
    defaultSellingPriceAmount: row.defaultSellingPriceAmount,
    defaultSellingPriceCurrency: row.defaultSellingPriceCurrency,
    tenantOverride: override
      ? {
          sellingPriceAmount: override.sellingPriceAmount,
          sellingPriceCurrency: override.sellingPriceCurrency,
        }
      : null,
    quantityBounds:
      capability?.quantity ??
      (provider?.providerOrigin === 'bulkfollows'
        ? readQuantityBounds(provider.rawPayload, provider.externalId)
        : null),
    providerMetadata: readProviderMetadata(provider),
    capability,
  };
}

function readProviderMetadata(
  provider: { providerOrigin: string; rawPayload: unknown } | null,
): PublicCatalogRow['providerMetadata'] {
  if (!provider || provider.providerOrigin !== 'bulkfollows') return null;
  if (!provider.rawPayload || typeof provider.rawPayload !== 'object') return null;

  const payload = provider.rawPayload as Record<string, unknown>;
  const refill = payload['refill'];
  const cancel = payload['cancel'];
  if (typeof refill !== 'boolean' || typeof cancel !== 'boolean') return null;

  return { refill, cancel };
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

    const providers = await this.findProviders(rows);
    const categories = await this.findCategories(
      rows.map((row) => row.categoryId),
    );
    const capabilities = await this.findCapabilities(rows.map((row) => row.id));
    return rows.map((row) =>
      mapRow(
        row,
        providers.get(row.provenanceRef ?? '') ?? null,
        categories.get(row.categoryId),
        capabilities.get(row.id) ?? null,
      ),
    );
  }

  async findFacetRows(tenantId: string): Promise<PublicCatalogFacetRow[]> {
    const rows: RawFacetRow[] = await this.prisma.masterService.findMany({
      where: buildEligibleWhere(tenantId, {}),
      select: { socialNetwork: true, categoryId: true },
    });
    const categories = await this.findCategories(
      rows.map((row) => row.categoryId),
    );

    return rows.map((row) => {
      const category = categories.get(row.categoryId);
      if (!category) {
        throw new Error(
          `Category not found for public catalog service category ${row.categoryId}`,
        );
      }
      return { socialNetwork: row.socialNetwork, category };
    });
  }

  async findEligibleById(
    tenantId: string,
    masterServiceId: string,
  ): Promise<PublicCatalogRow | null> {
    const row = await this.prisma.masterService.findFirst({
      where: { ...buildEligibleWhere(tenantId, {}), id: masterServiceId },
      select: buildSelect(tenantId),
    });

    if (!row) return null;
    const providers = await this.findProviders([row]);
    const categories = await this.findCategories([row.categoryId]);
    const capabilities = await this.findCapabilities([row.id]);
    return mapRow(
      row,
      providers.get(row.provenanceRef ?? '') ?? null,
      categories.get(row.categoryId),
      capabilities.get(row.id) ?? null,
    );
  }

  private async findCapabilities(masterServiceIds: string[]) {
    const delegate = (
      this.prisma as PrismaService & {
        masterServiceProviderOffering?: {
          findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
        };
      }
    ).masterServiceProviderOffering;
    if (!delegate || masterServiceIds.length === 0)
      return new Map<string, PublicCatalogRow['capability']>();

    const offerings = await delegate.findMany({
      where: {
        masterServiceId: { in: masterServiceIds },
        isEnabled: true,
        isAvailable: true,
        isSelected: true,
        capabilityKey: 'STANDARD',
      },
      select: { masterServiceId: true, capabilityKey: true, contract: true },
    });
    return new Map(
      offerings.flatMap((offering) => {
        const contract = offering.contract;
        if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return [];
        const value = contract as Record<string, unknown>;
        if (
          value.validationStatus !== 'supported' ||
          value.quantityMode !== 'required' ||
          !Number.isSafeInteger(value.min) ||
          !Number.isSafeInteger(value.max) ||
          (value.min as number) <= 0 ||
          (value.max as number) < (value.min as number)
        ) return [];
        return [[
          String(offering.masterServiceId),
          {
            key: 'STANDARD' as const,
            input: { target: 'required' as const, quantity: 'required' as const },
            quantity: { min: value.min as number, max: value.max as number },
          },
        ] as const];
      }),
    );
  }

  private async findProviders(rows: RawRow[]) {
    const ids = rows.flatMap((row) =>
      row.provenanceRef ? [row.provenanceRef] : [],
    );
    if (ids.length === 0)
      return new Map<
        string,
        { providerOrigin: string; externalId: string; rawPayload: unknown }
      >();

    const providers = await this.prisma.providerService.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        providerOrigin: true,
        externalId: true,
        rawPayload: true,
      },
    });
    return new Map(providers.map((provider) => [provider.id, provider]));
  }

  private async findCategories(categoryIds: string[]) {
    const ids = [...new Set(categoryIds)];
    if (ids.length === 0)
      return new Map<string, PublicCatalogRow['category']>();

    const categories = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, description: true },
    });
    return new Map(categories.map((category) => [category.id, category]));
  }
}
