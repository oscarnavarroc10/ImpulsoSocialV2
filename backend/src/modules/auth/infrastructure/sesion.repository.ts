import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

const sessionSelect = {
  id: true,
  usuarioId: true,
  refreshTokenHash: true,
  expiraEn: true,
  revocadaEn: true,
} satisfies Prisma.SesionUsuarioSelect;

export type UserSession = Prisma.SesionUsuarioGetPayload<{
  select: typeof sessionSelect;
}>;

export interface CreateSessionInput {
  id: string;
  usuarioId: string;
  refreshTokenHash: string;
  expiraEn: Date;
  direccionIp?: string;
  dispositivo?: string;
}

@Injectable()
export class SesionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<void> {
    await this.prisma.sesionUsuario.create({
      data: {
        id: input.id,
        usuarioId: input.usuarioId,
        refreshTokenHash: input.refreshTokenHash,
        expiraEn: input.expiraEn,
        direccionIp: input.direccionIp,
        dispositivo: input.dispositivo,
      },
    });
  }

  findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<UserSession | null> {
    return this.prisma.sesionUsuario.findUnique({
      where: {
        refreshTokenHash,
      },
      select: sessionSelect,
    });
  }

  findById(sessionId: string): Promise<UserSession | null> {
    return this.prisma.sesionUsuario.findUnique({
      where: {
        id: sessionId,
      },
      select: sessionSelect,
    });
  }

  revokeById(sessionId: string): Promise<void> {
    return this.prisma.sesionUsuario
      .update({
        where: {
          id: sessionId,
        },
        data: {
          revocadaEn: new Date(),
        },
      })
      .then(() => undefined);
  }

  revokeByRefreshTokenHash(refreshTokenHash: string): Promise<void> {
    return this.prisma.sesionUsuario
      .update({
        where: {
          refreshTokenHash,
        },
        data: {
          revocadaEn: new Date(),
        },
      })
      .then(() => undefined);
  }

  revokeAllByUser(userId: string): Promise<{ count: number }> {
    return this.prisma.sesionUsuario.updateMany({
      where: {
        usuarioId: userId,
        revocadaEn: null,
      },
      data: {
        revocadaEn: new Date(),
      },
    });
  }
}
