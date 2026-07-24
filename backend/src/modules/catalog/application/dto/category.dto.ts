import { BadRequestException } from '@nestjs/common';

export class CategoryDto {
  name?: string;
  description?: string;

  static validate(body: unknown): CategoryDto {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Invalid payload');
    const b = body as Record<string, unknown>;
    if (!b.name || typeof b.name !== 'string')
      throw new BadRequestException('name is required');
    const dto = new CategoryDto();
    dto.name = b.name;
    dto.description =
      typeof b.description === 'string' ? b.description : undefined;
    return dto;
  }

  static validateUpdate(body: unknown): CategoryDto {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Invalid payload');
    }

    const b = body as Record<string, unknown>;
    const dto = new CategoryDto();

    if (b.name !== undefined) {
      if (typeof b.name !== 'string') {
        throw new BadRequestException('name must be a string');
      }
      dto.name = b.name;
    }

    if (b.description !== undefined) {
      if (typeof b.description !== 'string') {
        throw new BadRequestException('description must be a string');
      }
      dto.description = b.description;
    }

    if (dto.name === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'At least one field must be provided to update category',
      );
    }

    return dto;
  }
}
