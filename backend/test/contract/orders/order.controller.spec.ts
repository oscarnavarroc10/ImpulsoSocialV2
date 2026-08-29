import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { OrderController } from '../../../src/modules/orders/presentation/order.controller';
import { OrderService } from '../../../src/modules/orders/application/order.service';
import { OrderAuthenticationGuard } from '../../../src/modules/orders/security/order-authentication.guard';
import type { OrderRequest } from '../../../src/modules/orders/security/order-authentication.guard';
import type { Response } from 'express';

const FORBIDDEN_KEYS = [
  'idempotencyKey',
  'requestFingerprint',
  'costoProveedor',
  'monedaProveedor',
  'proveedor',
  'idExterno',
  'estadoExterno',
  'solicitudOriginal',
  'respuestaOriginal',
  'mensajeError',
  'historialOrden',
  'billeteraId',
  'saldoDisponible',
];

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      expect(FORBIDDEN_KEYS).not.toContain(key);
      assertNoForbiddenKeys(nested);
    }
  }
}

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

describe('OrderController GET routes (contract)', () => {
  let app: INestApplication<App>;
  const orderService = {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
  };
  const principal = { userId: 'user-1', tenantId: 'tenant-1', role: 'cliente' };
  const sampleOrder = {
    id: 'order-1',
    serviceId: 'service-1',
    target: 'https://example.test',
    quantity: 100,
    totalPrice: { amount: 1500, currency: 'MXN' },
    status: 'enviadaProveedor',
    createdAt: new Date('2026-08-29T12:00:00.000Z'),
  };
  const safeKeys = [
    'id',
    'serviceId',
    'target',
    'quantity',
    'totalPrice',
    'status',
    'createdAt',
  ].sort();

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: orderService }],
    })
      .overrideGuard(OrderAuthenticationGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => OrderRequest };
        }) => {
          const httpRequest = context.switchToHttp().getRequest();
          httpRequest.principal = principal;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists orders scoped to the authenticated principal with pagination metadata', async () => {
    orderService.list.mockResolvedValue({
      items: [sampleOrder],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const response = await request(app.getHttpServer())
      .get('/v1/orders?page=1&limit=20')
      .expect(200);

    expect(orderService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      principal,
    );
    const body = response.body as {
      items: Record<string, unknown>[];
      pagination: Record<string, unknown>;
    };
    expect(Object.keys(body).sort()).toEqual(['items', 'pagination']);
    expect(Object.keys(body.items[0]).sort()).toEqual(safeKeys);
    assertNoForbiddenKeys(body);
  });

  it('forwards an optional exact status filter', async () => {
    orderService.list.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app.getHttpServer())
      .get('/v1/orders?status=enviadaProveedor')
      .expect(200);

    expect(orderService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'enviadaProveedor' }),
      principal,
    );
  });

  it('rejects an invalid status value with HTTP 400 and never calls the service', async () => {
    await request(app.getHttpServer())
      .get('/v1/orders?status=not-a-real-status')
      .expect(400);
    expect(orderService.list).not.toHaveBeenCalled();
  });

  it('rejects a limit above the documented maximum with HTTP 400', async () => {
    await request(app.getHttpServer()).get('/v1/orders?limit=101').expect(400);
    expect(orderService.list).not.toHaveBeenCalled();
  });

  it('returns the safe order shape for a scoped detail lookup', async () => {
    orderService.getById.mockResolvedValue(sampleOrder);

    const response = await request(app.getHttpServer())
      .get('/v1/orders/order-1')
      .expect(200);

    expect(orderService.getById).toHaveBeenCalledWith('order-1', principal);
    expect(Object.keys(response.body as object).sort()).toEqual(safeKeys);
    assertNoForbiddenKeys(response.body);
  });

  it('returns a uniform 404 for a missing or foreign order', async () => {
    orderService.getById.mockRejectedValue(
      new NotFoundException('Order not found'),
    );

    await request(app.getHttpServer())
      .get('/v1/orders/missing-or-foreign')
      .expect(404);
  });

  it('never triggers order creation for list/detail requests', async () => {
    orderService.list.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    orderService.getById.mockResolvedValue(sampleOrder);

    await request(app.getHttpServer()).get('/v1/orders').expect(200);
    await request(app.getHttpServer()).get('/v1/orders/order-1').expect(200);

    expect(orderService.create).not.toHaveBeenCalled();
  });

  it('documents bearer auth, response DTOs, and status codes for both GET routes in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Test')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );

    const listOperation = document.paths['/v1/orders']?.get;
    const detailOperation = document.paths['/v1/orders/{id}']?.get;

    expect(listOperation?.responses['200']).toBeDefined();
    expect(listOperation?.responses['400']).toBeDefined();
    expect(listOperation?.responses['401']).toBeDefined();
    expect(detailOperation?.responses['200']).toBeDefined();
    expect(detailOperation?.responses['401']).toBeDefined();
    expect(detailOperation?.responses['404']).toBeDefined();
    expect(listOperation?.security ?? document.security).toEqual(
      expect.anything(),
    );
  });
});
