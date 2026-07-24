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