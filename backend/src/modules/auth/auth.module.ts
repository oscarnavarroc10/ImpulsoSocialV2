import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthTokenService } from './application/auth-token.service';
import { PASSWORD_HASHER } from './application/password-hasher.interface';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    AuthTokenService,
    BcryptPasswordHasher,
    {
      provide: PASSWORD_HASHER,
      useExisting: BcryptPasswordHasher,
    },
  ],
  exports: [AuthTokenService, PASSWORD_HASHER],
})
export class AuthModule {}
