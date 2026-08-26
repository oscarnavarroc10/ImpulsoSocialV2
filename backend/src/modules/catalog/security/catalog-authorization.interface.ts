export interface AuthenticatedPrincipal {
  userId: string;
  tiendaId: string;
  role: string;
}

export const CATALOG_AUTHORIZATION = 'CATALOG_AUTHORIZATION_TOKEN';

export interface CatalogAuthorization {
  /**
   * Validates the `Authorization: Bearer <token>` header and the role of the
   * resolved user. Resolves with the authenticated principal when access is
   * granted, or rejects with an `UnauthorizedException` (missing/invalid/
   * expired authentication) or `ForbiddenException` (insufficient role).
   */
  authenticate(
    authorizationHeader: string | undefined,
  ): Promise<AuthenticatedPrincipal>;
}
