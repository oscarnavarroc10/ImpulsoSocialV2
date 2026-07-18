import { BadRequestException } from '@nestjs/common';

export class SnapshotDto {
  createdBy!: string;
  itemIds?: string[];

  static validate(body: unknown): SnapshotDto {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Invalid payload');
    const b = body as Record<string, unknown>;
    if (!b.createdBy || typeof b.createdBy !== 'string')
      throw new BadRequestException('createdBy is required');
    if (b.itemIds != null && !Array.isArray(b.itemIds))
      throw new BadRequestException('itemIds must be an array');
    const dto = new SnapshotDto();
    dto.createdBy = b.createdBy;
    dto.itemIds = Array.isArray(b.itemIds)
      ? (b.itemIds as string[])
      : undefined;
    return dto;
  }
}
