import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoryCreateInput,
  CategoryEntity,
  CategoryUpdateInput,
} from '../domain/category.entity';
import { CategoryRepository } from '../infrastructure/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async list() {
    const rows = await this.categoryRepository.findAll();
    return rows.map((row) => CategoryEntity.fromPersistence(row).toPrimitives());
  }

  async getById(id: string) {
    const row = await this.categoryRepository.findById(id);
    if (!row) {
      throw new NotFoundException('Category not found');
    }

    return CategoryEntity.fromPersistence(row).toPrimitives();
  }

  async create(input: CategoryCreateInput) {
    const data = CategoryEntity.create(input);
    await this.ensureUniqueName(data.name);

    const created = await this.categoryRepository.create(data);
    return CategoryEntity.fromPersistence(created).toPrimitives();
  }

  async update(id: string, input: CategoryUpdateInput) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const entity = CategoryEntity.fromPersistence(existing);
    const updateData = entity.update(input);
    await this.ensureUniqueName(updateData.name, id);

    const updated = await this.categoryRepository.update(id, updateData);
    return CategoryEntity.fromPersistence(updated).toPrimitives();
  }

  async remove(id: string) {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const linkedServicesCount =
      await this.categoryRepository.countMasterServicesUsingCategory(id);
    if (linkedServicesCount > 0) {
      throw new BadRequestException(
        'Category cannot be deleted while it is assigned to active catalog services',
      );
    }

    await this.categoryRepository.delete(id);
    return {
      categoryId: id,
      action: 'deleted' as const,
    };
  }

  private async ensureUniqueName(name: string, excludeId?: string) {
    const rows = await this.categoryRepository.findAll();
    const normalized = name.toLocaleLowerCase();

    const duplicate = rows.find((row) => {
      if (excludeId && row.id === excludeId) {
        return false;
      }

      const current = CategoryEntity.fromPersistence(row);
      return current.normalizedName() === normalized;
    });

    if (duplicate) {
      throw new BadRequestException('Category name must be unique');
    }
  }
}