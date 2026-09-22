import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';
import { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';

describe('customer order error contract', () => {
  it('maps foreign or missing reads to a generic not-found error', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: repository },
        { provide: BulkFollowsOrderClient, useValue: {} },
      ],
    }).compile();

    await expect(
      module.get(OrderService).getById('foreign-order', {
        tenantId: 'tenant-a',
        userId: 'user-a',
        role: 'cliente',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps idempotency conflicts typed and provider-agnostic', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue({
        requestFingerprint: 'different',
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: repository },
        { provide: BulkFollowsOrderClient, useValue: {} },
      ],
    }).compile();

    await expect(
      module.get(OrderService).create(
        { serviceId: 'service-1', target: 'https://example.test', quantity: 10 },
        { tenantId: 'tenant-a', userId: 'user-a', role: 'cliente' },
        'key-1234',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
