import {
  SmmgenClient,
  SmmgenHttpTransport,
} from '../../src/modules/catalog/infrastructure/smmgen.client';
import {
  SmmgenOrderAdapter,
  SmmgenOrderTransport,
} from '../../src/modules/orders/infrastructure/smmgen-order.adapter';

describe('SMMGEN no-live-access guard', () => {
  afterEach(() => {
    delete process.env.SMMGEN_API_URL;
    delete process.env.SMMGEN_API_KEY;
  });

  it('does not invoke the catalog transport without credentials', async () => {
    const transport = jest.fn() as unknown as SmmgenHttpTransport;
    await expect(new SmmgenClient(transport).fetchServices()).rejects.toThrow(
      'SMMGEN provider is unavailable',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not invoke the order transport without credentials', async () => {
    const transport = jest.fn() as unknown as SmmgenOrderTransport;
    const adapter = new SmmgenOrderAdapter(transport);
    await expect(
      adapter.createOrder({
        offering: {
          offeringId: 'offering-1',
          providerServiceId: 'provider-1',
          providerOrigin: 'smmgen',
          providerServiceExternalId: 'fixture-1',
          capability: 'STANDARD',
          contractVersion: 'smmgen-default-v1',
        },
        target: 'target',
        quantity: 10,
        idempotencyContext: 'fixture',
      }),
    ).resolves.toEqual({ kind: 'uncertain', message: 'Provider unavailable' });
    expect(transport).not.toHaveBeenCalled();
  });
});
