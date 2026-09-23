import { ConfigService } from '@nestjs/config';
import { PublicCatalogService } from '../../../src/modules/catalog/application/public-catalog.service';
import { PublicCatalogRepository } from '../../../src/modules/catalog/infrastructure/public-catalog.repository';

describe('SMMGEN public catalog tenant boundary', () => {
  it('does not expose unsupported or unavailable provider offerings', async () => {
    const repository = {
      findActiveTenantIdBySlug: jest.fn().mockResolvedValue('tenant-a'),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findFacetRows: jest.fn().mockResolvedValue([]),
    } as unknown as PublicCatalogRepository;
    const service = new PublicCatalogService(
      {
        get: jest.fn().mockReturnValue('tenant-a'),
      } as unknown as ConfigService,
      repository,
    );

    const result = await service.list({});

    expect(result.items).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findMany).toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Object),
      0,
      20,
    );
  });

  it('uses the existing scoped not-found behavior for a missing service', async () => {
    const repository = {
      findActiveTenantIdBySlug: jest.fn().mockResolvedValue('tenant-b'),
      findEligibleById: jest.fn().mockResolvedValue(null),
    } as unknown as PublicCatalogRepository;
    const service = new PublicCatalogService(
      {
        get: jest.fn().mockReturnValue('tenant-b'),
      } as unknown as ConfigService,
      repository,
    );

    await expect(
      service.getById('service-hidden-from-tenant-b'),
    ).rejects.toThrow('Service not found');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findEligibleById).toHaveBeenCalledWith(
      'tenant-b',
      'service-hidden-from-tenant-b',
    );
  });
});
