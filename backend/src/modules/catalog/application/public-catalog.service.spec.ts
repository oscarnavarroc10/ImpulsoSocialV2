import { describe, expect, it, jest } from '@jest/globals';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  it('maps repository quantity bounds without hardcoded values', async () => {
    const repository = {
      findActiveTenantIdBySlug: jest.fn().mockResolvedValue('tenant-1'),
      findMany: jest.fn().mockResolvedValue([{
        id: 'service-1', title: 'Followers', description: 'Description', socialNetwork: 'Instagram',
        categoryId: 'category-1', defaultSellingPriceAmount: 1000, defaultSellingPriceCurrency: 'MXN',
        category: { id: 'category-1', name: 'Followers', description: 'Audience growth' },
        tenantOverride: null, quantityBounds: { min: 25, max: 750 },
      }]),
      count: jest.fn().mockResolvedValue(1),
      findFacetRows: jest.fn().mockResolvedValue([{
        socialNetwork: 'Instagram',
        category: { id: 'category-1', name: 'Followers', description: 'Audience growth' },
      }, {
        socialNetwork: 'TikTok',
        category: { id: 'category-2', name: 'Views', description: null },
      }]),
    };
    const service = new PublicCatalogService(
      { get: jest.fn().mockReturnValue('tenant') } as never,
      repository as never,
    );

    await expect(service.list({})).resolves.toMatchObject({
      items: [{ minQuantity: 25, maxQuantity: 750 }],
      facets: {
        platforms: [
          { key: 'Instagram', label: 'Instagram', serviceCount: 1 },
          { key: 'TikTok', label: 'TikTok', serviceCount: 1 },
        ],
        categories: [
          { id: 'category-1', name: 'Followers', platformKey: 'Instagram', serviceCount: 1 },
          { id: 'category-2', name: 'Views', platformKey: 'TikTok', serviceCount: 1 },
        ],
      },
    });
  });
});
