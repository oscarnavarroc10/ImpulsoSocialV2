import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findByName(name: string) {
    const categories = await this.prisma.category.findMany({
      where: {
        name: {
          equals: name,
        },
      },
      take: 1,
    });

    return categories[0] ?? null;
  }

  async findOrCreateByName(name: string) {
    const existing = await this.findByName(name);
    if (existing) {
      return existing;
    }

    const id = `catalog-category-${name
      .trim()
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;

    return this.prisma.category.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name,
        description: `Categoría comercial normalizada: ${name}`,
      },
    });
  }

  async create(data: { name: string; description: string | null }) {
    return this.prisma.category.create({ data });
  }

  async update(id: string, data: { name: string; description: string | null }) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }

  async countMasterServicesUsingCategory(categoryId: string) {
    return this.prisma.masterService.count({
      where: {
        categoryId,
        status: {
          not: 'deprecated',
        },
      },
    });
  }
}
