import { ConfigService } from '@nestjs/config';
import { PublicCatalogService } from '../../../src/modules/catalog/application/public-catalog.service';
import { PublicCatalogRepository } from '../../../src/modules/catalog/infrastructure/public-catalog.repository';

describe('SMMGEN catalog tenant isolation', () => {
  it('keeps each tenant scoped to its own active catalog and price projection', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = {
      findActiveTenantIdBySlug: jest
        .fn()
        .mockResolvedValueOnce('tenant-a')
        .mockResolvedValueOnce('tenant-b'),
      findMany,
      count: jest.fn().mockResolvedValue(0),
      findFacetRows: jest.fn().mockResolvedValue([]),
    } as unknown as PublicCatalogRepository;
    const service = new PublicCatalogService(
      {
        get: jest
          .fn()
          .mockReturnValueOnce('tenant-a')
          .mockReturnValueOnce('tenant-b'),
      } as unknown as ConfigService,
      repository,
    );

    await service.list({});
    await service.list({});

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      'tenant-a',
      expect.any(Object),
      0,
      20,
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      'tenant-b',
      expect.any(Object),
      0,
      20,
    );
    expect(findMany).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ providerOrigin: 'smmgen' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('uses scoped not-found behavior for an offering hidden from another tenant', async () => {
    const findEligibleById = jest.fn().mockResolvedValue(null);
    const repository = {
      findActiveTenantIdBySlug: jest.fn().mockResolvedValue('tenant-b'),
      findEligibleById,
    } as unknown as PublicCatalogRepository;
    const service = new PublicCatalogService(
      {
        get: jest.fn().mockReturnValue('tenant-b'),
      } as unknown as ConfigService,
      repository,
    );

    await expect(service.getById('master-service-a')).rejects.toThrow(
      'Service not found',
    );
    expect(findEligibleById).toHaveBeenCalledWith(
      'tenant-b',
      'master-service-a',
    );
  });
});
