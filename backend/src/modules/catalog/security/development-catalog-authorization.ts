import { Injectable } from '@nestjs/common';
import {
  AuthorizationPrincipal,
  CatalogAuthorization,
} from './catalog-authorization.interface';

@Injectable()
export class DevelopmentCatalogAuthorization implements CatalogAuthorization {
  async getPrincipal(): Promise<AuthorizationPrincipal> {
    return {
      id: 'dev-admin',
      roles: ['catalog:admin'],
    };
  }

  async hasRole(role: string): Promise<boolean> {
    return role === 'catalog:admin';
  }
}
