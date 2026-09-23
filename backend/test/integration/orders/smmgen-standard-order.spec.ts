/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { OrderService } from '../../../src/modules/orders/application/order.service';
import type { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';

describe('SMMGEN Standard order integration boundary', () => {
  it('dispatches canonical target and quantity through the selected SMMGEN adapter', async () => {
    const candidate = {
      serviceId: 'master-1',
      externalId: 'smm-1',
      providerOrigin: 'smmgen',
      offeringId: 'offering-1',
      providerServiceId: 'provider-1',
      capabilityKey: 'STANDARD' as const,
      contractVersion: 'smmgen-default-v1',
      min: 10,
      max: 1000,
      providerCost: 10,
      providerCurrency: 'USD',
      sellingPrice: 25,
      currency: 'USD',
    };
    const order = {
      id: 'order-1',
      serviceId: 'master-1',
      target: 'https://target.invalid',
      quantity: 25,
      totalPrice: { amount: 625, currency: 'USD' },
      status: 'pendiente',
      createdAt: new Date(),
    };
    const repository = {
      findByKey: jest.fn().mockResolvedValue(null),
      findCandidate: jest.fn().mockResolvedValue(candidate),
      total: jest.fn().mockReturnValue(625),
      createPurchase: jest.fn().mockResolvedValue(order),
      claim: jest.fn().mockResolvedValue(true),
      finalize: jest
        .fn()
        .mockResolvedValue({ ...order, status: 'enviadaProveedor' }),
    } as unknown as OrderRepository;
    const createOrder = jest
      .fn()
      .mockResolvedValue({ kind: 'accepted', externalOrderId: 'external-1' });
    const adapter = {
      isReady: jest.fn().mockReturnValue(true),
      createOrder,
      getStatus: jest.fn(),
    };
    const service = new OrderService(
      repository,
      { isReady: jest.fn().mockReturnValue(false) } as never,
      { resolve: jest.fn().mockReturnValue(adapter) },
    );

    const result: unknown = await service.create(
      {
        serviceId: 'master-1',
        target: ' https://target.invalid ',
        quantity: 25,
      },
      { userId: 'user-1', tenantId: 'tenant-1', role: 'cliente' },
      'key-1234',
    );

    expect(result).toMatchObject({ order: { status: 'enviadaProveedor' } });
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'https://target.invalid',
        quantity: 25,
        offering: expect.objectContaining({
          providerOrigin: 'smmgen',
          providerServiceExternalId: 'smm-1',
        }),
      }),
    );
    expect(createOrder).toHaveBeenCalledTimes(1);
  });
});
