import { describe, expect, it, jest } from '@jest/globals';
import { readQuantityBounds } from './quantity-bounds';
import { PublicCatalogRepository } from './public-catalog.repository';

describe('public catalog quantity bounds', () => {
  it('reads valid provider configuration without defaults', () => {
    expect(
      readQuantityBounds(
        { type: 'default', service: '12', min: '100', max: 5000 },
        '12',
      ),
    ).toEqual({
      min: 100,
      max: 5000,
    });
  });

  it.each([
    undefined,
    { type: 'default', service: '99', min: 100, max: 5000 },
    { type: 'default', min: 0, max: 5000 },
    { type: 'default', min: 5000, max: 100 },
    { type: 'other', min: 100, max: 5000 },
  ])('returns unavailable for invalid configuration: %j', (payload) => {
    expect(readQuantityBounds(payload, '12')).toBeNull();
  });
});

describe('PublicCatalogRepository public contract', () => {
  it('uses all tenant-eligible services for facets and applies filters only to items', async () => {
    const masterService = {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'service-1',
            title: 'Followers',
            description: 'Current service',
            socialNetwork: 'Instagram',
            categoryId: 'category-1',
            defaultSellingPriceAmount: 100,
            defaultSellingPriceCurrency: 'MXN',
            provenanceRef: null,
            configuracionesTienda: [],
          },
        ])
        .mockResolvedValueOnce([
          { socialNetwork: 'Instagram', categoryId: 'category-1' },
          { socialNetwork: 'TikTok', categoryId: 'category-2' },
        ]),
    };
    const prisma = {
      masterService,
      category: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'category-1', name: 'Followers', description: null },
          { id: 'category-2', name: 'Views', description: 'Video views' },
        ]),
      },
      providerService: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new PublicCatalogRepository(prisma as never);

    await repository.findMany(
      'tenant-a',
      {
        socialNetwork: 'Instagram',
        categoryId: 'category-1',
      },
      0,
      1,
    );
    const facetRows = await repository.findFacetRows('tenant-a');

    expect(masterService.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          socialNetwork: 'Instagram',
          categoryId: 'category-1',
          NOT: {
            configuracionesTienda: {
              some: { tenantId: 'tenant-a', isEnabled: false },
            },
          },
        }),
      }),
    );
    expect(masterService.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          isVisible: true,
          socialNetwork: { in: ['Instagram', 'TikTok', 'YouTube', 'Facebook'] },
          NOT: {
            configuracionesTienda: {
              some: { tenantId: 'tenant-a', isEnabled: false },
            },
          },
        }),
        select: { socialNetwork: true, categoryId: true },
      }),
    );
    expect(facetRows).toEqual([
      {
        socialNetwork: 'Instagram',
        category: { id: 'category-1', name: 'Followers', description: null },
      },
      {
        socialNetwork: 'TikTok',
        category: {
          id: 'category-2',
          name: 'Views',
          description: 'Video views',
        },
      },
    ]);
  });
});
