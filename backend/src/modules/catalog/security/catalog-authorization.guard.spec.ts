import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { CatalogAuthorizationGuard } from './catalog-authorization.guard';
import type { CatalogAuthorization } from './catalog-authorization.interface';

function buildContext(authorizationHeader?: string): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; principal?: unknown };
} {
  const request: {
    headers: Record<string, string | undefined>;
    principal?: unknown;
  } = { headers: { authorization: authorizationHeader } };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('CatalogAuthorizationGuard', () => {
  it('fails closed when no authorization service is bound', async () => {
    const guard = new CatalogAuthorizationGuard(null);
    const { context } = buildContext('Bearer token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('propagates UnauthorizedException from the authorization service', async () => {
    const fakeAuth: CatalogAuthorization = {
      authenticate: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException('invalid')),
    };
    const guard = new CatalogAuthorizationGuard(fakeAuth);
    const { context } = buildContext('Bearer token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('propagates ForbiddenException when the role is insufficient', async () => {
    const fakeAuth: CatalogAuthorization = {
      authenticate: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('insufficient role')),
    };
    const guard = new CatalogAuthorizationGuard(fakeAuth);
    const { context } = buildContext('Bearer token');
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('attaches the authenticated principal to the request and allows access', async () => {
    const principal = {
      userId: 'user-1',
      tiendaId: 'tienda-1',
      role: 'administradorPlataforma',
    };
    const fakeAuth: CatalogAuthorization = {
      authenticate: jest.fn().mockResolvedValue(principal),
    };
    const guard = new CatalogAuthorizationGuard(fakeAuth);
    const { context, request } = buildContext('Bearer token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.principal).toEqual(principal);
  });
});
