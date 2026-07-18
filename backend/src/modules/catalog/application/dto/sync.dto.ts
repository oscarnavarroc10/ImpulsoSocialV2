import { BadRequestException } from '@nestjs/common';

export class SyncDto {
  providerOrigin?: string;
  runFull?: boolean;

  static validate(body: unknown): SyncDto {
    if (body && typeof body !== 'object')
      throw new BadRequestException('Invalid sync payload');
    const b = body as Record<string, unknown> | undefined;
    if (b?.providerOrigin != null && typeof b.providerOrigin !== 'string')
      throw new BadRequestException('providerOrigin must be a string');
    if (b?.runFull != null && typeof b.runFull !== 'boolean')
      throw new BadRequestException('runFull must be boolean');
    const dto = new SyncDto();
    dto.providerOrigin = b?.providerOrigin as string | undefined;
    dto.runFull = (b?.runFull as boolean) ?? false;
    return dto;
  }
}
