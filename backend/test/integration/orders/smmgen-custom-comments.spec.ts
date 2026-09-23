import { SmmgenOrderAdapter } from '../../../src/modules/orders/infrastructure/smmgen-order.adapter';

describe('SMMGEN Custom Comments order safety', () => {
  it('rejects before transport, wallet, or order creation', async () => {
    const transport = jest.fn();
    const adapter = new SmmgenOrderAdapter(transport);
    const result = await adapter.createOrder({
      offering: {
        offeringId: 'offering-comments',
        providerServiceId: 'provider-comments',
        providerOrigin: 'smmgen',
        providerServiceExternalId: 'comments-1',
        capability: 'CUSTOM_COMMENTS',
        contractVersion: 'smmgen-custom-comments-v1',
      },
      target: 'https://target.invalid',
      comments: ['one', 'two'],
      idempotencyContext: 'fixture',
    });

    expect(result).toEqual({
      kind: 'rejected',
      message: 'Unsupported provider capability',
    });
    expect(transport).not.toHaveBeenCalled();
  });
});
