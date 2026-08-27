import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PublicCatalogService } from '../../../src/modules/catalog/application/public-catalog.service';
import { PublicCatalogRepository } from '../../../src/modules/catalog/infrastructure/public-catalog.repository';

describe('PublicCatalogService', () => {
  const configService = {
    get: jest.fn<(key: string) => string | undefined>(),
  };
  const repository = {
    findActiveTenantIdBySlug:
      jest.fn<PublicCatalogRepository['findActiveTenantIdBySlug']>(),
    count: jest.fn<PublicCatalogRepository['count']>(),
    findMany: jest.fn<PublicCatalogRepository['findMany']>(),
    findEligibleById:
      jest.fn<PublicCatalogRepository['findEligibleById']>(),
  };

  const service = new PublicCatalogService(
    configService as unknown as ConfigService,
    repository as unknown as PublicCatalogRepository,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    configService.get.mockReturnValue('  ImpulsoSocial  ');
    repository.findActiveTenantIdBySlug.mockResolvedValue('tenant-1');
    repository.count.mockResolvedValue(0);
    repository.findMany.mockResolvedValue([]);
  });

  function buildRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'master-1',
      title: 'Instagram Followers',
      description: 'Curated description',
      socialNetwork: 'Instagram',
      categoryId: 'cat-1',
      defaultSellingPriceAmount: 1000,
      defaultSellingPriceCurrency: 'USD',
      tenantOverride: null,
      ...overrides,
    };
  }

  it('normalizes and resolves the configured active tenant', async () => {
    await service.list({});

    expect(repository.findActiveTenantIdBySlug).toHaveBeenCalledWith(
      'impulsosocial',
    );
  });

  it('fails closed when DEFAULT_TENANT_SLUG is not configured', async () => {
    configService.get.mockReturnValue(undefined);

    await expect(service.list({})).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(repository.findActiveTenantIdBySlug).not.toHaveBeenCalled();
  });

  it('fails closed when DEFAULT_TENANT_SLUG is blank', async () => {
    configService.get.mockReturnValue('   ');

    await expect(service.list({})).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('fails closed when the configured tenant is missing or inactive', async () => {
    repository.findActiveTenantIdBySlug.mockResolvedValue(null);

    await expect(service.list({})).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('uses the default selling price when there is no tenant override', async () => {
    repository.findMany.mockResolvedValue([buildRow()]);
    repository.count.mockResolvedValue(1);

    const result = await service.list({});

    expect(result.items[0].sellingPrice).toEqual({
      amount: 1000,
      currency: 'USD',
    });
  });

  it('uses the complete tenant price override when present', async () => {
    repository.findMany.mockResolvedValue([
      buildRow({
        tenantOverride: {
          sellingPriceAmount: 750,
          sellingPriceCurrency: 'MXN',
        },
      }),
    ]);
    repository.count.mockResolvedValue(1);

    const result = await service.list({});

    expect(result.items[0].sellingPrice).toEqual({
      amount: 750,
      currency: 'MXN',
    });
  });

  it('falls back to the default price when the override is partial', async () => {
    repository.findMany.mockResolvedValue([
      buildRow({
        tenantOverride: { sellingPriceAmount: 750, sellingPriceCurrency: null },
      }),
    ]);
    repository.count.mockResolvedValue(1);

    const result = await service.list({});

    expect(result.items[0].sellingPrice).toEqual({
      amount: 1000,
      currency: 'USD',
    });
  });

  it('computes pagination metadata and deterministic repository skip/take', async () => {
    repository.count.mockResolvedValue(45);

    const result = await service.list({ page: 3, limit: 20 });

    expect(repository.findMany).toHaveBeenCalledWith(
      'tenant-1',
      { socialNetwork: undefined, categoryId: undefined },
      40,
      20,
    );
    expect(result.pagination).toEqual({
      page: 3,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('defaults to page=1 and limit=20 and applies filters', async () => {
    await service.list({ socialNetwork: 'Instagram', categoryId: 'cat-1' });

    expect(repository.findMany).toHaveBeenCalledWith(
      'tenant-1',
      { socialNetwork: 'Instagram', categoryId: 'cat-1' },
      0,
      20,
    );
  });

  it('scopes repository reads to the resolved tenant id, never a caller value', async () => {
    repository.findEligibleById.mockResolvedValue(buildRow());

    await service.getById('master-1');

    expect(repository.findEligibleById).toHaveBeenCalledWith(
      'tenant-1',
      'master-1',
    );
  });

  it('returns the mapped public service for an eligible detail record', async () => {
    repository.findEligibleById.mockResolvedValue(buildRow());

    const result = await service.getById('master-1');

    expect(result).toEqual({
      id: 'master-1',
      title: 'Instagram Followers',
      description: 'Curated description',
      socialNetwork: 'Instagram',
      categoryId: 'cat-1',
      sellingPrice: { amount: 1000, currency: 'USD' },
    });
  });

  it('throws NotFoundException for a hidden, disabled, deprecated, or nonexistent service', async () => {
    repository.findEligibleById.mockResolvedValue(null);

    await expect(service.getById('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('PublicCatalogRepository', () => {
  const prisma = {
    tienda: {
      findUnique:
        jest.fn<
          (args: unknown) => Promise<{
            id: string;
            activa: boolean;
          } | null>
        >(),
    },
    masterService: {
      count: jest.fn<(args: unknown) => Promise<number>>(),
      findMany: jest.fn<(args: unknown) => Promise<never[]>>(),
      findFirst: jest.fn<(args: unknown) => Promise<null>>(),
    },
  };
  const repository = new PublicCatalogRepository(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('resolves only an active tenant id', async () => {
    prisma.tienda.findUnique.mockResolvedValue({
      id: 'tenant-1',
      activa: true,
    });

    await expect(
      repository.findActiveTenantIdBySlug('impulsosocial'),
    ).resolves.toBe('tenant-1');
    expect(prisma.tienda.findUnique).toHaveBeenCalledWith({
      where: { slug: 'impulsosocial' },
      select: { id: true, activa: true },
    });

    prisma.tienda.findUnique.mockResolvedValue({
      id: 'tenant-1',
      activa: false,
    });
    await expect(
      repository.findActiveTenantIdBySlug('impulsosocial'),
    ).resolves.toBeNull();
  });

  it('uses the same active, visible, tenant-disable and filter predicate for count', async () => {
    prisma.masterService.count.mockResolvedValue(0);

    await repository.count('tenant-1', {
      socialNetwork: 'Instagram',
      categoryId: 'cat-1',
    });

    expect(prisma.masterService.count).toHaveBeenCalledWith({
      where: {
        status: 'active',
        isVisible: true,
        socialNetwork: 'Instagram',
        categoryId: 'cat-1',
        NOT: {
          configuracionesTienda: {
            some: { tenantId: 'tenant-1', isEnabled: false },
          },
        },
      },
    });
  });

  it('keeps list reads tenant-scoped, deterministic and provider-safe', async () => {
    prisma.masterService.findMany.mockResolvedValue([]);

    await repository.findMany('tenant-1', {}, 20, 10);

    expect(prisma.masterService.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        isVisible: true,
        NOT: {
          configuracionesTienda: {
            some: { tenantId: 'tenant-1', isEnabled: false },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        socialNetwork: true,
        categoryId: true,
        defaultSellingPriceAmount: true,
        defaultSellingPriceCurrency: true,
        configuracionesTienda: {
          where: { tenantId: 'tenant-1' },
          select: {
            sellingPriceAmount: true,
            sellingPriceCurrency: true,
          },
          take: 1,
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
      skip: 20,
      take: 10,
    });

    const serializedQuery = JSON.stringify(
      prisma.masterService.findMany.mock.calls[0][0],
    );
    for (const forbiddenKey of [
      'providerCostAmount',
      'providerCostCurrency',
      'provenanceRef',
      'providerOrigin',
      'externalId',
      'rawPayload',
      'metadata',
    ]) {
      expect(serializedQuery).not.toContain(forbiddenKey);
    }
  });

  it('applies the same tenant eligibility predicate to detail reads', async () => {
    prisma.masterService.findFirst.mockResolvedValue(null);

    await expect(
      repository.findEligibleById('tenant-1', 'master-1'),
    ).resolves.toBeNull();

    expect(prisma.masterService.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'active',
          isVisible: true,
          NOT: {
            configuracionesTienda: {
              some: { tenantId: 'tenant-1', isEnabled: false },
            },
          },
          id: 'master-1',
        },
      }),
    );
  });
});
