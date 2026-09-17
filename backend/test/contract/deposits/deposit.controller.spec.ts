/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminDepositController,
  DepositController,
} from '../../../src/modules/deposits/presentation/deposit.controller';
import {
  AdminDepositListQueryDto,
  CreateDepositDto,
  DepositMethod,
  RejectDepositDto,
} from '../../../src/modules/deposits/application/dto/deposit.dto';
import { DepositService } from '../../../src/modules/deposits/application/deposit.service';
import {
  DepositAuthenticationGuard,
  DepositPrincipal,
} from '../../../src/modules/deposits/security/deposit-authentication.guard';

const principal: DepositPrincipal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'administradorTienda',
};
const safe = {
  id: 'deposit-1',
  amount: { amount: 500, currency: 'MXN' },
  method: 'transferencia',
  status: 'pendiente',
  paymentReference: 'REF-1',
  receiptUrl: null,
  rejectionReason: null,
  approvedAt: null,
  rejectedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as never;
}

function forbiddenKeys(value: unknown): string[] {
  const forbidden = new Set([
    'tenantId',
    'tiendaId',
    'walletId',
    'billeteraId',
    'proveedorPago',
    'datosProveedor',
    'requestFingerprint',
    'aprobadoPorId',
    'saldoAnterior',
    'saldoPosterior',
    'creadoPorId',
    'token',
    'passwordHash',
  ]);
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(forbiddenKeys);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [key] : []),
    ...forbiddenKeys(child),
  ]);
}

describe('DepositController routes and DTO contract', () => {
  it('exposes all four customer routes and methods', () => {
    expect(Reflect.getMetadata(PATH_METADATA, DepositController)).toBe(
      'v1/deposits',
    );
    expect(
      Reflect.getMetadata(METHOD_METADATA, DepositController.prototype.create),
    ).toBe(1);
    expect(
      Reflect.getMetadata(METHOD_METADATA, DepositController.prototype.list),
    ).toBe(0);
    expect(
      Reflect.getMetadata(METHOD_METADATA, DepositController.prototype.getById),
    ).toBe(0);
    expect(
      Reflect.getMetadata(METHOD_METADATA, DepositController.prototype.cancel),
    ).toBe(1);
    expect(
      Reflect.getMetadata(PATH_METADATA, DepositController.prototype.cancel),
    ).toBe(':id/cancel');
  });

  it('exposes all four admin routes and methods', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AdminDepositController)).toBe(
      'v1/admin/deposits',
    );
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AdminDepositController.prototype.list,
      ),
    ).toBe(0);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AdminDepositController.prototype.getById,
      ),
    ).toBe(0);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AdminDepositController.prototype.approve,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AdminDepositController.prototype.reject,
      ),
    ).toBe(1);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        AdminDepositController.prototype.reject,
      ),
    ).toBe(':id/reject');
  });

  it('applies the deposits guard and bearer metadata to both controller classes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DepositController)).toContain(
      DepositAuthenticationGuard,
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminDepositController),
    ).toContain(DepositAuthenticationGuard);
    expect(
      Reflect.getMetadata('swagger/apiSecurity', DepositController),
    ).toBeDefined();
    expect(
      Reflect.getMetadata('swagger/apiSecurity', AdminDepositController),
    ).toBeDefined();
  });

  it.each([
    [
      { amount: 0, method: 'transferencia', paymentReference: 'abc' },
      'amount lower bound',
    ],
    [
      { amount: 2147483648, method: 'transferencia', paymentReference: 'abc' },
      'amount upper bound',
    ],
    [
      { amount: 1.5, method: 'transferencia', paymentReference: 'abc' },
      'integer amount',
    ],
    [
      { amount: 1, method: 'tarjeta', paymentReference: 'abc' },
      'unsupported method',
    ],
    [
      { amount: 1, method: 'transferencia', paymentReference: 'ab' },
      'reference length',
    ],
    [
      {
        amount: 1,
        method: 'transferencia',
        paymentReference: 'abc',
        receiptUrl: 'http://example.com/a',
      },
      'non-HTTPS receipt',
    ],
  ])('rejects invalid create input: %s', async (input) => {
    const errors = await validate(plainToInstance(CreateDepositDto, input));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('normalizes valid create input and optional empty receipt', async () => {
    const dto = plainToInstance(CreateDepositDto, {
      amount: '500',
      method: 'transferencia',
      paymentReference: ' REF-1 ',
      receiptUrl: ' ',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.amount).toBe(500);
    expect(dto.paymentReference).toBe('REF-1');
    expect(dto.receiptUrl).toBeUndefined();
    expect(DepositMethod.criptomoneda).toBe('criptomoneda');
  });

  it.each([
    [{ page: 0 }, 'page minimum'],
    [{ limit: 101 }, 'limit maximum'],
    [{ status: 'unknown' }, 'status enum'],
    [{ method: 'tarjeta' }, 'method enum'],
    [{ userId: ' ' }, 'admin user id'],
  ])('rejects invalid list query: %s', async (query) => {
    const dto = plainToInstance(AdminDepositListQueryDto, query);
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it('validates rejection reason bounds', async () => {
    expect(
      (await validate(plainToInstance(RejectDepositDto, { reason: ' x ' })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(RejectDepositDto, { reason: ' valid reason ' }),
      ),
    ).toHaveLength(0);
  });
});

describe('DepositController delegation and HTTP status contract', () => {
  function serviceMock() {
    return {
      create: jest.fn().mockResolvedValue({ deposit: safe, statusCode: 201 }),
      list: jest.fn().mockResolvedValue({
        items: [safe],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      getById: jest.fn().mockResolvedValue(safe),
      cancel: jest.fn().mockResolvedValue({ ...safe, status: 'cancelado' }),
      adminList: jest.fn().mockResolvedValue({
        items: [
          {
            ...safe,
            customer: {
              id: 'user-1',
              name: 'Customer',
              email: 'customer@example.com',
            },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
      adminGetById: jest.fn().mockResolvedValue({
        ...safe,
        customer: {
          id: 'user-1',
          name: 'Customer',
          email: 'customer@example.com',
        },
      }),
      approve: jest.fn().mockResolvedValue({ ...safe, status: 'aprobado' }),
      reject: jest.fn().mockResolvedValue({ ...safe, status: 'rechazado' }),
    } as unknown as jest.Mocked<DepositService>;
  }

  it('writes service-selected 201 and replay 200 for create', async () => {
    const service = serviceMock();
    const controller = new DepositController(service);
    const first = response();
    await controller.create(
      {
        amount: 500,
        method: DepositMethod.transferencia,
        paymentReference: 'REF-1',
      },
      'key-1234',
      { principal },
      first,
    );
    expect(first.status).toHaveBeenCalledWith(201);
    (service.create as jest.Mock).mockResolvedValue({
      deposit: safe,
      statusCode: 200,
    });
    const replay = response();
    await controller.create(
      {
        amount: 500,
        method: DepositMethod.transferencia,
        paymentReference: 'REF-1',
      },
      'key-1234',
      { principal },
      replay,
    );
    expect(replay.status).toHaveBeenCalledWith(200);
  });

  it('requires the create header and principal before delegation', async () => {
    const service = serviceMock();
    const controller = new DepositController(service);
    await expect(
      controller.create(
        {} as CreateDepositDto,
        undefined,
        { principal },
        response(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.create({} as CreateDepositDto, 'key-1234', {}, response()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('delegates customer list, detail, and cancel exact inputs', async () => {
    const service = serviceMock();
    const controller = new DepositController(service);
    const query = { page: 2, limit: 10 };
    await controller.list(query, { principal });
    await controller.getById('deposit-1', { principal });
    await controller.cancel('deposit-1', { principal });
    expect(service.list).toHaveBeenCalledWith(query, principal);
    expect(service.getById).toHaveBeenCalledWith('deposit-1', principal);
    expect(service.cancel).toHaveBeenCalledWith('deposit-1', principal);
  });

  it('delegates all admin routes with exact principal and DTOs', async () => {
    const service = serviceMock();
    const controller = new AdminDepositController(service);
    const query = { page: 1, limit: 20, userId: 'user-1' };
    const reason = { reason: 'bad proof' };
    await controller.list(query, { principal });
    await controller.getById('deposit-1', { principal });
    await controller.approve('deposit-1', { principal });
    await controller.reject('deposit-1', reason, { principal });
    expect(service.adminList).toHaveBeenCalledWith(query, principal);
    expect(service.adminGetById).toHaveBeenCalledWith('deposit-1', principal);
    expect(service.approve).toHaveBeenCalledWith('deposit-1', principal);
    expect(service.reject).toHaveBeenCalledWith('deposit-1', reason, principal);
  });

  it('does not delegate when a principal is absent', async () => {
    const service = serviceMock();
    const controller = new AdminDepositController(service);
    await expect(controller.approve('deposit-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.approve).not.toHaveBeenCalled();
  });

  it('maps actual customer and admin responses without forbidden recursive fields', async () => {
    const service = serviceMock();
    const customerController = new DepositController(service);
    const adminController = new AdminDepositController(service);
    const customerResponse = await customerController.getById('deposit-1', {
      principal,
    });
    const adminResponse = await adminController.getById('deposit-1', {
      principal,
    });
    expect(forbiddenKeys(customerResponse)).toEqual([]);
    expect(forbiddenKeys(adminResponse)).toEqual([]);
    expect(adminResponse).toHaveProperty(
      'customer.email',
      'customer@example.com',
    );
  });

  it('publishes response status metadata for all specified contract classes', () => {
    const customerResponse = Reflect.getMetadata(
      'swagger/apiResponse',
      DepositController.prototype.create,
    ) as Record<string, unknown>;
    const adminResponse = Reflect.getMetadata(
      'swagger/apiResponse',
      AdminDepositController.prototype.approve,
    ) as Record<string, unknown>;
    expect(Object.keys(customerResponse)).toEqual(
      expect.arrayContaining(['200', '201', '400', '401', '404', '409', '500']),
    );
    expect(Object.keys(adminResponse)).toEqual(
      expect.arrayContaining(['200', '401', '403', '404', '409', '422', '500']),
    );
  });
});
