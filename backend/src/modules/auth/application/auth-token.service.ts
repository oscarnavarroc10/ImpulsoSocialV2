import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

import {
  JwtPayload,
  VerifiedJwtPayload,
} from '../security/jwt-payload.interface';
import { TokenPair } from './token-pair.interface';

export type BaseJwtPayload = Omit<JwtPayload, 'tipo'>;

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(payload: BaseJwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  generateAccessToken(payload: BaseJwtPayload): Promise<string> {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    const expiresIn = this.getExpiration('JWT_ACCESS_EXPIRES_IN', '15m');

    return this.jwtService.signAsync(
      {
        ...payload,
        tipo: 'access',
      },
      {
        secret,
        expiresIn,
      },
    );
  }

  generateRefreshToken(payload: BaseJwtPayload): Promise<string> {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const expiresIn = this.getExpiration('JWT_REFRESH_EXPIRES_IN', '30d');

    return this.jwtService.signAsync(
      {
        ...payload,
        tipo: 'refresh',
      },
      {
        secret,
        expiresIn,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<VerifiedJwtPayload> {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');

    const payload = await this.jwtService.verifyAsync<VerifiedJwtPayload>(
      token,
      {
        secret,
      },
    );

    if (payload.tipo !== 'access') {
      throw new Error('El token proporcionado no es un access token');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<VerifiedJwtPayload> {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const payload = await this.jwtService.verifyAsync<VerifiedJwtPayload>(
      token,
      {
        secret,
      },
    );

    if (payload.tipo !== 'refresh') {
      throw new Error('El token proporcionado no es un refresh token');
    }

    return payload;
  }

  private getExpiration(
    variableName: string,
    fallback: string,
  ): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>(variableName) ??
      fallback) as JwtSignOptions['expiresIn'];
  }
}
