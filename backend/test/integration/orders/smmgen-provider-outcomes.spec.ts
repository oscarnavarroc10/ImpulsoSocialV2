import { OrderService } from '../../../src/modules/orders/application/order.service';
import type { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';

describe('SMMGEN provider outcome lifecycle', () => {
  it.each([
    [
      'rejected',
      { kind: 'rejected', message: 'Provider rejected' },
      'reembolsada',
      201,
    ],
    [
      'uncertain',
      { kind: 'uncertain', message: 'Provider uncertain' },
      'enviando',
      202,
    ],
  ] as const)(
    'keeps %s outcome single-attempt and provider-neutral',
    async (_label, outcome, expectedStatus, expectedCode) => {
      const order = {
        id: 'order-1',
        serviceId: 'master-1',
        target: 'target',
        quantity: 10,
        totalPrice: { amount: 10, currency: 'USD' },
        status: 'pendiente',
        createdAt: new Date(),
      };
      const repository = {
        findByKey: jest.fn().mockResolvedValue(null),
        findCandidate: jest.fn().mockResolvedValue({
          serviceId: 'master-1',
          externalId: 'smm-1',
          providerOrigin: 'smmgen',
          offeringId: 'offering-1',
          providerServiceId: 'provider-1',
          capabilityKey: 'STANDARD',
          contractVersion: 'smmgen-default-v1',
          min: 1,
          max: 100,
          providerCost: 1,
          providerCurrency: 'USD',
          sellingPrice: 1,
          currency: 'USD',
        }),
        total: jest.fn().mockReturnValue(10),
        createPurchase: jest.fn().mockResolvedValue(order),
        claim: jest.fn().mockResolvedValue(true),
        finalize: jest
          .fn()
          .mockResolvedValue(
            outcome.kind === 'rejected'
              ? { ...order, status: expectedStatus }
              : null,
          ),
      } as unknown as OrderRepository;
      const createOrder = jest.fn().mockResolvedValue(outcome);
      const service = new OrderService(repository, {} as never, {
        resolve: () => ({
          isReady: () => true,
          createOrder,
          getStatus: jest.fn(),
        }),
      });

      const result = await service.create(
        { serviceId: 'master-1', target: 'target', quantity: 10 },
        { userId: 'user-1', tenantId: 'tenant-1', role: 'cliente' },
        'key-1234',
      );

      expect(result.statusCode).toBe(expectedCode);
      expect(result.order.status).toBe(expectedStatus);
      expect(createOrder).toHaveBeenCalledTimes(1);
    },
  );
});
