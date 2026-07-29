import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { AuthTokenService } from './application/auth-token.service';
import { PASSWORD_HASHER } from './application/password-hasher.interface';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { SesionRepository } from './infrastructure/sesion.repository';
import { UsuarioRepository } from './infrastructure/usuario.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    UsuarioRepository,
    SesionRepository,
    BcryptPasswordHasher,
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
