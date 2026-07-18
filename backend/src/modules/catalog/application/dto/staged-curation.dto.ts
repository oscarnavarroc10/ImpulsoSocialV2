import { BadRequestException } from '@nestjs/common';

export class StagedCurationDto {
  stagedServiceId!: string;
  action!: 'approve' | 'reject';
  curatedTitle?: string;
  curatedDescription?: string;
  curatedCategoryId?: string;

  static validate(body: unknown): StagedCurationDto {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Invalid payload');
    const b = body as Record<string, unknown>;
    if (!b.stagedServiceId || typeof b.stagedServiceId !== 'string')
      throw new BadRequestException(
        'stagedServiceId is required and must be a string',
      );
    if (!['approve', 'reject'].includes(String(b.action)))
      throw new BadRequestException('action must be approve or reject');
    const dto = new StagedCurationDto();
    dto.stagedServiceId = b.stagedServiceId;
    dto.action = b.action as 'approve' | 'reject';
    dto.curatedTitle =
      typeof b.curatedTitle === 'string' ? b.curatedTitle : undefined;
    dto.curatedDescription =
      typeof b.curatedDescription === 'string'
        ? b.curatedDescription
        : undefined;
    dto.curatedCategoryId =
      typeof b.curatedCategoryId === 'string' ? b.curatedCategoryId : undefined;
    return dto;
  }
}
