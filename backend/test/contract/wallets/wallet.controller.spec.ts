/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TipoMovimientoSaldo } from '@prisma/client';
import {
  AdminWalletCreditController,
  WalletController,
} from '../../../src/modules/wallets/presentation/wallet.controller';
import {
  WalletCreditDto,
  WalletMovementQueryDto,
} from '../../../src/modules/wallets/application/dto/wallet.dto';
import { WalletService } from '../../../src/modules/wallets/application/wallet.service';
import { WalletPrincipal } from '../../../src/modules/wallets/security/wallet-authentication.guard';

const principal: WalletPrincipal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'administradorTienda',
};
const safeReceipt = {
  id: 'manual-credit:hash',
  userId: 'user-1',
  amount: { amount: 50000, currency: 'MXN' },
  balanceAfter: { amount: 150000, currency: 'MXN' },
  createdAt: new Date(),
};

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as never;
}

function forbiddenKeys(value: unknown): string[] {
  const forbidden = new Set([
    'walletId',
    'billeteraId',
    'tenantId',
    'creadoPorId',
    'referencia',
    'saldoAnterior',
    'requestFingerprint',
    'idempotencyKey',
    'passwordHash',
    'token',
  ]);
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(forbiddenKeys);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [key] : []),
    ...forbiddenKeys(child),
  ]);
}

describe('Wallet controllers', () => {
  it('expose the required routes and HTTP methods', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WalletController)).toBe(
      'v1/wallet',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, AdminWalletCreditController),
    ).toBe('v1/admin/wallet-credits');
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        WalletController.prototype.getBalance,
      ),
    ).toBe(0);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        WalletController.prototype.listMovements,
      ),
    ).toBe(0);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        AdminWalletCreditController.prototype.credit,
      ),
    ).toBe(1);
  });

  it('validates pagination, enum filters, trimmed target and integer bounds', async () => {
    const invalidQuery = plainToInstance(WalletMovementQueryDto, {
      page: 0,
      limit: 101,
      type: 'invalid',
    });
    expect((await validate(invalidQuery)).length).toBeGreaterThan(0);
    const invalidCredit = plainToInstance(WalletCreditDto, {
      userId: ' ',
      amount: 1.5,
    });
    expect((await validate(invalidCredit)).length).toBeGreaterThan(0);
    const validCredit = plainToInstance(WalletCreditDto, {
      userId: ' user-1 ',
      amount: 500,
    });
    expect((await validate(validCredit)).length).toBe(0);
    expect(validCredit.userId).toBe('user-1');
    expect(TipoMovimientoSaldo.compra).toBe('compra');
  });

  it('delegates admin credits and writes service-selected 201 or 200 without private fields', async () => {
    const service = {
      credit: jest
        .fn()
        .mockResolvedValue({ receipt: safeReceipt, statusCode: 201 }),
    } as unknown as WalletService;
    const controller = new AdminWalletCreditController(service);
    const firstResponse = response();
    await controller.credit(
      { userId: 'user-1', amount: 50000 },
      'credit-key',
      { principal },
      firstResponse,
    );
    expect(service.credit).toHaveBeenCalledWith(
      { userId: 'user-1', amount: 50000 },
      'credit-key',
      principal,
    );
    expect(firstResponse.status).toHaveBeenCalledWith(201);
    expect(firstResponse.json).toHaveBeenCalledWith(safeReceipt);
    expect(forbiddenKeys(safeReceipt)).toEqual([]);

    (service.credit as jest.Mock).mockResolvedValue({
      receipt: safeReceipt,
      statusCode: 200,
    });
    const replayResponse = response();
    await controller.credit(
      { userId: 'user-1', amount: 50000 },
      'credit-key',
      { principal },
      replayResponse,
    );
    expect(replayResponse.status).toHaveBeenCalledWith(200);
  });

  it('requires the idempotency header and authenticated principal', async () => {
    const service = { credit: jest.fn() } as unknown as WalletService;
    const controller = new AdminWalletCreditController(service);
    await expect(
      controller.credit(
        { userId: 'user-1', amount: 500 },
        undefined,
        { principal },
        response(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.credit(
        { userId: 'user-1', amount: 500 },
        'credit-key',
        {},
        response(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.credit).not.toHaveBeenCalled();
  });

  it('returns safe wallet read responses and forwards movement query', async () => {
    const service = {
      getBalance: jest
        .fn()
        .mockResolvedValue({ balance: { amount: 100000, currency: 'MXN' } }),
      listMovements: jest.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    } as unknown as WalletService;
    const controller = new WalletController(service);
    await expect(controller.getBalance({ principal })).resolves.toEqual({
      balance: { amount: 100000, currency: 'MXN' },
    });
    await expect(
      controller.listMovements({ page: 1, limit: 20 }, { principal }),
    ).resolves.toMatchObject({ pagination: { page: 1, limit: 20 } });
    expect(service.listMovements).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      principal,
    );
  });
});
