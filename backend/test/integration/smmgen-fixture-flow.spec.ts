import { normalizeSmmgenCapability } from '../../src/modules/catalog/infrastructure/smmgen-capability-normalizer';
import { SmmgenClient } from '../../src/modules/catalog/infrastructure/smmgen.client';
import { SmmgenOrderAdapter } from '../../src/modules/orders/infrastructure/smmgen-order.adapter';
import { SmmgenReconciliationService } from '../../src/modules/catalog/infrastructure/smmgen-reconciliation.service';

describe('SMMGEN fixture-only flow', () => {
  afterEach(() => {
    delete process.env.SMMGEN_API_URL;
    delete process.env.SMMGEN_API_KEY;
  });

  it('runs Standard import, dispatch, status, and reconciliation through fakes only', async () => {
    const service = {
      id: 'fixture-standard-01',
      type: 'Default',
      min: 10,
      max: 1000,
    };
    const capability = normalizeSmmgenCapability(service, service.id);
    expect(capability?.capabilityKey).toBe('STANDARD');

    process.env.SMMGEN_API_URL = 'https://fixture.invalid/provider';
    process.env.SMMGEN_API_KEY = 'fixture-only';
    const catalog = new SmmgenClient(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify([service])),
      }),
    );
    await expect(catalog.fetchServices()).resolves.toMatchObject([
      { externalId: service.id, providerOrigin: 'smmgen' },
    ]);

    const calls: string[] = [];
    const order = new SmmgenOrderAdapter((_url, init) => {
      calls.push(init.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(JSON.stringify({ order: 'fixture-order-01' })),
      });
    });
    await expect(
      order.createOrder({
        offering: {
          offeringId: 'offering-1',
          providerServiceId: 'provider-1',
          providerOrigin: 'smmgen',
          providerServiceExternalId: service.id,
          capability: 'STANDARD',
          contractVersion: 'smmgen-default-v1',
        },
        target: 'https://target.invalid',
        quantity: 10,
        idempotencyContext: 'fixture-fingerprint',
      }),
    ).resolves.toEqual({
      kind: 'accepted',
      externalOrderId: 'fixture-order-01',
    });
    expect(calls).toHaveLength(1);

    const disable = jest.fn().mockResolvedValue({ count: 0 });
    await expect(
      new SmmgenReconciliationService({
        disableUnavailableProviderServices: disable,
      } as never).reconcile({
        complete: true,
        providerServiceIds: ['provider-1'],
      }),
    ).resolves.toEqual({ reconciled: true });
    expect(disable).toHaveBeenCalledWith(['provider-1'], 'smmgen');
  });
});
