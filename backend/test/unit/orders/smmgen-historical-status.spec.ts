import { ServiceUnavailableException } from '@nestjs/common';
import { EstadoOrden } from '@prisma/client';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import type { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';
import type { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';

describe('SMMGEN historical status routing', () => {
  it('resolves status from the stored SMMGEN origin, not current selection', async () => {
    const smmgenStatus = jest.fn().mockResolvedValue({
      kind: 'ok',
      externalStatus: 'processing',
      startCount: 10,
      remains: 2,
    });
    const bulkStatus = jest.fn();
    const repository = {
      findForRefresh: jest.fn().mockResolvedValue({
        order: {
          id: 'order-1',
          serviceId: 'master-1',
          target: 'https://fixture.invalid',
          quantity: 10,
          totalPrice: { amount: 1, currency: 'EUR' },
          status: EstadoOrden.enviadaProveedor,
          createdAt: new Date(),
        },
        providerOrderId: 'smmgen-order-1',
        providerOrigin: 'smmgen',
      }),
      applyRefresh: jest.fn().mockResolvedValue({
        status: EstadoOrden.enProgreso,
      }),
      refund: jest.fn(),
    } as unknown as OrderRepository;
    const resolver = {
      resolve: (origin: string) =>
        origin === 'smmgen'
          ? {
              isReady: () => true,
              getStatus: smmgenStatus,
              createOrder: jest.fn(),
            }
          : {
              isReady: () => true,
              getStatus: bulkStatus,
              createOrder: jest.fn(),
            },
    };
    const service = new OrderService(
      repository,
      {} as BulkFollowsOrderClient,
      resolver,
    );

    await expect(
      service.refreshStatus('order-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({ status: EstadoOrden.enProgreso });
    expect(smmgenStatus).toHaveBeenCalledWith('smmgen-order-1');
    expect(bulkStatus).not.toHaveBeenCalled();
  });

  it('fails closed for an unknown historical provider origin', async () => {
    const repository = {
      findForRefresh: jest.fn().mockResolvedValue({
        order: { status: EstadoOrden.enviadaProveedor, quantity: 1 },
        providerOrderId: 'provider-order-1',
        providerOrigin: 'future-provider',
      }),
    } as unknown as OrderRepository;
    const service = new OrderService(repository, {} as BulkFollowsOrderClient, {
      resolve: () => null,
    });

    await expect(
      service.refreshStatus('order-1', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
