import { Injectable } from '@nestjs/common';
import type { Tienda } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

const tiendaAuthSelect = {
  id: true,
  nombre: true,
  slug: true,
  moneda: true,
  activa: true,
} as const;

export type TiendaAuth = Pick<
  Tienda,
  'id' | 'nombre' | 'slug' | 'moneda' | 'activa'
>;

@Injectable()
export class TiendaRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBySlug(slug: string): Promise<TiendaAuth | null> {
    return this.prisma.tienda.findUnique({
      where: {
        slug,
      },
      select: tiendaAuthSelect,
    });
  }
}
