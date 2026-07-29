import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SesionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async revokeByRefreshTokenHash(refreshTokenHash: string): Promise<boolean> {
    const result = await this.prisma.sesionUsuario.updateMany({
      where: {
        refreshTokenHash,
        revocadaEn: null,
      },
      data: {
        revocadaEn: new Date(),
      },
    });

    return result.count > 0;
  }
}
