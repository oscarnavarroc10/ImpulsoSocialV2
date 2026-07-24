import { BadRequestException } from '@nestjs/common';

export interface CategoryProps {
  id: string;
  name: string;
  description: string | null;
}

export interface CategoryCreateInput {
  name: string;
  description?: string;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export class CategoryEntity {
  private constructor(private props: CategoryProps) {}

  static fromPersistence(data: {
    id: string;
    name: string;
    description: string | null;
  }): CategoryEntity {
    return new CategoryEntity({
      id: data.id,
      name: normalizeText(data.name),
      description: data.description ? normalizeText(data.description) : null,
    });
  }

  static create(input: CategoryCreateInput): Omit<CategoryProps, 'id'> {
    const name = CategoryEntity.validateName(input.name);
    const description = CategoryEntity.normalizeDescription(input.description);

    return {
      name,
      description,
    };
  }

  update(input: CategoryUpdateInput): Pick<CategoryProps, 'name' | 'description'> {
    const nextName =
      input.name === undefined
        ? this.props.name
        : CategoryEntity.validateName(input.name);
    const nextDescription =
      input.description === undefined
        ? this.props.description
        : CategoryEntity.normalizeDescription(input.description);

    this.props = {
      ...this.props,
      name: nextName,
      description: nextDescription,
    };

    return {
      name: this.props.name,
      description: this.props.description,
    };
  }

  normalizedName(): string {
    return this.props.name.toLocaleLowerCase();
  }

  toPrimitives(): CategoryProps {
    return { ...this.props };
  }

  private static validateName(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('name must be a string');
    }

    const normalized = normalizeText(value);
    if (normalized.length === 0) {
      throw new BadRequestException('name is required');
    }

    return normalized;
  }

  private static normalizeDescription(value?: string): string | null {
    if (value === undefined) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('description must be a string');
    }

    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }
}