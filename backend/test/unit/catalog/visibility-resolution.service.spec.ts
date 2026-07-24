import { NotFoundException } from '@nestjs/common';
import { MasterServiceVisibilityService } from '../../../src/modules/catalog/application/master-service-visibility.service';
import { VisibilityResolutionService } from '../../../src/modules/catalog/application/visibility-resolution.service';

describe('MasterServiceVisibilityService', () => {
  const masterServiceRepository = {
    findById: jest.fn(),
    updateCuratedFields: jest.fn(),
  };

  const service = new MasterServiceVisibilityService(
    masterServiceRepository as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns current visibility for an existing master service', async () => {
    masterServiceRepository.findById.mockResolvedValue({
      id: 'master-1',
      isVisible: true,
      status: 'active',
    });

    const result = await service.getVisibility('master-1');

    expect(result).toEqual({
      masterServiceId: 'master-1',
      isVisible: true,
      status: 'active',
    });
  });

  it('updates master service visibility using curated field updates', async () => {
    masterServiceRepository.findById.mockResolvedValue({
      id: 'master-2',
      isVisible: true,
      status: 'active',
    });
    masterServiceRepository.updateCuratedFields.mockResolvedValue({
      id: 'master-2',
      isVisible: false,
      status: 'active',
    });

    const result = await service.updateVisibility('master-2', false);

    expect(masterServiceRepository.updateCuratedFields).toHaveBeenCalledWith(
      'master-2',
      { isVisible: false },
    );
    expect(result).toEqual({
      masterServiceId: 'master-2',
      isVisible: false,
      status: 'active',
    });
  });

  it('fails when updating visibility for a missing service', async () => {
    masterServiceRepository.findById.mockResolvedValue(null);

    await expect(service.updateVisibility('missing', true)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('VisibilityResolutionService', () => {
  const service = new VisibilityResolutionService();

  it('inherits master visibility when no tenant override is present', () => {
    const result = service.resolve({
      masterServiceId: 'master-1',
      masterIsVisible: true,
      override: null,
    });

    expect(result).toEqual({
      masterServiceId: 'master-1',
      isVisibleForTenant: true,
      source: 'master',
    });
  });

  it('keeps service hidden when master visibility is false even if tenant override enables it', () => {
    const result = service.resolve({
      masterServiceId: 'master-2',
      masterIsVisible: false,
      override: {
        tenantId: 'tenant-1',
        masterServiceId: 'master-2',
        isEnabled: true,
      },
    });

    expect(result).toEqual({
      masterServiceId: 'master-2',
      isVisibleForTenant: false,
      source: 'master',
    });
  });

  it('applies tenant override when master is visible', () => {
    const result = service.resolve({
      masterServiceId: 'master-3',
      masterIsVisible: true,
      override: {
        tenantId: 'tenant-2',
        masterServiceId: 'master-3',
        isEnabled: false,
      },
    });

    expect(result).toEqual({
      masterServiceId: 'master-3',
      isVisibleForTenant: false,
      source: 'tenant_override',
    });
  });

  it('ignores overrides targeting a different master service id', () => {
    const result = service.resolve({
      masterServiceId: 'master-4',
      masterIsVisible: true,
      override: {
        tenantId: 'tenant-3',
        masterServiceId: 'master-x',
        isEnabled: false,
      },
    });

    expect(result).toEqual({
      masterServiceId: 'master-4',
      isVisibleForTenant: true,
      source: 'master',
    });
  });
});