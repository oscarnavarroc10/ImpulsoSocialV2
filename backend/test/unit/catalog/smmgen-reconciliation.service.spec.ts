import { SmmgenReconciliationService } from '../../../src/modules/catalog/infrastructure/smmgen-reconciliation.service';

describe('SmmgenReconciliationService', () => {
  it('does not disable offerings for incomplete evidence', async () => {
    const disable = jest.fn();
    const service = new SmmgenReconciliationService({
      disableUnavailableProviderServices: disable,
    } as never);
    await expect(
      service.reconcile({ complete: false, providerServiceIds: ['present'] }),
    ).resolves.toEqual({ reconciled: false });
    expect(disable).not.toHaveBeenCalled();
  });

  it('disables disappeared offerings only for complete evidence', async () => {
    const disable = jest.fn().mockResolvedValue({ count: 1 });
    const service = new SmmgenReconciliationService({
      disableUnavailableProviderServices: disable,
    } as never);
    await expect(
      service.reconcile({ complete: true, providerServiceIds: ['present'] }),
    ).resolves.toEqual({ reconciled: true });
    expect(disable).toHaveBeenCalledWith(['present'], 'smmgen');
  });

  it.each([
    { complete: true, providerServiceIds: 'not-an-array' },
    { complete: true, providerServiceIds: [''] },
    { complete: 'true', providerServiceIds: ['present'] },
  ])('fails closed for malformed evidence %p', async (snapshot) => {
    const disable = jest.fn();
    const service = new SmmgenReconciliationService({
      disableUnavailableProviderServices: disable,
    } as never);

    await expect(service.reconcile(snapshot)).resolves.toEqual({
      reconciled: false,
    });
    expect(disable).not.toHaveBeenCalled();
  });

  it('does not report reconciliation after a failed disable write', async () => {
    const disable = jest.fn().mockRejectedValue(new Error('database failure'));
    const service = new SmmgenReconciliationService({
      disableUnavailableProviderServices: disable,
    } as never);

    await expect(
      service.reconcile({ complete: true, providerServiceIds: ['present'] }),
    ).resolves.toEqual({ reconciled: false });
  });
});
