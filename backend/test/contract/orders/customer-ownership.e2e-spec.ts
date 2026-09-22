import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';
import { BulkFollowsOrderClient } from '../../../src/modules/orders/infrastructure/bulkfollows-order.client';

describe('customer order ownership contract', () => {
  it('passes both tenant and user scope to order reads', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findById: jest.fn().mockResolvedValue(null),
    };
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: OrderRepository, useValue: repository },
        { provide: BulkFollowsOrderClient, useValue: {} },
      ],
    }).compile();
    const service = module.get(OrderService);
    const principal = { tenantId: 'tenant-a', userId: 'user-a', role: 'cliente' as const };

    await expect(service.list({}, principal)).resolves.toMatchObject({ items: [] });
    await expect(service.getById('foreign-order', principal)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findMany).toHaveBeenCalledWith('tenant-a', 'user-a', expect.any(Object), 0, 20);
    expect(repository.count).toHaveBeenCalledWith('tenant-a', 'user-a', expect.any(Object));
    expect(repository.findById).toHaveBeenCalledWith('tenant-a', 'user-a', 'foreign-order');
  });
});
