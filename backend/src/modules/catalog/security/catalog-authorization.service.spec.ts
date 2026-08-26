import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { CatalogAuthorizationService } from './catalog-authorization.service';
import type { AuthTokenService } from '../../auth/application/auth-token.service';
import type { SesionRepository } from '../../auth/infrastructure/sesion.repository';
import type { UsuarioRepository } from '../../auth/infrastructure/usuario.repository';
import type { VerifiedJwtPayload } from '../../auth/security/jwt-payload.interface';

describe('CatalogAuthorizationService', () => {
  const basePayload: VerifiedJwtPayload = {
    sub: 'user-1',
    sid: 'session-1',
    email: 'admin@example.com',
    rol: 'administradorPlataforma',
    tiendaId: 'tienda-1',
    tipo: 'access',
    iat: 0,
    exp: 9_999_999_999,
  };

  const activeSession = {
    id: 'session-1',
    usuarioId: 'user-1',
    refreshTokenHash: 'hash',
    expiraEn: new Date(Date.now() + 60_000),
    revocadaEn: null,
  };

  function buildService(
    overrides: {
      verifyAccessToken?: jest.Mock;
      findSessionById?: jest.Mock;
      findUserById?: jest.Mock;
    } = {},
  ) {
    const authTokenService = {
      verifyAccessToken:
        overrides.verifyAccessToken ?? jest.fn().mockResolvedValue(basePayload),
    } as unknown as AuthTokenService;

    const sesionRepository = {
      findById:
        overrides.findSessionById ?? jest.fn().mockResolvedValue(activeSession),
    } as unknown as SesionRepository;

    const usuarioRepository = {
      findById:
        overrides.findUserById ??
        jest.fn().mockResolvedValue({
          id: 'user-1',
          tiendaId: 'tienda-1',
          rol: 'administradorPlataforma',
          estado: 'activo',
        }),
    } as unknown as UsuarioRepository;

    return new CatalogAuthorizationService(
      authTokenService,
      sesionRepository,
      usuarioRepository,
    );
  }

  it('rejects when the Authorization header is missing', async () => {
    const service = buildService();
    await expect(service.authenticate(undefined)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a malformed Authorization header', async () => {
    const service = buildService();
    await expect(service.authenticate('Token abc')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an empty bearer token', async () => {
    const service = buildService();
    await expect(service.authenticate('Bearer ')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired access token', async () => {
    const service = buildService({
      verifyAccessToken: jest.fn().mockRejectedValue(new Error('jwt expired')),
    });
    await expect(service.authenticate('Bearer expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token presented as an access token', async () => {
    // AuthTokenService.verifyAccessToken rejects mismatched `tipo` internally.
    const service = buildService({
      verifyAccessToken: jest
        .fn()
        .mockRejectedValue(
          new Error('El token proporcionado no es un access token'),
        ),
    });
    await expect(service.authenticate('Bearer refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session does not exist', async () => {
    const service = buildService({
      findSessionById: jest.fn().mockResolvedValue(null),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session belongs to a different user', async () => {
    const service = buildService({
      findSessionById: jest
        .fn()
        .mockResolvedValue({ ...activeSession, usuarioId: 'other-user' }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a revoked session', async () => {
    const service = buildService({
      findSessionById: jest
        .fn()
        .mockResolvedValue({ ...activeSession, revocadaEn: new Date() }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired session', async () => {
    const service = buildService({
      findSessionById: jest.fn().mockResolvedValue({
        ...activeSession,
        expiraEn: new Date(Date.now() - 1000),
      }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the user no longer exists', async () => {
    const service = buildService({
      findUserById: jest.fn().mockResolvedValue(null),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an inactive user account', async () => {
    const service = buildService({
      findUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        tiendaId: 'tienda-1',
        rol: 'administradorPlataforma',
        estado: 'bloqueado',
      }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a valid "cliente" user with 403', async () => {
    const service = buildService({
      findUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        tiendaId: 'tienda-1',
        rol: 'cliente',
        estado: 'activo',
      }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a valid "administradorTienda" user with 403', async () => {
    const service = buildService({
      findUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        tiendaId: 'tienda-1',
        rol: 'administradorTienda',
        estado: 'activo',
      }),
    });
    await expect(service.authenticate('Bearer token')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('resolves the authenticated principal for a valid "administradorPlataforma" user', async () => {
    const service = buildService();
    const principal = await service.authenticate('Bearer valid-token');
    expect(principal).toEqual({
      userId: 'user-1',
      tiendaId: 'tienda-1',
      role: 'administradorPlataforma',
    });
  });
});
