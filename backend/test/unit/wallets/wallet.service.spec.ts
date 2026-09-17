/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EstadoUsuario, Prisma, TipoMovimientoSaldo } from '@prisma/client';
import { WalletService } from '../../../src/modules/wallets/application/wallet.service';
import {
  WalletAuthenticationGuard,
  WalletPrincipal,
} from '../../../src/modules/wallets/security/wallet-authentication.guard';
import {
  WalletBalanceOverflowError,
  WalletCreditRaceError,
  WalletRepository,
} from '../../../src/modules/wallets/infrastructure/wallet.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuthTokenService } from '../../../src/modules/auth/application/auth-token.service';
import { SesionRepository } from '../../../src/modules/auth/infrastructure/sesion.repository';
import { UsuarioRepository } from '../../../src/modules/auth/infrastructure/usuario.repository';

const customer: WalletPrincipal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'cliente',
};
const admin: WalletPrincipal = {
  userId: 'admin-1',
  tenantId: 'tenant-1',
  role: 'administradorTienda',
};
const movement = {
  id: 'movement-1',
  tipo: TipoMovimientoSaldo.compra,
  monto: 15000,
  moneda: 'MXN',
  saldoPosterior: 85000,
  descripcion: null,
  creadoEn: new Date('2026-09-10T12:00:00.000Z'),
};
const receipt = {
  id: 'manual-credit:hash',
  userId: 'user-1',
  amount: 50000,
  currency: 'MXN',
  balanceAfter: 150000,
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
  reference: 'manual-credit:fingerprint',
};

function repositoryMock() {
  return {
    findTenantCurrency: jest.fn().mockResolvedValue('MXN'),
    findWallet: jest
      .fn()
      .mockResolvedValue({ balance: 100000, currency: 'MXN' }),
    countMovements: jest.fn().mockResolvedValue(1),
    findMovements: jest.fn().mockResolvedValue([movement]),
    findManualCredit: jest.fn().mockResolvedValue(null),
    targetExists: jest.fn().mockResolvedValue(true),
    createCredit: jest.fn().mockResolvedValue(receipt),
  } as unknown as jest.Mocked<WalletRepository>;
}

function executionContext(request: {
  headers: { authorization?: string };
  principal?: WalletPrincipal;
}) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('WalletAuthenticationGuard', () => {
  it('attaches the current persisted role and scoped principal', async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        sid: 'session-1',
        sub: 'user-1',
        tiendaId: 'tenant-1',
      }),
    } as unknown as AuthTokenService;
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        usuarioId: 'user-1',
        revocadaEn: null,
        expiraEn: new Date(Date.now() + 60000),
      }),
    } as unknown as SesionRepository;
    const users = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        tiendaId: 'tenant-1',
        rol: 'administradorPlataforma',
        estado: EstadoUsuario.activo,
      }),
    } as unknown as UsuarioRepository;
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
    } as unknown as PrismaService;
    const request = { headers: { authorization: 'Bearer token' } };
    const guard = new WalletAuthenticationGuard(
      tokens,
      sessions,
      users,
      prisma,
    );

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(
      true,
    );
    expect(request).toMatchObject({
      principal: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'administradorPlataforma',
      },
    });
  });

  it.each([
    [undefined, 'missing token'],
    ['Basic token', 'wrong scheme'],
  ])('rejects %s', async (authorization) => {
    const guard = new WalletAuthenticationGuard(
      {} as AuthTokenService,
      {} as SesionRepository,
      {} as UsuarioRepository,
      {} as PrismaService,
    );
    await expect(
      guard.canActivate(executionContext({ headers: { authorization } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid or expired access token', async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockRejectedValue(new Error('token detail')),
    } as unknown as AuthTokenService;
    const guard = new WalletAuthenticationGuard(
      tokens,
      {} as SesionRepository,
      {} as UsuarioRepository,
      {} as PrismaService,
    );

    await expect(
      guard.canActivate(
        executionContext({ headers: { authorization: 'Bearer invalid' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    {
      usuarioId: 'user-1',
      revocadaEn: new Date(),
      expiraEn: new Date(Date.now() + 60000),
    },
    {
      usuarioId: 'user-1',
      revocadaEn: null,
      expiraEn: new Date(Date.now() - 60000),
    },
  ])(
    'rejects a revoked or expired session and never attaches a principal',
    async (session) => {
      const tokens = {
        verifyAccessToken: jest.fn().mockResolvedValue({
          sid: 'session-1',
          sub: 'user-1',
          tiendaId: 'tenant-1',
        }),
      } as unknown as AuthTokenService;
      const sessions = {
        findById: jest.fn().mockResolvedValue(session),
      } as unknown as SesionRepository;
      const guard = new WalletAuthenticationGuard(
        tokens,
        sessions,
        {} as UsuarioRepository,
        {} as PrismaService,
      );
      const request = { headers: { authorization: 'Bearer token' } };

      await expect(
        guard.canActivate(executionContext(request)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(request).not.toHaveProperty('principal');
    },
  );

  it.each([
    ['missing session', null],
    [
      'session owned by another user',
      {
        usuarioId: 'other-user',
        revocadaEn: null,
        expiraEn: new Date(Date.now() + 60000),
      },
    ],
  ])('rejects a %s', async (_label, session) => {
    const tokens = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        sid: 'session-1',
        sub: 'user-1',
        tiendaId: 'tenant-1',
      }),
    } as unknown as AuthTokenService;
    const sessions = {
      findById: jest.fn().mockResolvedValue(session),
    } as unknown as SesionRepository;
    const guard = new WalletAuthenticationGuard(
      tokens,
      sessions,
      {} as UsuarioRepository,
      {} as PrismaService,
    );

    await expect(
      guard.canActivate(
        executionContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    [EstadoUsuario.bloqueado, 'tenant-1'],
    [EstadoUsuario.activo, 'other-tenant'],
  ])(
    'rejects a non-active or token-tenant-mismatched user',
    async (estado, tiendaId) => {
      const tokens = {
        verifyAccessToken: jest.fn().mockResolvedValue({
          sid: 'session-1',
          sub: 'user-1',
          tiendaId: 'tenant-1',
        }),
      } as unknown as AuthTokenService;
      const sessions = {
        findById: jest.fn().mockResolvedValue({
          usuarioId: 'user-1',
          revocadaEn: null,
          expiraEn: new Date(Date.now() + 60000),
        }),
      } as unknown as SesionRepository;
      const users = {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          tiendaId,
          rol: 'cliente',
          estado,
        }),
      } as unknown as UsuarioRepository;
      const guard = new WalletAuthenticationGuard(
        tokens,
        sessions,
        users,
        {} as PrismaService,
      );

      await expect(
        guard.canActivate(
          executionContext({ headers: { authorization: 'Bearer token' } }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('rejects an inactive tenant', async () => {
    const tokens = {
      verifyAccessToken: jest.fn().mockResolvedValue({
        sid: 'session-1',
        sub: 'user-1',
        tiendaId: 'tenant-1',
      }),
    } as unknown as AuthTokenService;
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        usuarioId: 'user-1',
        revocadaEn: null,
        expiraEn: new Date(Date.now() + 60000),
      }),
    } as unknown as SesionRepository;
    const users = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        tiendaId: 'tenant-1',
        rol: 'cliente',
        estado: EstadoUsuario.activo,
      }),
    } as unknown as UsuarioRepository;
    const prisma = {
      tienda: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const guard = new WalletAuthenticationGuard(
      tokens,
      sessions,
      users,
      prisma,
    );

    await expect(
      guard.canActivate(
        executionContext({ headers: { authorization: 'Bearer token' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('WalletService', () => {
  it('returns only the approved balance and movement fields with stable pagination', async () => {
    const repository = repositoryMock();
    const service = new WalletService(repository);
    await expect(service.getBalance(customer)).resolves.toEqual({
      balance: { amount: 100000, currency: 'MXN' },
    });
    await expect(
      service.listMovements(
        { page: 2, limit: 10, type: TipoMovimientoSaldo.compra },
        customer,
      ),
    ).resolves.toEqual({
      items: [
        {
          id: 'movement-1',
          type: 'compra',
          amount: { amount: 15000, currency: 'MXN' },
          balanceAfter: { amount: 85000, currency: 'MXN' },
          description: null,
          createdAt: movement.creadoEn,
        },
      ],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
    expect(repository.findMovements).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', userId: 'user-1', currency: 'MXN' },
      TipoMovimientoSaldo.compra,
      10,
      10,
    );
  });

  it('rejects missing canonical wallets uniformly', async () => {
    const repository = repositoryMock();
    repository.findWallet.mockResolvedValue(null);
    const service = new WalletService(repository);
    await expect(service.getBalance(customer)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks customers before target lookup or writes', async () => {
    const repository = repositoryMock();
    const service = new WalletService(repository);
    await expect(
      service.credit({ userId: 'user-1', amount: 500 }, 'valid-key', customer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findTenantCurrency).not.toHaveBeenCalled();
    expect(repository.createCredit).not.toHaveBeenCalled();
  });

  it('rejects invalid idempotency keys as HTTP 400 before repository access', async () => {
    const repository = repositoryMock();
    const service = new WalletService(repository);

    await expect(
      service.credit({ userId: 'user-1', amount: 500 }, 'short', admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findTenantCurrency).not.toHaveBeenCalled();
    expect(repository.findManualCredit).not.toHaveBeenCalled();
    expect(repository.targetExists).not.toHaveBeenCalled();
    expect(repository.createCredit).not.toHaveBeenCalled();
  });

  it('creates a credit once, replays it, and conflicts on a different payload', async () => {
    const repository = repositoryMock();
    const service = new WalletService(repository);
    const keyHash = createHash('sha256')
      .update(JSON.stringify(['tenant-1', 'credit-key']))
      .digest('hex');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(['user-1', 50000]))
      .digest('hex');
    await expect(
      service.credit({ userId: 'user-1', amount: 50000 }, 'credit-key', admin),
    ).resolves.toMatchObject({
      statusCode: 201,
      receipt: { userId: 'user-1', amount: { amount: 50000, currency: 'MXN' } },
    });
    expect(repository.createCredit).toHaveBeenCalledWith({
      movementId: `manual-credit:${keyHash}`,
      tenantId: 'tenant-1',
      userId: 'admin-1',
      targetUserId: 'user-1',
      amount: 50000,
      currency: 'MXN',
      fingerprint,
      createdById: 'admin-1',
    });
    expect(
      JSON.stringify(repository.createCredit.mock.calls[0]?.[0]),
    ).not.toContain('credit-key');
    repository.findManualCredit.mockResolvedValue({
      ...receipt,
      reference: `manual-credit:${fingerprint}`,
    });
    await expect(
      service.credit({ userId: 'user-1', amount: 50000 }, 'credit-key', admin),
    ).resolves.toMatchObject({ statusCode: 200 });
    await expect(
      service.credit({ userId: 'user-2', amount: 50000 }, 'credit-key', admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createCredit).toHaveBeenCalledTimes(1);
  });

  it('reloads the winning movement after a deterministic P2002 race', async () => {
    const repository = repositoryMock();
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(['user-1', 50000]))
      .digest('hex');
    repository.createCredit.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate movement', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    repository.findManualCredit
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...receipt,
        reference: `manual-credit:${fingerprint}`,
      });
    const service = new WalletService(repository);

    await expect(
      service.credit({ userId: 'user-1', amount: 50000 }, 'race-key', admin),
    ).resolves.toMatchObject({ statusCode: 200 });
    expect(repository.createCredit).toHaveBeenCalledTimes(1);
    expect(repository.findManualCredit).toHaveBeenCalledTimes(2);
  });

  it('conflicts when a P2002 winner has a different request fingerprint', async () => {
    const repository = repositoryMock();
    repository.createCredit.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate movement', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    repository.findManualCredit
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...receipt,
        reference: 'manual-credit:different-fingerprint',
      });
    const service = new WalletService(repository);

    await expect(
      service.credit({ userId: 'user-1', amount: 50000 }, 'race-key', admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createCredit).toHaveBeenCalledTimes(1);
  });

  it('maps Prisma P2034 transaction conflicts to a sanitized HTTP 409', async () => {
    const repository = repositoryMock();
    repository.createCredit.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('database detail', {
        code: 'P2034',
        clientVersion: 'test',
      }),
    );
    const service = new WalletService(repository);

    await expect(
      service.credit({ userId: 'user-1', amount: 50000 }, 'race-key', admin),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Wallet changed; retry with the same key',
    });
  });

  it('maps missing targets, overflow, and wallet races without leaking internals', async () => {
    const repository = repositoryMock();
    const service = new WalletService(repository);
    repository.targetExists.mockResolvedValue(false);
    await expect(
      service.credit({ userId: 'foreign', amount: 500 }, 'credit-key', admin),
    ).rejects.toBeInstanceOf(NotFoundException);
    repository.targetExists.mockResolvedValue(true);
    repository.createCredit.mockRejectedValueOnce(
      new WalletBalanceOverflowError(),
    );
    await expect(
      service.credit({ userId: 'user-1', amount: 500 }, 'other-key', admin),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    repository.createCredit.mockRejectedValueOnce(new WalletCreditRaceError());
    await expect(
      service.credit({ userId: 'user-1', amount: 500 }, 'third-key', admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('WalletRepository credit transaction', () => {
  it('creates the exact audit movement and conditionally increments the scoped wallet', async () => {
    const tx = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      billetera: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'wallet-1', saldoDisponible: 100000 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      movimientoSaldo: {
        create: jest.fn().mockResolvedValue({
          id: 'manual-credit:key',
          monto: 50000,
          saldoPosterior: 150000,
          creadoEn: new Date(),
          referencia: 'manual-credit:fingerprint',
          billetera: {
            usuarioId: 'user-1',
            moneda: 'MXN',
            tiendaId: 'tenant-1',
          },
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const repository = new WalletRepository(prisma);
    const result = await repository.createCredit({
      movementId: 'manual-credit:key',
      tenantId: 'tenant-1',
      userId: 'admin-1',
      targetUserId: 'user-1',
      amount: 50000,
      currency: 'MXN',
      fingerprint: 'fingerprint',
      createdById: 'admin-1',
    });

    expect(result.balanceAfter).toBe(150000);
    expect(tx.tienda.findFirst).toHaveBeenCalledWith({
      where: { id: 'tenant-1', activa: true, moneda: 'MXN' },
      select: { id: true },
    });
    expect(tx.usuario.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        tiendaId: 'tenant-1',
        estado: 'activo',
      },
      select: { id: true },
    });
    const movementCall = (
      tx.movimientoSaldo.create.mock.calls as unknown[][]
    )[0]?.[0];
    expect(movementCall).toMatchObject({
      data: {
        tipo: TipoMovimientoSaldo.ajusteCredito,
        saldoAnterior: 100000,
        saldoPosterior: 150000,
        referencia: 'manual-credit:fingerprint',
        creadoPorId: 'admin-1',
      },
    });
    const walletCall = (
      tx.billetera.updateMany.mock.calls as unknown[][]
    )[0]?.[0];
    expect(walletCall).toMatchObject({
      where: {
        tiendaId: 'tenant-1',
        usuarioId: 'user-1',
        moneda: 'MXN',
        saldoDisponible: 100000,
      },
    });
  });

  it('rolls back on a conditional wallet race', async () => {
    const tx = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      billetera: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'wallet-1', saldoDisponible: 100000 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      movimientoSaldo: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    await expect(
      new WalletRepository(prisma).createCredit({
        movementId: 'manual-credit:key',
        tenantId: 'tenant-1',
        userId: 'admin-1',
        targetUserId: 'user-1',
        amount: 50000,
        currency: 'MXN',
        fingerprint: 'fingerprint',
        createdById: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(WalletCreditRaceError);
    expect(tx.movimientoSaldo.create).toHaveBeenCalledTimes(1);
  });

  it('rejects integer overflow before creating a movement or updating the wallet', async () => {
    const tx = {
      tienda: { findFirst: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      usuario: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      billetera: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          saldoDisponible: 2147483647,
        }),
        updateMany: jest.fn(),
      },
      movimientoSaldo: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      new WalletRepository(prisma).createCredit({
        movementId: 'manual-credit:key',
        tenantId: 'tenant-1',
        userId: 'admin-1',
        targetUserId: 'user-1',
        amount: 1,
        currency: 'MXN',
        fingerprint: 'fingerprint',
        createdById: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(WalletBalanceOverflowError);
    expect(tx.movimientoSaldo.create).not.toHaveBeenCalled();
    expect(tx.billetera.updateMany).not.toHaveBeenCalled();
  });
});
