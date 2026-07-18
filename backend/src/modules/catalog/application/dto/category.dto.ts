import { BadRequestException } from '@nestjs/common';

export class CategoryDto {
  name!: string;
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
}
