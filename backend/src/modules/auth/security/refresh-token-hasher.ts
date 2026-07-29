import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class RefreshTokenHasher {
  hash(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
