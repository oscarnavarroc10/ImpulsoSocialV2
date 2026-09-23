import { MasterServiceProviderOfferingRepository } from '../../../src/modules/catalog/infrastructure/master-service-provider-offering.repository';
import { providerOfferingFixture } from '../../fixtures/provider-offering.fixtures';

describe('MasterServiceProviderOfferingRepository', () => {
  it('allows multiple non-selected offerings for one MasterService', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce(providerOfferingFixture({ id: 'offering-a' }))
      .mockResolvedValueOnce(providerOfferingFixture({ id: 'offering-b' }));
    const findMany = jest.fn().mockResolvedValue([
      providerOfferingFixture({ id: 'offering-a' }),
      providerOfferingFixture({ id: 'offering-b' }),
    ]);
    const repository = new MasterServiceProviderOfferingRepository({
      masterServiceProviderOffering: { create, findMany },
    } as never);

    await repository.create(
      providerOfferingFixture({ providerServiceId: 'provider-a' }) as never,
    );
    await repository.create(
      providerOfferingFixture({ providerServiceId: 'provider-b' }) as never,
    );
    const offerings = await repository.findForMasterService('master-1');

    expect(create).toHaveBeenCalledTimes(2);
    expect(offerings).toHaveLength(2);
    expect(offerings.every((offering) => offering.isSelected === false)).toBe(
      true,
    );
  });

  it('preserves the duplicate MasterService/provider-service constraint', async () => {
    const duplicateError = Object.assign(new Error('duplicate offering'), {
      code: 'P2002',
    });
    const create = jest.fn().mockRejectedValue(duplicateError);
    const repository = new MasterServiceProviderOfferingRepository({
      masterServiceProviderOffering: { create },
    } as never);

    await expect(
      repository.create(
        providerOfferingFixture({ providerServiceId: 'provider-a' }) as never,
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('clears the previous selection and selects only the requested offering transactionally', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findFirst = jest.fn().mockResolvedValue({ id: 'offering-b' });
    const update = jest.fn().mockResolvedValue(
      providerOfferingFixture({ id: 'offering-b', isSelected: true }),
    );
    const transaction = jest.fn(async (callback: (tx: never) => unknown) =>
      callback({
        masterServiceProviderOffering: { findFirst, updateMany, update },
      } as never),
    );
    const repository = new MasterServiceProviderOfferingRepository({
      $transaction: transaction,
    } as never);

    const selected = await repository.select('master-1', 'offering-b');

    expect(selected).toEqual(
      expect.objectContaining({ id: 'offering-b', isSelected: true }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { masterServiceId: 'master-1', isSelected: true },
      data: { isSelected: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'offering-b' },
      data: { isSelected: true },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: expect.anything(),
    });
  });
  it('returns zero mappings and preserves enabled/available filtering at lookup time', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new MasterServiceProviderOfferingRepository({
      masterServiceProviderOffering: { findMany },
    } as never);
    await expect(repository.findForMasterService('master-empty')).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { masterServiceId: 'master-empty' },
      orderBy: [{ isSelected: 'desc' }, { id: 'asc' }],
    });
  });

  it('does not return disabled or unavailable offerings as selected candidates', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new MasterServiceProviderOfferingRepository({
      masterServiceProviderOffering: { findFirst },
    } as never);
    await expect(repository.findSelectedAvailable('master-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { masterServiceId: 'master-1', isEnabled: true, isAvailable: true, isSelected: true },
    }));
  });

  it('does not select an offering belonging to another MasterService', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const updateMany = jest.fn();
    const update = jest.fn();
    const transaction = jest.fn(async (callback: (tx: never) => unknown) =>
      callback({
        masterServiceProviderOffering: { findFirst, updateMany, update },
      } as never),
    );
    const repository = new MasterServiceProviderOfferingRepository({
      $transaction: transaction,
    } as never);

    await expect(
      repository.select('master-1', 'offering-other'),
    ).resolves.toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('updates normalized mappings idempotently without changing selection', async () => {
    const upsert = jest.fn().mockResolvedValue(providerOfferingFixture({ id: 'offering-a' }));
    const repository = new MasterServiceProviderOfferingRepository({
      masterServiceProviderOffering: { upsert },
    } as never);
    await repository.createNormalized('master-1', 'provider-a', {
      capabilityKey: 'STANDARD',
      contractVersion: 'v1',
      contract: { requiredFields: ['target', 'quantity'], optionalFields: [], quantityMode: 'required', targetKind: 'link', min: 1, max: 10, supportedOperations: ['create'], validationStatus: 'supported' },
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { masterServiceId_providerServiceId: { masterServiceId: 'master-1', providerServiceId: 'provider-a' } },
    }));
  });
});