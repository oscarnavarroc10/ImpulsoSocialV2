import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

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
}
