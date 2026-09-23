import { BulkFollowsOrderAdapter } from '../../../src/modules/orders/infrastructure/bulkfollows-order.adapter';
import { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';

describe('BulkFollowsOrderAdapter', () => {
  const offering = {
    offeringId: 'offering-1',
    providerServiceId: 'provider-service-1',
    providerOrigin: 'bulkfollows',
    providerServiceExternalId: '123',
    capability: 'STANDARD' as const,
    contractVersion: 'v1',
  };

  it.each([
    [{ kind: 'accepted', orderId: 'provider-order-1' }, { kind: 'accepted', externalOrderId: 'provider-order-1' }],
    [{ kind: 'rejected' }, { kind: 'rejected', message: 'Provider rejected the order' }],
    [{ kind: 'unknown' }, { kind: 'uncertain', message: 'Provider result is unknown' }],
  ])('maps provider result %j without retrying', async (providerResult, expected) => {
    const submit = jest.fn().mockResolvedValue(providerResult);
    const adapter = new BulkFollowsOrderAdapter({ submit, status: jest.fn() } as unknown as BulkFollowsOrderClient);

    await expect(adapter.createOrder({
      offering,
      target: 'https://example.test',
      quantity: 100,
      idempotencyContext: 'fingerprint',
    })).resolves.toEqual(expected);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('fails closed for unsupported capabilities before provider dispatch', async () => {
    const submit = jest.fn();
    const adapter = new BulkFollowsOrderAdapter({ submit, status: jest.fn() } as unknown as BulkFollowsOrderClient);

    await expect(adapter.createOrder({
      offering: { ...offering, capability: 'CUSTOM_COMMENTS' },
      target: 'https://example.test',
      idempotencyContext: 'fingerprint',
    })).resolves.toEqual({ kind: 'rejected', message: 'Unsupported provider capability' });
    expect(submit).not.toHaveBeenCalled();
  });
});
