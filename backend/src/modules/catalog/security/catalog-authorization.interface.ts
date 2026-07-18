export interface AuthorizationPrincipal {
  id: string;
  roles?: string[];
}

export const CATALOG_AUTHORIZATION = 'CATALOG_AUTHORIZATION_TOKEN';

export interface CatalogAuthorization {
  getPrincipal(): Promise<AuthorizationPrincipal | null>;
  hasRole(role: string): Promise<boolean>;
}
