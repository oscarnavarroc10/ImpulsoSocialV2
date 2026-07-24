import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeprecationService } from '../../../src/modules/catalog/application/deprecation.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditService } from '../../../src/modules/catalog/infrastructure/audit.service';
import { MasterServiceRepository } from '../../../src/modules/catalog/infrastructure/master-service.repository';
import { ProviderServiceRepository } from '../../../src/modules/catalog/infrastructure/provider-service.repository';

describe('DeprecationService', () => {
  const prisma = {
    syncJob: {
      findFirst: jest.fn(),
    },
  };

  const masterServiceRepository = {
    findById: jest.fn(),
    findActiveWithProvenance: jest.fn(),
    updateCuratedFields: jest.fn(),
  };

  const providerServiceRepository = {
    findByIds: jest.fn(),
  };

  const auditService = {
    recordDeprecation: jest.fn(),
  };

  const service = new DeprecationService(
    prisma as unknown as PrismaService,
    masterServiceRepository as unknown as MasterServiceRepository,
    providerServiceRepository as unknown as ProviderServiceRepository,
    auditService as unknown as AuditService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns no review items when no completed sync exists', async () => {
    prisma.syncJob.findFirst.mockResolvedValue(null);

    const result = await service.listPendingReview();

    expect(result).toEqual([]);
    expect(
      masterServiceRepository.findActiveWithProvenance,
    ).not.toHaveBeenCalled();
  });

  it('returns deprecation candidates missing from latest provider sync', async () => {
    prisma.syncJob.findFirst.mockResolvedValue({
      id: 'sync-1',
      startedAt: new Date('2026-07-24T10:00:00.000Z'),
    });
    masterServiceRepository.findActiveWithProvenance.mockResolvedValue([
      {
        id: 'master-1',
        title: 'Legacy Service',
        provenanceRef: 'provider-1',
      },
      {
        id: 'master-2',
        title: 'Current Service',
        provenanceRef: 'provider-2',
      },
    ]);
    providerServiceRepository.findByIds.mockResolvedValue([
      {
        id: 'provider-1',
        externalId: '100',
        importTimestamp: new Date('2026-07-23T10:00:00.000Z'),
      },
      {
        id: 'provider-2',
        externalId: '200',
        importTimestamp: new Date('2026-07-24T10:30:00.000Z'),
      },
    ]);

    const result = await service.listPendingReview();

    expect(result).toEqual([
      {
        masterServiceId: 'master-1',
        title: 'Legacy Service',
        providerServiceId: 'provider-1',
        providerExternalId: '100',
        lastImportedAt: '2026-07-23T10:00:00.000Z',
        reason: 'MISSING_FROM_PROVIDER_SYNC',
      },
    ]);
  });

  it('confirms deprecation only for an eligible review candidate', async () => {
    masterServiceRepository.findById.mockResolvedValue({
      id: 'master-1',
      status: 'active',
    });
    prisma.syncJob.findFirst.mockResolvedValue({
      id: 'sync-1',
      startedAt: new Date('2026-07-24T10:00:00.000Z'),
    });
    masterServiceRepository.findActiveWithProvenance.mockResolvedValue([
      {
        id: 'master-1',
        title: 'Legacy Service',
        provenanceRef: 'provider-1',
      },
    ]);
    providerServiceRepository.findByIds.mockResolvedValue([
      {
        id: 'provider-1',
        externalId: '100',
        importTimestamp: new Date('2026-07-23T10:00:00.000Z'),
      },
    ]);
    masterServiceRepository.updateCuratedFields.mockResolvedValue({
      id: 'master-1',
      status: 'deprecated',
    });

    const result = await service.confirmDeprecation('admin-1', 'master-1');

    expect(masterServiceRepository.updateCuratedFields).toHaveBeenCalledWith(
      'master-1',
      { status: 'deprecated' },
    );
    expect(auditService.recordDeprecation).toHaveBeenCalledWith('admin-1', {
      masterServiceId: 'master-1',
      providerServiceId: 'provider-1',
      providerExternalId: '100',
      reason: 'MISSING_FROM_PROVIDER_SYNC',
    });
    expect(result).toEqual({
      masterServiceId: 'master-1',
      status: 'deprecated',
    });
  });

  it('rejects deprecation confirmation when service is not missing in latest sync', async () => {
    masterServiceRepository.findById.mockResolvedValue({
      id: 'master-2',
      status: 'active',
    });
    prisma.syncJob.findFirst.mockResolvedValue({
      id: 'sync-1',
      startedAt: new Date('2026-07-24T10:00:00.000Z'),
    });
    masterServiceRepository.findActiveWithProvenance.mockResolvedValue([
      {
        id: 'master-2',
        title: 'Current Service',
        provenanceRef: 'provider-2',
      },
    ]);
    providerServiceRepository.findByIds.mockResolvedValue([
      {
        id: 'provider-2',
        externalId: '200',
        importTimestamp: new Date('2026-07-24T10:30:00.000Z'),
      },
    ]);

    await expect(
      service.confirmDeprecation('admin-2', 'master-2'),
    ).rejects.toThrow(BadRequestException);

    expect(masterServiceRepository.updateCuratedFields).not.toHaveBeenCalled();
    expect(auditService.recordDeprecation).not.toHaveBeenCalled();
  });

  it('fails when master service does not exist', async () => {
    masterServiceRepository.findById.mockResolvedValue(null);

    await expect(
      service.confirmDeprecation('admin-3', 'missing-master'),
    ).rejects.toThrow(NotFoundException);
  });
});
