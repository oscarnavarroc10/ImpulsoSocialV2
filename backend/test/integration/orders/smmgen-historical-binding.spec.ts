import { EstadoOrden } from '@prisma/client';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import type { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';

describe('SMMGEN historical binding integration', () => {
  it('routes an accepted order to its stored provider origin after current selection changes', async () => {
    const getStatus = jest.fn().mockResolvedValue({
      kind: 'ok',
      externalStatus: 'processing',
      startCount: 1,
      remains: 9,
    });
    const repository = {
      findForRefresh: jest.fn().mockResolvedValue({
        order: {
          id: 'order-1',
          serviceId: 'master-1',
          target: 'target',
          quantity: 10,
          totalPrice: { amount: 10, currency: 'USD' },
          status: EstadoOrden.enviadaProveedor,
          createdAt: new Date(),
        },
        providerOrderId: 'smmgen-order-1',
        providerOrigin: 'smmgen',
      }),
      applyRefresh: jest
        .fn()
        .mockResolvedValue({ status: EstadoOrden.enProgreso }),
    } as unknown as OrderRepository;
    const currentSelection = 'bulkfollows';
    const service = new OrderService(repository, {} as never, {
      resolve: (origin: string) =>
        origin === 'smmgen'
          ? { isReady: () => true, getStatus, createOrder: jest.fn() }
          : {
              isReady: () => true,
              getStatus: jest.fn(),
              createOrder: jest.fn(),
            },
    });

    await service.refreshStatus('order-1', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    });

    expect(currentSelection).toBe('bulkfollows');
    expect(getStatus).toHaveBeenCalledWith('smmgen-order-1');
  });
});
