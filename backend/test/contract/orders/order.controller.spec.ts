import { Test } from '@nestjs/testing';
import { OrderController } from '../../../src/modules/orders/presentation/order.controller';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import { OrderAuthenticationGuard } from '../../../src/modules/orders/security/order-authentication.guard';
import type { OrderRequest } from '../../../src/modules/orders/security/order-authentication.guard';
import type { Response } from 'express';

describe('OrderController contract', () => {
  it('returns service-selected status and only the safe response shape', async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              statusCode: 202,
              order: {
                id: '1',
                serviceId: 's',
                target: 'https://example.test',
                quantity: 1,
                totalPrice: { amount: 1, currency: 'MXN' },
                status: 'enviando',
                createdAt: new Date(),
              },
            }),
          },
        },
      ],
    })
      .overrideGuard(OrderAuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = module.get(OrderController);
    let body: Record<string, unknown> | undefined;
    const json = jest.fn((value: Record<string, unknown>) => {
      body = value;
    });
    const status = jest.fn().mockReturnValue({ json });
    const response = { status } as unknown as Response;
    await controller.create(
      { serviceId: 's', target: 'https://example.test', quantity: 1 },
      'key-1234',
      {
        principal: { userId: 'u', tenantId: 't', role: 'cliente' },
      } as OrderRequest,
      response,
    );
    expect(status).toHaveBeenCalledWith(202);
    expect(Object.keys(body ?? {})).toEqual([
      'id',
      'serviceId',
      'target',
      'quantity',
      'totalPrice',
      'status',
      'createdAt',
    ]);
  });
});
