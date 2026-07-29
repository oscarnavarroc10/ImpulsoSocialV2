import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { DuplicateUserEmailError } from '../domain/auth.errors';
import { TiendaRepository } from '../infrastructure/tienda.repository';
import { UsuarioRepository } from '../infrastructure/usuario.repository';
import { RefreshTokenHasher } from '../security/refresh-token-hasher';
import { AuthTokenService } from './auth-token.service';
import { AuthResponseDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto';
import { PASSWORD_HASHER } from './password-hasher.interface';
import type { PasswordHasher } from './password-hasher.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly tiendaRepository: TiendaRepository,
    private readonly usuarioRepository: UsuarioRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const tenantSlug = this.configService.getOrThrow<string>(
      'DEFAULT_TENANT_SLUG',
    );

    const tienda = await this.tiendaRepository.findBySlug(
      tenantSlug.trim().toLowerCase(),
    );

    if (!tienda) {
      throw new InternalServerErrorException(
        'La tienda configurada para el registro no existe',
      );
    }

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

  login(dto: LoginDto): never {
    void dto;

    throw new NotImplementedException(
      'El inicio de sesión todavía no está implementado',
    );
  }

  refresh(dto: RefreshTokenDto): never {
    void dto;

    throw new NotImplementedException(
      'La renovación de sesión todavía no está implementada',
    );
  }

  logout(dto: RefreshTokenDto): never {
    void dto;

    throw new NotImplementedException(
      'El cierre de sesión todavía no está implementado',
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeName(nombre: string): string {
    return nombre.trim().replace(/\s+/g, ' ');
  }
}
