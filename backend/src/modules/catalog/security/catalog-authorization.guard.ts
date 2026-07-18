import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import {
  CatalogAuthorization,
  CATALOG_AUTHORIZATION,
} from './catalog-authorization.interface';

const REQUIRED_ROLE = 'catalog:admin';

@Injectable()
export class CatalogAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(CATALOG_AUTHORIZATION)
    private readonly auth: CatalogAuthorization | null,
  ) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    void _context;
    // Fail closed by default
    if (!this.auth) {
      throw new ForbiddenException('Authorization service not available');
    }

    const principal = await this.auth.getPrincipal();
    if (!principal) {
      throw new ForbiddenException('No authenticated principal');
    }

    const has = await this.auth.hasRole(REQUIRED_ROLE);
    if (!has) {
      throw new ForbiddenException(
        'Insufficient role for catalog administration',
      );
    }

    return true;
  }
}
