import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthTokenService } from '../../auth/application/auth-token.service';
import { SesionRepository } from '../../auth/infrastructure/sesion.repository';
import { UsuarioRepository } from '../../auth/infrastructure/usuario.repository';
import {
  AuthenticatedPrincipal,
  CatalogAuthorization,
} from './catalog-authorization.interface';

const BEARER_PREFIX = 'Bearer ';
const REQUIRED_ROLE = 'administradorPlataforma';

/**
 * Real `CatalogAuthorization` implementation backed by the platform's
 * JWT/session/user authentication (see `AuthModule`). Only users with the
 * `administradorPlataforma` role may administer the master catalog.
 */
@Injectable()
export class CatalogAuthorizationService implements CatalogAuthorization {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sesionRepository: SesionRepository,
    private readonly usuarioRepository: UsuarioRepository,
  ) {}

  async authenticate(
    authorizationHeader: string | undefined,
  ): Promise<AuthenticatedPrincipal> {
    const accessToken = this.extractBearerToken(authorizationHeader);

    const payload = await this.verifyAccessToken(accessToken);

    const sesion = await this.sesionRepository.findById(payload.sid);
    if (!sesion || sesion.usuarioId !== payload.sub) {
      throw new UnauthorizedException('Sesión inválida');
    }
    if (sesion.revocadaEn) {
      throw new UnauthorizedException('Sesión revocada');
    }
    if (sesion.expiraEn.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const usuario = await this.usuarioRepository.findById(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (usuario.estado !== 'activo') {
      throw new UnauthorizedException('La cuenta no está activa');
    }

    if (usuario.rol !== REQUIRED_ROLE) {
      throw new ForbiddenException(
        'Rol insuficiente para administrar el catálogo maestro',
      );
    }

    return {
      userId: usuario.id,
      tiendaId: usuario.tiendaId,
      role: usuario.rol,
    };
  }

  private extractBearerToken(header: string | undefined): string {
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException(
        'Encabezado de autorización faltante o inválido',
      );
    }

    const token = header.slice(BEARER_PREFIX.length).trim();
    if (!token) {
      throw new UnauthorizedException(
        'Encabezado de autorización faltante o inválido',
      );
    }

    return token;
  }

  private async verifyAccessToken(token: string) {
    try {
      return await this.authTokenService.verifyAccessToken(token);
    } catch {
      // Covers signature/expiration failures and refresh tokens presented
      // as access tokens (verifyAccessToken rejects mismatched `tipo`).
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }
}
