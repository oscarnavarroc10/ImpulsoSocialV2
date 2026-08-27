import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AuthService } from '../../../src/modules/auth/application/auth.service';
import type { AuthTokenService } from '../../../src/modules/auth/application/auth-token.service';
import type { PasswordHasher } from '../../../src/modules/auth/application/password-hasher.interface';
import { SesionRepository } from '../../../src/modules/auth/infrastructure/sesion.repository';
import type { TiendaRepository } from '../../../src/modules/auth/infrastructure/tienda.repository';
import type { UsuarioRepository } from '../../../src/modules/auth/infrastructure/usuario.repository';
import type { RefreshTokenHasher } from '../../../src/modules/auth/security/refresh-token-hasher';
import type { PrismaService } from '../../../src/prisma/prisma.service';

const GENERIC_SESSION_ERROR = 'Sesión inválida';

describe('AuthService session lifecycle', () => {
  const configService = { get: jest.fn(), getOrThrow: jest.fn() };
  const tiendaRepository = { findBySlug: jest.fn() };
  const usuarioRepository = { findById: jest.fn() };
  const sesionRepository = {
    findByRefreshTokenHash: jest.fn(),
    rotate: jest.fn(),
    revokeActiveByHash: jest.fn(),
  };
  const authTokenService = {
    verifyRefreshToken: jest.fn(),
    generateTokenPair: jest.fn(),
  };
  const refreshTokenHasher = { hash: jest.fn() };
  const passwordHasher = { hash: jest.fn(), compare: jest.fn() };

  const service = new AuthService(
    configService as unknown as ConfigService,
    tiendaRepository as unknown as TiendaRepository,
    usuarioRepository as unknown as UsuarioRepository,
    sesionRepository as unknown as SesionRepository,
    authTokenService as unknown as AuthTokenService,
    refreshTokenHasher as unknown as RefreshTokenHasher,
    passwordHasher as unknown as PasswordHasher,
  );

  const OLD_TOKEN = 'old-refresh-token';
  const OLD_HASH = 'hash(old-refresh-token)';
  const NEW_TOKEN = 'new-refresh-token';
  const NEW_HASH = 'hash(new-refresh-token)';
  const FUTURE = new Date(Date.now() + 60_000);
  const PAST = new Date(Date.now() - 60_000);

  function activeSession(overrides: Record<string, unknown> = {}) {
    return {
      id: 'session-old',
      usuarioId: 'user-1',
      refreshTokenHash: OLD_HASH,
      revocadaEn: null,
      expiraEn: FUTURE,
      ...overrides,
    };
  }

  function oldPayload(overrides: Record<string, unknown> = {}) {
    return {
      sub: 'user-1',
      sid: 'session-old',
      email: 'stale-email@example.com',
      rol: 'cliente',
      tiendaId: 'tenant-1',
      tipo: 'refresh',
      iat: 0,
      exp: 9_999_999_999,
      ...overrides,
    };
  }

  function activeUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      tiendaId: 'tenant-1',
      email: 'current-email@example.com',
      rol: 'administradorPlataforma',
      estado: 'activo',
      ...overrides,
    };
  }

  function activeTenant(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tenant-1',
      slug: 'impulsosocial',
      nombre: 'ImpulsoSocial',
      moneda: 'MXN',
      activa: true,
      ...overrides,
    };
  }

  function setupHappyPath() {
    configService.get.mockReturnValue('  ImpulsoSocial  ');
    authTokenService.verifyRefreshToken.mockImplementation((token: string) =>
      token === OLD_TOKEN
        ? Promise.resolve(oldPayload())
        : Promise.resolve({ ...oldPayload(), exp: 8_888_888_888 }),
    );
    refreshTokenHasher.hash.mockImplementation((token: string) =>
      token === OLD_TOKEN ? OLD_HASH : NEW_HASH,
    );
    sesionRepository.findByRefreshTokenHash.mockResolvedValue(activeSession());
    usuarioRepository.findById.mockResolvedValue(activeUser());
    tiendaRepository.findBySlug.mockResolvedValue(activeTenant());
    authTokenService.generateTokenPair.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: NEW_TOKEN,
    });
    sesionRepository.rotate.mockResolvedValue(true);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('refresh', () => {
    it('rotates the session using current persisted user/email/role/tenant and a new sid', async () => {
      setupHappyPath();

      const result = await service.refresh({ refreshToken: OLD_TOKEN });

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: NEW_TOKEN,
      });

      expect(authTokenService.generateTokenPair).toHaveBeenCalledWith({
        sub: 'user-1',
        sid: expect.any(String) as string,
        email: 'current-email@example.com',
        rol: 'administradorPlataforma',
        tiendaId: 'tenant-1',
      });

      const [generatedClaims] = authTokenService.generateTokenPair.mock
        .calls[0] as [{ sid: string }];
      expect(generatedClaims.sid).not.toBe('session-old');

      expect(sesionRepository.rotate).toHaveBeenCalledWith({
        oldSessionId: 'session-old',
        usuarioId: 'user-1',
        oldRefreshTokenHash: OLD_HASH,
        newSessionId: generatedClaims.sid,
        newRefreshTokenHash: NEW_HASH,
        newExpiraEn: new Date(8_888_888_888 * 1000),
      });
    });

    it('generates a session id different across calls', async () => {
      setupHappyPath();
      await service.refresh({ refreshToken: OLD_TOKEN });
      const first = (
        authTokenService.generateTokenPair.mock.calls[0] as [{ sid: string }]
      )[0].sid;

      jest.clearAllMocks();
      setupHappyPath();
      await service.refresh({ refreshToken: OLD_TOKEN });
      const second = (
        authTokenService.generateTokenPair.mock.calls[0] as [{ sid: string }]
      )[0].sid;

      expect(first).not.toBe(second);
      expect(first).not.toBe('');
    });

    it('rejects with the generic error when the JWT is malformed or invalid', async () => {
      authTokenService.verifyRefreshToken.mockRejectedValue(
        new Error('jwt malformed'),
      );

      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(GENERIC_SESSION_ERROR);
      expect(sesionRepository.rotate).not.toHaveBeenCalled();
    });

    it('rejects when no persisted session matches the submitted hash', async () => {
      setupHappyPath();
      sesionRepository.findByRefreshTokenHash.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authTokenService.generateTokenPair).not.toHaveBeenCalled();
    });

    it('rejects when the session id does not match the JWT sid', async () => {
      setupHappyPath();
      sesionRepository.findByRefreshTokenHash.mockResolvedValue(
        activeSession({ id: 'different-session' }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the session usuarioId does not match the JWT sub', async () => {
      setupHappyPath();
      sesionRepository.findByRefreshTokenHash.mockResolvedValue(
        activeSession({ usuarioId: 'different-user' }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an already-revoked session', async () => {
      setupHappyPath();
      sesionRepository.findByRefreshTokenHash.mockResolvedValue(
        activeSession({ revocadaEn: new Date() }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a database-expired session even if the JWT itself validated', async () => {
      setupHappyPath();
      sesionRepository.findByRefreshTokenHash.mockResolvedValue(
        activeSession({ expiraEn: PAST }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the user no longer exists', async () => {
      setupHappyPath();
      usuarioRepository.findById.mockResolvedValue(null);

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an inactive user', async () => {
      setupHappyPath();
      usuarioRepository.findById.mockResolvedValue(
        activeUser({ estado: 'bloqueado' }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when DEFAULT_TENANT_SLUG is not configured', async () => {
      setupHappyPath();
      configService.get.mockReturnValue(undefined);

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the configured tenant is inactive', async () => {
      setupHappyPath();
      tiendaRepository.findBySlug.mockResolvedValue(
        activeTenant({ activa: false }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the configured tenant does not match the user tenant', async () => {
      setupHappyPath();
      usuarioRepository.findById.mockResolvedValue(
        activeUser({ tiendaId: 'other-tenant' }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the JWT tiendaId does not match the configured tenant', async () => {
      setupHappyPath();
      authTokenService.verifyRefreshToken.mockImplementation((token: string) =>
        token === OLD_TOKEN
          ? Promise.resolve(oldPayload({ tiendaId: 'other-tenant' }))
          : Promise.resolve({ ...oldPayload(), exp: 8_888_888_888 }),
      );

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a replayed/concurrently-lost rotation with no tokens created', async () => {
      setupHappyPath();
      sesionRepository.rotate.mockResolvedValue(false);

      await expect(
        service.refresh({ refreshToken: OLD_TOKEN }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('always throws the same generic message without exposing the failure reason', async () => {
      const failureModes = [
        () =>
          authTokenService.verifyRefreshToken.mockRejectedValue(new Error('x')),
        () => {
          setupHappyPath();
          sesionRepository.findByRefreshTokenHash.mockResolvedValue(null);
        },
        () => {
          setupHappyPath();
          usuarioRepository.findById.mockResolvedValue(null);
        },
        () => {
          setupHappyPath();
          sesionRepository.rotate.mockResolvedValue(false);
        },
      ];

      for (const applyFailure of failureModes) {
        jest.resetAllMocks();
        applyFailure();
        await expect(
          service.refresh({ refreshToken: OLD_TOKEN }),
        ).rejects.toThrow(GENERIC_SESSION_ERROR);
      }
    });
  });

  describe('logout', () => {
    it('hashes the submitted token and revokes only its active matching session', async () => {
      refreshTokenHasher.hash.mockReturnValue(OLD_HASH);
      sesionRepository.revokeActiveByHash.mockResolvedValue(undefined);

      await service.logout({ refreshToken: OLD_TOKEN });

      expect(refreshTokenHasher.hash).toHaveBeenCalledWith(OLD_TOKEN);
      expect(sesionRepository.revokeActiveByHash).toHaveBeenCalledWith(
        OLD_HASH,
      );
    });

    it('succeeds even when no active session matches (idempotent)', async () => {
      refreshTokenHasher.hash.mockReturnValue('unknown-hash');
      sesionRepository.revokeActiveByHash.mockResolvedValue(undefined);

      await expect(
        service.logout({ refreshToken: 'unknown-token' }),
      ).resolves.toBeUndefined();
    });

    it('never calls anything resembling a revoke-all operation', async () => {
      refreshTokenHasher.hash.mockReturnValue(OLD_HASH);

      await service.logout({ refreshToken: OLD_TOKEN });

      const repositoryMethods = Object.keys(sesionRepository);
      expect(repositoryMethods).not.toContain('revokeAllByUser');
    });
  });
});

describe('SesionRepository rotation (real repository, mocked Prisma)', () => {
  function buildFakePrisma() {
    const tx = {
      sesionUsuario: {
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: typeof tx) => Promise<unknown>) => callback(tx),
      ),
      sesionUsuario: {
        updateMany: jest.fn(),
      },
    };

    return { prisma, tx };
  }

  const rotateInput = {
    oldSessionId: 'session-old',
    usuarioId: 'user-1',
    oldRefreshTokenHash: 'old-hash',
    newSessionId: 'session-new',
    newRefreshTokenHash: 'new-hash',
    newExpiraEn: new Date(Date.now() + 60_000),
  };

  it('conditionally revokes the old session and creates the replacement atomically', async () => {
    const { prisma, tx } = buildFakePrisma();
    tx.sesionUsuario.updateMany.mockResolvedValue({ count: 1 });
    tx.sesionUsuario.create.mockResolvedValue(undefined);

    const repository = new SesionRepository(prisma as unknown as PrismaService);

    const result = await repository.rotate(rotateInput);

    expect(result).toBe(true);
    expect(tx.sesionUsuario.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-old',
        usuarioId: 'user-1',
        refreshTokenHash: 'old-hash',
        revocadaEn: null,
        expiraEn: { gt: expect.any(Date) as Date },
      },
      data: { revocadaEn: expect.any(Date) as Date },
    });
    expect(tx.sesionUsuario.create).toHaveBeenCalledWith({
      data: {
        id: 'session-new',
        usuarioId: 'user-1',
        refreshTokenHash: 'new-hash',
        expiraEn: rotateInput.newExpiraEn,
        direccionIp: undefined,
        dispositivo: undefined,
      },
    });
  });

  it('returns false and creates nothing when the conditional update matches zero rows', async () => {
    const { prisma, tx } = buildFakePrisma();
    tx.sesionUsuario.updateMany.mockResolvedValue({ count: 0 });

    const repository = new SesionRepository(prisma as unknown as PrismaService);
    const result = await repository.rotate(rotateInput);

    expect(result).toBe(false);
    expect(tx.sesionUsuario.create).not.toHaveBeenCalled();
  });

  it('allows exactly one of two concurrent rotations for the same old session', async () => {
    const { prisma, tx } = buildFakePrisma();
    let oldSessionIsActive = true;
    tx.sesionUsuario.updateMany.mockImplementation(() => {
      if (!oldSessionIsActive) {
        return Promise.resolve({ count: 0 });
      }

      oldSessionIsActive = false;
      return Promise.resolve({ count: 1 });
    });
    tx.sesionUsuario.create.mockResolvedValue(undefined);

    const repository = new SesionRepository(prisma as unknown as PrismaService);
    const [first, second] = await Promise.all([
      repository.rotate(rotateInput),
      repository.rotate({
        ...rotateInput,
        newSessionId: 'session-new-2',
        newRefreshTokenHash: 'new-hash-2',
      }),
    ]);

    expect([first, second].sort()).toEqual([false, true]);
    expect(tx.sesionUsuario.create).toHaveBeenCalledTimes(1);
  });

  it('rejects the transaction when replacement-session creation fails', async () => {
    const { prisma, tx } = buildFakePrisma();
    tx.sesionUsuario.updateMany.mockResolvedValue({ count: 1 });
    tx.sesionUsuario.create.mockRejectedValue(new Error('unique violation'));

    const repository = new SesionRepository(prisma as unknown as PrismaService);

    await expect(repository.rotate(rotateInput)).rejects.toThrow(
      'unique violation',
    );
  });

  it('idempotently revokes only the active session matching the hash', async () => {
    const { prisma } = buildFakePrisma();
    prisma.sesionUsuario.updateMany.mockResolvedValue({ count: 1 });

    const repository = new SesionRepository(prisma as unknown as PrismaService);
    await repository.revokeActiveByHash('some-hash');

    expect(prisma.sesionUsuario.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: 'some-hash', revocadaEn: null },
      data: { revocadaEn: expect.any(Date) as Date },
    });
  });

  it('resolves without throwing when no active session matches the hash', async () => {
    const { prisma } = buildFakePrisma();
    prisma.sesionUsuario.updateMany.mockResolvedValue({ count: 0 });

    const repository = new SesionRepository(prisma as unknown as PrismaService);

    await expect(
      repository.revokeActiveByHash('unknown-hash'),
    ).resolves.toBeUndefined();
  });
});
