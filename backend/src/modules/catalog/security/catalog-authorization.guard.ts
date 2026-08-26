import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  AuthenticatedPrincipal,
  CatalogAuthorization,
  CATALOG_AUTHORIZATION,
} from './catalog-authorization.interface';

export type CatalogAuthenticatedRequest = Request & {
  principal?: AuthenticatedPrincipal;
};

@Injectable()
export class CatalogAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(CATALOG_AUTHORIZATION)
    private readonly auth: CatalogAuthorization | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Fail closed by default
    if (!this.auth) {
      throw new UnauthorizedException('Authorization service not available');
    }

    const request = context
      .switchToHttp()
      .getRequest<CatalogAuthenticatedRequest>();

    const principal = await this.auth.authenticate(
      request.headers?.authorization,
    );
    request.principal = principal;

    return true;
  }
}
