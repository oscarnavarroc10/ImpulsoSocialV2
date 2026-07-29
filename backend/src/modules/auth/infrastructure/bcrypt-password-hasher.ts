import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PasswordHasher } from '../application/password-hasher.interface';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    const configuredSaltRounds =
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') ?? '12';

    const parsedSaltRounds = Number(configuredSaltRounds);

    if (
      !Number.isInteger(parsedSaltRounds) ||
      parsedSaltRounds < 10 ||
      parsedSaltRounds > 15
    ) {
      throw new Error(
        'BCRYPT_SALT_ROUNDS debe ser un número entero entre 10 y 15',
      );
    }

    this.saltRounds = parsedSaltRounds;
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
