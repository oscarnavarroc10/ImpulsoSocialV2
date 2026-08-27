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

export interface RotateSessionInput {
  oldSessionId: string;
  usuarioId: string;
  oldRefreshTokenHash: string;
  newSessionId: string;
  newRefreshTokenHash: string;
  newExpiraEn: Date;
  direccionIp?: string;
  dispositivo?: string;
}

// Internal control-flow signal to roll back the transaction on a lost race.
class SessionRotationConflictError extends Error {}

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

  /**
   * Atomically revokes the exact active old session and creates its
   * replacement. Returns `false` without persisting anything when the old
   * session no longer matches (already rotated, revoked, or expired), so
   * only one of several concurrent/replayed attempts can succeed.
   */
  async rotate(input: RotateSessionInput): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const revoked = await tx.sesionUsuario.updateMany({
          where: {
            id: input.oldSessionId,
            usuarioId: input.usuarioId,
            refreshTokenHash: input.oldRefreshTokenHash,
            revocadaEn: null,
            expiraEn: { gt: new Date() },
          },
          data: {
            revocadaEn: new Date(),
          },
        });

        if (revoked.count !== 1) {
          throw new SessionRotationConflictError();
        }

        await tx.sesionUsuario.create({
          data: {
            id: input.newSessionId,
            usuarioId: input.usuarioId,
            refreshTokenHash: input.newRefreshTokenHash,
            expiraEn: input.newExpiraEn,
            direccionIp: input.direccionIp,
            dispositivo: input.dispositivo,
          },
        });
      });

      return true;
    } catch (error: unknown) {
      if (error instanceof SessionRotationConflictError) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Idempotently revokes only the active session matching this hash. Never
   * throws for an unknown, already-revoked, or expired hash.
   */
  async revokeActiveByHash(refreshTokenHash: string): Promise<void> {
    await this.prisma.sesionUsuario.updateMany({
      where: {
        refreshTokenHash,
        revocadaEn: null,
      },
      data: {
        revocadaEn: new Date(),
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
