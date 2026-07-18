/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars,@typescript-eslint/no-unsafe-argument */
import { CatalogAuthorizationGuard } from '../../../../backend/src/modules/catalog/security/catalog-authorization.guard';
import { ForbiddenException } from '@nestjs/common';

describe('CatalogAuthorizationGuard', () => {
  it('fails closed when authorization service returns no principal', async () => {
    const fakeAuth = {
      getPrincipal: async () => null,
      hasRole: async (_: string) => false,
    } as any;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/require-await,@typescript-eslint/no-unused-vars */
    const guard = new CatalogAuthorizationGuard(fakeAuth);
    await expect(guard.canActivate({} as any)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('fails when principal lacks required role', async () => {
    const fakeAuth = {
      getPrincipal: async () => ({ id: 'u1' }),
      hasRole: async (_: string) => false,
    } as any;
    const guard = new CatalogAuthorizationGuard(fakeAuth);
    await expect(guard.canActivate({} as any)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
