import { SmmgenReconciliationService } from '../../../src/modules/catalog/infrastructure/smmgen-reconciliation.service';

describe('SMMGEN reconciliation integration boundary', () => {
  it.each([
    [{ complete: false, providerServiceIds: ['present'] }, false],
    [{ complete: true, providerServiceIds: 'partial' }, false],
    [{ complete: true, providerServiceIds: ['present'] }, true],
  ])(
    'only reconciles verified complete evidence',
    async (evidence, reconciled) => {
      const disable = jest.fn().mockResolvedValue({ count: 1 });
      const service = new SmmgenReconciliationService({
        disableUnavailableProviderServices: disable,
      } as never);
      await expect(service.reconcile(evidence)).resolves.toEqual({
        reconciled,
      });
      if (reconciled)
        expect(disable).toHaveBeenCalledWith(['present'], 'smmgen');
      else expect(disable).not.toHaveBeenCalled();
    },
  );

  it('leaves current identity and historical records to their owning repositories', async () => {
    const disable = jest.fn().mockResolvedValue({ count: 1 });
    const service = new SmmgenReconciliationService({
      disableUnavailableProviderServices: disable,
    } as never);
    await service.reconcile({
      complete: true,
      providerServiceIds: ['provider-current'],
    });
    expect(disable).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(disable.mock.calls)).not.toContain('masterService');
    expect(JSON.stringify(disable.mock.calls)).not.toContain('order');
  });
});
