import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { DuplicateUserEmailError } from '../domain/auth.errors';

const registeredUserSelect = {
  id: true,
  tiendaId: true,
  nombre: true,
  email: true,
  rol: true,
} satisfies Prisma.UsuarioSelect;

export type RegisteredUser = Prisma.UsuarioGetPayload<{
  select: typeof registeredUserSelect;
}>;

export interface CreateRegisteredUserInput {
  usuarioId: string;
  sesionId: string;
  tiendaId: string;
  moneda: string;
  nombre: string;
  email: string;
  passwordHash: string;
  refreshTokenHash: string;
  refreshTokenExpiraEn: Date;
  direccionIp?: string;
  dispositivo?: string;
}

@Injectable()
export class UsuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async existsByEmail(tiendaId: string, email: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        tiendaId_email: {
          tiendaId,
          email,
        },
      },
      select: {
        id: true,
      },
    });

    return usuario !== null;
  }

  async createRegisteredUser(
    input: CreateRegisteredUserInput,
  ): Promise<RegisteredUser> {
    try {
      return await this.prisma.usuario.create({
        data: {
          id: input.usuarioId,
          tiendaId: input.tiendaId,
          nombre: input.nombre,
          email: input.email,
          passwordHash: input.passwordHash,

          billeteras: {
            create: {
              tiendaId: input.tiendaId,
              moneda: input.moneda,
            },
          },

          sesiones: {
            create: {
              id: input.sesionId,
              refreshTokenHash: input.refreshTokenHash,
              expiraEn: input.refreshTokenExpiraEn,
              direccionIp: input.direccionIp,
              dispositivo: input.dispositivo,
            },
          },
        },

        select: registeredUserSelect,
      });
    } catch (error: unknown) {
      if (this.isDuplicateEmailError(error)) {
        throw new DuplicateUserEmailError();
      }

      throw error;
    }
  }

  private isDuplicateEmailError(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.includes('tiendaId') && target.includes('email');
    }

    if (typeof target === 'string') {
      const normalizedTarget = target.toLowerCase();

      return (
        normalizedTarget.includes('tiendaid') &&
        normalizedTarget.includes('email')
      );
    }

    /*
     * Algunos drivers no informan correctamente el nombre de la restricción.
     * En esta operación, la colisión esperable es el índice único del correo
     * por tienda; los UUID y el hash del refresh token se generan internamente.
     */
    return true;
  }
}
