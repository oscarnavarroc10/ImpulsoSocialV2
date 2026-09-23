import { ConfigService } from '@nestjs/config';
import { PublicCatalogService } from '../../../src/modules/catalog/application/public-catalog.service';
import { PublicCatalogRepository } from '../../../src/modules/catalog/infrastructure/public-catalog.repository';

describe('SMMGEN customer projection contract', () => {
  const config = {
    get: jest.fn().mockReturnValue('tenant-a'),
  } as unknown as ConfigService;
  const repository = {
    findActiveTenantIdBySlug: jest.fn().mockResolvedValue('tenant-a'),
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(1),
    findFacetRows: jest.fn().mockResolvedValue([]),
  } as unknown as PublicCatalogRepository;
  const service = new PublicCatalogService(config, repository);

  it('projects selected Standard data without provider infrastructure', async () => {
    repository.findMany = jest.fn().mockResolvedValue([
      {
        id: 'master-standard',
        title: 'Curated service',
        description: 'Local description',
        socialNetwork: 'Instagram',
        categoryId: 'category-1',
        category: { id: 'category-1', name: 'Growth', description: null },
        defaultSellingPriceAmount: 1000,
        defaultSellingPriceCurrency: 'USD',
        tenantOverride: {
          sellingPriceAmount: 1250,
          sellingPriceCurrency: 'USD',
        },
        quantityBounds: { min: 10, max: 1000 },
        capability: {
          key: 'STANDARD',
          input: { target: 'required', quantity: 'required' },
          quantity: { min: 10, max: 1000 },
        },
      },
    ]);

    const result = await service.list({});
    const serialized = JSON.stringify(result);

    expect(result.items[0]).toMatchObject({
      id: 'master-standard',
      sellingPrice: { amount: 1250, currency: 'USD' },
      capability: { key: 'STANDARD', quantity: { min: 10, max: 1000 } },
    });
    for (const forbidden of [
      'smmgen',
      'externalId',
      'providerCost',
      'rawPayload',
      'apiKey',
      'apiUrl',
      'routing',
      'privateSnapshot',
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it('always scopes reads to the resolved tenant and does not accept caller tenant input', async () => {
    repository.findMany = jest.fn().mockResolvedValue([]);
    await service.list({});
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findMany).toHaveBeenCalledWith(
      'tenant-a',
      { socialNetwork: undefined, categoryId: undefined },
      0,
      20,
    );
  });
});
