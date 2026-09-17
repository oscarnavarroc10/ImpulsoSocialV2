/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoDeposito, TipoMovimientoSaldo } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DepositService } from '../../../src/modules/deposits/application/deposit.service';
import {
  DepositAuthenticationGuard,
  DepositPrincipal,
} from '../../../src/modules/deposits/security/deposit-authentication.guard';
import {
  DepositBalanceOverflowError,
  DepositDecisionRaceError,
  DepositRepository,
  DepositWalletRaceError,
} from '../../../src/modules/deposits/infrastructure/deposit.repository';
import { DepositMethod } from '../../../src/modules/deposits/application/dto/deposit.dto';
import { AuthTokenService } from '../../../src/modules/auth/application/auth-token.service';
import { SesionRepository } from '../../../src/modules/auth/infrastructure/sesion.repository';
import { UsuarioRepository } from '../../../src/modules/auth/infrastructure/usuario.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const customer: DepositPrincipal = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'cliente',
};
const admin: DepositPrincipal = {
  userId: 'admin-1',
  tenantId: 'tenant-1',
  role: 'administradorTienda',
};
const base = {
  id: 'deposit-request:hash',
  tenantId: 'tenant-1',
  walletId: 'wallet-1',
  userId: 'user-1',
  amount: 50000,
  currency: 'MXN',
  method: 'transferencia' as const,
  status: EstadoDeposito.pendiente,
  provider: 'manual-transfer',
  reference: 'SPEI-ABC',
  receiptUrl: null,
  providerData: { kind: 'manual-deposit-request', requestFingerprint: 'fp' },
  approvedById: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdAt: new Date('2026-09-17T12:00:00.000Z'),
  updatedAt: new Date('2026-09-17T12:00:00.000Z'),
  customer: { id: 'user-1', name: 'Customer', email: 'customer@example.com' },
};

function repositoryMock(): jest.Mocked<DepositRepository> {
  return {
    findTenantCurrency: jest.fn().mockResolvedValue('MXN'),
    findCanonicalWallet: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
    findCreationClaim: jest.fn().mockResolvedValue(null),
    findByEvidence: jest.fn().mockResolvedValue(null),
    createPending: jest.fn().mockResolvedValue(base),
    countOwn: jest.fn().mockResolvedValue(1),
    listOwn: jest.fn().mockResolvedValue([base]),
    findOwnById: jest.fn().mockResolvedValue(base),
    cancelOwnPending: jest.fn().mockResolvedValue(1),
    countAdmin: jest.fn().mockResolvedValue(1),
    listAdmin: jest.fn().mockResolvedValue([base]),
    findAdminById: jest.fn().mockResolvedValue(base),
    approve: jest.fn().mockResolvedValue({
      ...base,
      status: EstadoDeposito.aprobado,
      approvedAt: new Date('2026-09-17T12:01:00.000Z'),
    }),
    reject: jest.fn().mockResolvedValue(1),
    findApprovalInvariant: jest.fn().mockResolvedValue({
      deposit: {
        id: base.id,
        walletId: base.walletId,
        amount: base.amount,
        status: EstadoDeposito.aprobado,
        tenantId: base.tenantId,
      },
      movement: {
        id: `deposit-credit:${base.id}`,
        walletId: base.walletId,
        type: TipoMovimientoSaldo.deposito,
        amount: base.amount,
        reference: base.id,
        balanceAfter: 50000,
      },
    }),
  } as unknown as jest.Mocked<DepositRepository>;
}

function executionContext(request: { headers: { authorization?: string } }) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('DepositAuthenticationGuard', () => {
  function guardFor(
    overrides: {
      token?: unknown;
      session?: unknown;
      user?: unknown;
      tenant?: unknown;
    } = {},
  ) {
    const tokens = {
      verifyAccessToken:
        overrides.token instanceof Error
          ? jest.fn().mockRejectedValue(overrides.token)
          : jest.fn().mockResolvedValue(
              overrides.token !== undefined
                ? overrides.token
                : {
                    sid: 'session-1',
                    sub: 'user-1',
                    tiendaId: 'tenant-1',
                    rol: 'cliente',
                  },
            ),
    } as unknown as AuthTokenService;
    const sessions = {
      findById: jest.fn().mockResolvedValue(
        overrides.session !== undefined
          ? overrides.session
          : {
              usuarioId: 'user-1',
              revocadaEn: null,
              expiraEn: new Date('2099-01-01'),
            },
      ),
    } as unknown as SesionRepository;
    const users = {
      findById: jest.fn().mockResolvedValue(
        overrides.user !== undefined
          ? overrides.user
          : {
              id: 'user-1',
              tiendaId: 'tenant-1',
              rol: 'administradorPlataforma',
              estado: 'activo',
            },
      ),
    } as unknown as UsuarioRepository;
    const prisma = {
      tienda: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            overrides.tenant !== undefined
              ? overrides.tenant
              : { id: 'tenant-1' },
          ),
      },
    } as unknown as PrismaService;
    return new DepositAuthenticationGuard(tokens, sessions, users, prisma);
  }

  it('uses the current persisted role instead of the JWT role', async () => {
    const request = {
      headers: { authorization: ['Bearer', 'dummy'].join(' ') },
    };
    await expect(
      guardFor().canActivate(executionContext(request)),
    ).resolves.toBe(true);
    expect(request).toMatchObject({
      principal: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'administradorPlataforma',
      },
    });
  });

  it.each([
    [undefined, 'missing bearer'],
    ['Basic token', 'wrong bearer scheme'],
  ])('rejects %s with generic 401', async (authorization) => {
    await expect(
      guardFor().canActivate(executionContext({ headers: { authorization } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid or expired token', async () => {
    await expect(
      guardFor({ token: new Error('secret detail') }).canActivate(
        executionContext({
          headers: { authorization: ['Bearer', 'dummy'].join(' ') },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    [null, 'missing session'],
    [
      {
        usuarioId: 'other',
        revocadaEn: null,
        expiraEn: new Date('2099-01-01'),
      },
      'mismatched session',
    ],
    [
      {
        usuarioId: 'user-1',
        revocadaEn: new Date(),
        expiraEn: new Date('2099-01-01'),
      },
      'revoked session',
    ],
    [
      {
        usuarioId: 'user-1',
        revocadaEn: null,
        expiraEn: new Date('2020-01-01'),
      },
      'expired session',
    ],
  ])('rejects a %s', async (session) => {
    await expect(
      guardFor({ session }).canActivate(
        executionContext({
          headers: { authorization: ['Bearer', 'dummy'].join(' ') },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    [
      {
        id: 'user-1',
        tiendaId: 'tenant-1',
        rol: 'cliente',
        estado: 'bloqueado',
      },
      'inactive user',
    ],
    [
      { id: 'user-1', tiendaId: 'other', rol: 'cliente', estado: 'activo' },
      'mismatched user tenant',
    ],
  ])('rejects a %s', async (user) => {
    await expect(
      guardFor({ user }).canActivate(
        executionContext({
          headers: { authorization: ['Bearer', 'dummy'].join(' ') },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive tenant', async () => {
    await expect(
      guardFor({ tenant: null }).canActivate(
        executionContext({
          headers: { authorization: ['Bearer', 'dummy'].join(' ') },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('DepositService', () => {
  it('rejects customer admin access before any repository lookup', async () => {
    const repository = repositoryMock();
    await expect(
      new DepositService(repository).adminList({}, customer),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findTenantCurrency).not.toHaveBeenCalled();
    expect(repository.findAdminById).not.toHaveBeenCalled();
  });

  it.each(['administradorTienda', 'administradorPlataforma'])(
    'allows the persisted %s role only through current tenant scope',
    async (role) => {
      const repository = repositoryMock();
      const principal = { ...admin, role };
      await expect(
        new DepositService(repository).adminList({}, principal),
      ).resolves.toMatchObject({ pagination: { total: 1 } });
      expect(repository.listAdmin).toHaveBeenCalledWith(
        'tenant-1',
        'MXN',
        { status: undefined, method: undefined, userId: undefined },
        0,
        20,
      );
    },
  );

  it('rejects an invalid key before repository access', async () => {
    const repository = repositoryMock();
    await expect(
      new DepositService(repository).create(
        {
          amount: 1,
          method: DepositMethod.transferencia,
          paymentReference: 'abc',
        },
        'short',
        customer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findTenantCurrency).not.toHaveBeenCalled();
  });

  it('normalizes fields and computes the exact canonical hashes without raw key', async () => {
    const repository = repositoryMock();
    const dto = {
      amount: 500,
      method: DepositMethod.transferencia,
      paymentReference: '  REF-123  ',
      receiptUrl: ' https://example.com/proof ',
    };
    const key = '  key-1234  ';
    await new DepositService(repository).create(dto, key, customer);
    const normalizedKey = 'key-1234';
    const keyHash = createHash('sha256')
      .update(JSON.stringify(['tenant-1', 'user-1', normalizedKey]))
      .digest('hex');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          500,
          'transferencia',
          'REF-123',
          'https://example.com/proof',
        ]),
      )
      .digest('hex');
    expect(repository.findCreationClaim).toHaveBeenCalledWith(
      `deposit-request:${keyHash}`,
      'tenant-1',
      'user-1',
    );
    expect(repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `deposit-request:${keyHash}`,
        provider: 'manual-transfer',
        reference: 'REF-123',
        receiptUrl: 'https://example.com/proof',
        fingerprint,
      }),
    );
    expect(
      JSON.stringify(repository.createPending.mock.calls[0]),
    ).not.toContain(key);
  });

  it('creates a transfer request with no wallet or movement operation', async () => {
    const repository = repositoryMock();
    const result = await new DepositService(repository).create(
      {
        amount: 500,
        method: DepositMethod.transferencia,
        paymentReference: 'abc',
      },
      'key-1234',
      customer,
    );
    expect(result.statusCode).toBe(201);
    expect(result.deposit).not.toHaveProperty('walletId');
    expect(repository.createPending).toHaveBeenCalledTimes(1);
  });

  it('creates a crypto request with a nullable receipt', async () => {
    const repository = repositoryMock();
    await new DepositService(repository).create(
      {
        amount: 500,
        method: DepositMethod.criptomoneda,
        paymentReference: 'crypto-ref',
      },
      'key-1234',
      customer,
    );
    expect(repository.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'manual-crypto', receiptUrl: null }),
    );
  });

  it('replays the same key and request with HTTP 200', async () => {
    const repository = repositoryMock();
    const expectedFingerprint = createHash('sha256')
      .update(JSON.stringify([500, 'transferencia', 'abc', null]))
      .digest('hex');
    repository.findCreationClaim.mockResolvedValue({
      ...base,
      providerData: {
        kind: 'manual-deposit-request',
        requestFingerprint: expectedFingerprint,
      },
    });
    const result = await new DepositService(repository).create(
      {
        amount: 500,
        method: DepositMethod.transferencia,
        paymentReference: 'abc',
      },
      'key-1234',
      customer,
    );
    expect(result.statusCode).toBe(200);
    expect(repository.createPending).not.toHaveBeenCalled();
  });

  it.each([
    [501, DepositMethod.transferencia, 'abc', undefined, 'amount'],
    [500, DepositMethod.criptomoneda, 'abc', undefined, 'method'],
    [500, DepositMethod.transferencia, 'changed', undefined, 'reference'],
    [
      500,
      DepositMethod.transferencia,
      'abc',
      'https://example.com/a',
      'receipt',
    ],
  ])(
    'conflicts when the %s fingerprint component changes',
    async (amount, method, reference, receiptUrl) => {
      const repository = repositoryMock();
      repository.findCreationClaim.mockResolvedValue(base);
      await expect(
        new DepositService(repository).create(
          { amount, method, paymentReference: reference, receiptUrl },
          'key-1234',
          customer,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('maps a P2002 winner to same-key replay', async () => {
    const repository = repositoryMock();
    repository.createPending.mockRejectedValue({ code: 'P2002' });
    const expected = createHash('sha256')
      .update(JSON.stringify([500, 'transferencia', 'abc', null]))
      .digest('hex');
    repository.findCreationClaim
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...base,
        providerData: {
          kind: 'manual-deposit-request',
          requestFingerprint: expected,
        },
      });
    await expect(
      new DepositService(repository).create(
        {
          amount: 500,
          method: DepositMethod.transferencia,
          paymentReference: 'abc',
        },
        'key-1234',
        customer,
      ),
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  it('maps P2002 fingerprint conflict and duplicate evidence to 409', async () => {
    const repository = repositoryMock();
    repository.createPending.mockRejectedValue({ code: 'P2002' });
    repository.findCreationClaim
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(base);
    await expect(
      new DepositService(repository).create(
        {
          amount: 500,
          method: DepositMethod.transferencia,
          paymentReference: 'abc',
        },
        'key-1234',
        customer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    repository.findCreationClaim.mockResolvedValue(null);
    repository.findByEvidence.mockResolvedValue(base);
    await expect(
      new DepositService(repository).create(
        {
          amount: 500,
          method: DepositMethod.transferencia,
          paymentReference: 'abc',
        },
        'other-key',
        customer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps an unclassified P2002 creation failure to a generic 500', async () => {
    const repository = repositoryMock();
    repository.createPending.mockRejectedValue({
      code: 'P2002',
      message: 'private database detail',
    });
    await expect(
      new DepositService(repository).create(
        {
          amount: 500,
          method: DepositMethod.transferencia,
          paymentReference: 'abc',
        },
        'key-1234',
        customer,
      ),
    ).rejects.toMatchObject({
      status: 500,
      message: 'Deposit creation failed',
    });
  });

  it('lists safely with tenant owner currency filters and empty pagination', async () => {
    const repository = repositoryMock();
    repository.listOwn.mockResolvedValue([]);
    repository.countOwn.mockResolvedValue(0);
    await expect(
      new DepositService(repository).list(
        {
          page: 2,
          limit: 100,
          status: EstadoDeposito.pendiente,
          method: DepositMethod.transferencia,
        },
        customer,
      ),
    ).resolves.toEqual({
      items: [],
      pagination: { page: 2, limit: 100, total: 0, totalPages: 0 },
    });
    expect(repository.listOwn).toHaveBeenCalledWith(
      { tenantId: 'tenant-1', userId: 'user-1', currency: 'MXN' },
      { status: EstadoDeposito.pendiente, method: DepositMethod.transferencia },
      100,
      100,
    );
  });

  it('returns uniform 404 for a foreign or missing own detail', async () => {
    const repository = repositoryMock();
    repository.findOwnById.mockResolvedValue(null);
    await expect(
      new DepositService(repository).getById('foreign', customer),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [{ method: 'tarjeta', provider: 'card' }, 'unsupported method'],
    [
      { method: DepositMethod.transferencia, provider: 'wrong-provider' },
      'mismatched provider',
    ],
    [{ reference: null }, 'missing payment reference'],
  ])('fails closed when a repository row has %s', async (override) => {
    const repository = repositoryMock();
    repository.listOwn.mockResolvedValue([{ ...base, ...override } as never]);
    await expect(
      new DepositService(repository).list({}, customer),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it.each([
    [EstadoDeposito.cancelado, true],
    [EstadoDeposito.aprobado, false],
    [EstadoDeposito.rechazado, false],
  ])(
    'handles cancellation state %s without monetary calls',
    async (status, replay) => {
      const repository = repositoryMock();
      repository.findOwnById.mockResolvedValue({ ...base, status });
      if (replay)
        await expect(
          new DepositService(repository).cancel(base.id, customer),
        ).resolves.toMatchObject({ status });
      else
        await expect(
          new DepositService(repository).cancel(base.id, customer),
        ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.cancelOwnPending).not.toHaveBeenCalled();
    },
  );

  it('reloads a cancellation race and returns the committed cancellation', async () => {
    const repository = repositoryMock();
    repository.cancelOwnPending.mockResolvedValue(0);
    repository.findOwnById
      .mockResolvedValueOnce(base)
      .mockResolvedValueOnce({ ...base, status: EstadoDeposito.cancelado });
    await expect(
      new DepositService(repository).cancel(base.id, customer),
    ).resolves.toMatchObject({ status: EstadoDeposito.cancelado });
  });

  it('approves once with the current admin and maps terminal conflicts', async () => {
    const repository = repositoryMock();
    await expect(
      new DepositService(repository).approve(base.id, admin),
    ).resolves.toMatchObject({ status: EstadoDeposito.aprobado });
    expect(repository.approve).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      depositId: base.id,
      adminId: 'admin-1',
      currency: 'MXN',
    });
    repository.findAdminById.mockResolvedValue({
      ...base,
      status: EstadoDeposito.cancelado,
    });
    await expect(
      new DepositService(repository).approve(base.id, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates an approved replay invariant and fails closed when it is missing', async () => {
    const repository = repositoryMock();
    repository.findAdminById.mockResolvedValue({
      ...base,
      status: EstadoDeposito.aprobado,
    });
    repository.findApprovalInvariant.mockResolvedValue(null);
    await expect(
      new DepositService(repository).approve(base.id, admin),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(repository.approve).not.toHaveBeenCalled();
  });

  it('returns a valid approved replay without a second write', async () => {
    const repository = repositoryMock();
    repository.findAdminById.mockResolvedValue({
      ...base,
      status: EstadoDeposito.aprobado,
    });
    await expect(
      new DepositService(repository).approve(base.id, admin),
    ).resolves.toMatchObject({ status: EstadoDeposito.aprobado });
    expect(repository.approve).not.toHaveBeenCalled();
  });

  it.each([
    [new DepositBalanceOverflowError(), UnprocessableEntityException],
    [new DepositWalletRaceError(), ConflictException],
    [new DepositDecisionRaceError(), ConflictException],
    [{ code: 'P2034' }, ConflictException],
    [new Error('private database detail'), InternalServerErrorException],
  ])(
    'maps approval failure %s without exposing details',
    async (failure, expected) => {
      const repository = repositoryMock();
      repository.approve.mockRejectedValue(failure);
      await expect(
        new DepositService(repository).approve(base.id, admin),
      ).rejects.toBeInstanceOf(expected);
    },
  );

  it('rejects a pending deposit, replays the same reason, and conflicts on another reason', async () => {
    const repository = repositoryMock();
    const service = new DepositService(repository);
    await expect(
      service.reject(base.id, { reason: '  invalid proof  ' }, admin),
    ).resolves.toMatchObject({ status: base.status });
    expect(repository.reject).toHaveBeenCalledWith(
      'tenant-1',
      'MXN',
      base.id,
      'invalid proof',
    );
    repository.findAdminById.mockResolvedValue({
      ...base,
      status: EstadoDeposito.rechazado,
      rejectionReason: 'invalid proof',
    });
    await expect(
      service.reject(base.id, { reason: 'invalid proof' }, admin),
    ).resolves.toMatchObject({ status: EstadoDeposito.rechazado });
    await expect(
      service.reject(base.id, { reason: 'other proof' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps rejection and cancellation free of wallet and movement writes', async () => {
    const repository = repositoryMock();
    await new DepositService(repository).reject(
      base.id,
      { reason: 'bad proof' },
      admin,
    );
    expect(repository).not.toHaveProperty('wallet');
    expect(repository).not.toHaveProperty('movement');
  });
});
