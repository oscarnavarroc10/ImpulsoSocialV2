import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { DuplicateUserEmailError } from '../domain/auth.errors';
import { SesionRepository } from '../infrastructure/sesion.repository';
import { TiendaRepository } from '../infrastructure/tienda.repository';
import { UsuarioRepository } from '../infrastructure/usuario.repository';
import { RefreshTokenHasher } from '../security/refresh-token-hasher';
import type { VerifiedJwtPayload } from '../security/jwt-payload.interface';
import { AuthTokenService } from './auth-token.service';
import {
  AuthResponseDto,
  LoginDto,
  RefreshResponseDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto';
import { PASSWORD_HASHER } from './password-hasher.interface';
import type { PasswordHasher } from './password-hasher.interface';

const GENERIC_SESSION_ERROR = 'Sesión inválida';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly tiendaRepository: TiendaRepository,
    private readonly usuarioRepository: UsuarioRepository,
    private readonly sesionRepository: SesionRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const tienda = await this.getConfiguredTenant(
      'La tienda configurada para el registro no existe',
    );

    if (!tienda.activa) {
      throw new ConflictException(
        'La tienda no está disponible para nuevos registros',
      );
    }

    const nombre = this.normalizeName(dto.nombre);
    const email = this.normalizeEmail(dto.email);

    const emailAlreadyExists = await this.usuarioRepository.existsByEmail(
      tienda.id,
      email,
    );

    if (emailAlreadyExists) {
      throw new ConflictException(
        'Ya existe un usuario con este correo electrónico',
      );
    }

    const usuarioId = randomUUID();
    const sesionId = randomUUID();
    const passwordHash = await this.passwordHasher.hash(dto.password);

    const tokenPair = await this.authTokenService.generateTokenPair({
      sub: usuarioId,
      sid: sesionId,
      email,
      rol: 'cliente',
      tiendaId: tienda.id,
    });

    const verifiedRefreshToken = await this.authTokenService.verifyRefreshToken(
      tokenPair.refreshToken,
    );

    const refreshTokenHash = this.refreshTokenHasher.hash(
      tokenPair.refreshToken,
    );

    try {
      const usuario = await this.usuarioRepository.createRegisteredUser({
        usuarioId,
        sesionId,
        tiendaId: tienda.id,
        moneda: tienda.moneda,
        nombre,
        email,
        passwordHash,
        refreshTokenHash,
        refreshTokenExpiraEn: new Date(verifiedRefreshToken.exp * 1000),
      });

      return {
        usuario,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
      };
    } catch (error: unknown) {
      if (error instanceof DuplicateUserEmailError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const tienda = await this.getConfiguredTenant(
      'La tienda configurada para el inicio de sesión no existe',
    );

    if (!tienda.activa) {
      throw new ConflictException('La tienda no está disponible');
    }

    const email = this.normalizeEmail(dto.email);
    const usuario = await this.usuarioRepository.findForLogin(tienda.id, email);

    if (!usuario) {
      throw new UnauthorizedException(
        'Correo electrónico o contraseña incorrectos',
      );
    }

    const passwordIsValid = await this.passwordHasher.compare(
      dto.password,
      usuario.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException(
        'Correo electrónico o contraseña incorrectos',
      );
    }

    if (usuario.estado !== 'activo') {
      throw new ForbiddenException('La cuenta no está disponible');
    }

    const sesionId = randomUUID();
    const tokenPair = await this.authTokenService.generateTokenPair({
      sub: usuario.id,
      sid: sesionId,
      email: usuario.email,
      rol: usuario.rol,
      tiendaId: usuario.tiendaId,
    });

    const verifiedRefreshToken = await this.authTokenService.verifyRefreshToken(
      tokenPair.refreshToken,
    );
    const refreshTokenHash = this.refreshTokenHasher.hash(
      tokenPair.refreshToken,
    );

    await this.sesionRepository.create({
      id: sesionId,
      usuarioId: usuario.id,
      refreshTokenHash,
      expiraEn: new Date(verifiedRefreshToken.exp * 1000),
    });

    return {
      usuario: {
        id: usuario.id,
        tiendaId: usuario.tiendaId,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  private async getConfiguredTenant(errorMessage: string) {
    const tenantSlug = this.configService.getOrThrow<string>(
      'DEFAULT_TENANT_SLUG',
    );

    const tienda = await this.tiendaRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );

    if (!tienda) {
      throw new InternalServerErrorException(errorMessage);
    }

    return tienda;
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    let payload: VerifiedJwtPayload;
    try {
      payload = await this.authTokenService.verifyRefreshToken(
        dto.refreshToken,
      );
    } catch {
      throw new UnauthorizedException(GENERIC_SESSION_ERROR);
    }

    const oldRefreshTokenHash = this.refreshTokenHasher.hash(dto.refreshToken);
    const sesion =
      await this.sesionRepository.findByRefreshTokenHash(oldRefreshTokenHash);

    if (
      !sesion ||
      sesion.id !== payload.sid ||
      sesion.usuarioId !== payload.sub ||
      sesion.revocadaEn !== null ||
      sesion.expiraEn.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(GENERIC_SESSION_ERROR);
    }

    const usuario = await this.usuarioRepository.findById(payload.sub);
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedException(GENERIC_SESSION_ERROR);
    }

    const tienda = await this.resolveConfiguredActiveTenant();
    if (
      !tienda ||
      tienda.id !== usuario.tiendaId ||
      tienda.id !== payload.tiendaId
    ) {
      throw new UnauthorizedException(GENERIC_SESSION_ERROR);
    }

    const newSessionId = randomUUID();
    const tokenPair = await this.authTokenService.generateTokenPair({
      sub: usuario.id,
      sid: newSessionId,
      email: usuario.email,
      rol: usuario.rol,
      tiendaId: usuario.tiendaId,
    });

    const verifiedNewRefreshToken =
      await this.authTokenService.verifyRefreshToken(tokenPair.refreshToken);
    const newRefreshTokenHash = this.refreshTokenHasher.hash(
      tokenPair.refreshToken,
    );

    const rotated = await this.sesionRepository.rotate({
      oldSessionId: sesion.id,
      usuarioId: usuario.id,
      oldRefreshTokenHash,
      newSessionId,
      newRefreshTokenHash,
      newExpiraEn: new Date(verifiedNewRefreshToken.exp * 1000),
    });

    if (!rotated) {
      throw new UnauthorizedException(GENERIC_SESSION_ERROR);
    }

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const refreshTokenHash = this.refreshTokenHasher.hash(dto.refreshToken);
    await this.sesionRepository.revokeActiveByHash(refreshTokenHash);
  }

  private async resolveConfiguredActiveTenant() {
    const rawSlug = this.configService.get<string>('DEFAULT_TENANT_SLUG');
    const slug = rawSlug?.trim().toLowerCase();
    if (!slug) {
      return null;
    }

    const tienda = await this.tiendaRepository.findBySlug(slug);
    return tienda && tienda.activa ? tienda : null;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeName(nombre: string): string {
    return nombre.trim().replace(/\s+/g, ' ');
  }
}
