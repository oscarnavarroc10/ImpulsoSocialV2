import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './application/auth.service';
import { AuthTokenService } from './application/auth-token.service';
import { PASSWORD_HASHER } from './application/password-hasher.interface';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { SesionRepository } from './infrastructure/sesion.repository';
import { TiendaRepository } from './infrastructure/tienda.repository';
import { UsuarioRepository } from './infrastructure/usuario.repository';
import { AuthController } from './presentation/auth.controller';
import { RefreshTokenHasher } from './security/refresh-token-hasher';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    AuthTokenService,
    UsuarioRepository,
    SesionRepository,
    TiendaRepository,
    BcryptPasswordHasher,
    RefreshTokenHasher,
    {
      provide: PASSWORD_HASHER,
      useExisting: BcryptPasswordHasher,
    },
  ],
  exports: [
    AuthService,
    AuthTokenService,
    UsuarioRepository,
    SesionRepository,
    PASSWORD_HASHER,
  ],
})
export class AuthModule {}
