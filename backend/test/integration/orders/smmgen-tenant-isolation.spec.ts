import { OrderService } from '../../../src/modules/orders/application/order.service';
import type { OrderRepository } from '../../../src/modules/orders/infrastructure/order.repository';

describe('SMMGEN order tenant isolation', () => {
  it('passes authenticated tenant and user scope to candidate and idempotency reads', async () => {
    const repository = {
      findByKey: jest.fn().mockResolvedValue(null),
      findCandidate: jest.fn().mockResolvedValue(null),
    } as unknown as OrderRepository;
    const service = new OrderService(repository, {
      isReady: () => true,
    } as never);

    await expect(
      service.create(
        { serviceId: 'service-1', target: 'target', quantity: 1 },
        { tenantId: 'tenant-b', userId: 'user-b', role: 'cliente' },
        'key-1234',
      ),
    ).rejects.toThrow('Service not found');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findCandidate).toHaveBeenCalledWith(
      'tenant-b',
      'service-1',
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.findByKey).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-b', userId: 'user-b' }),
    );
  });
});
