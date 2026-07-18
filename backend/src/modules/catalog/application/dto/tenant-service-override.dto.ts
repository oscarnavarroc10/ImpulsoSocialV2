import { BadRequestException } from '@nestjs/common';

export class TenantServiceOverrideDto {
  tenantId!: string;
  masterServiceId!: string;
  isEnabled!: boolean;
  sellingPriceAmount?: number;
  sellingPriceCurrency?: string;

  static validate(body: unknown): TenantServiceOverrideDto {
    if (!body || typeof body !== 'object')
      throw new BadRequestException('Invalid payload');
    const b = body as Record<string, unknown>;
    if (!b.tenantId) throw new BadRequestException('tenantId is required');
    if (!b.masterServiceId)
      throw new BadRequestException('masterServiceId is required');
    if (typeof b.isEnabled !== 'boolean')
      throw new BadRequestException(
        'isEnabled is required and must be boolean',
      );
    if (b.sellingPriceAmount != null && !Number.isInteger(b.sellingPriceAmount))
      throw new BadRequestException(
        'sellingPriceAmount must be integer minor units',
      );
    if (
      b.sellingPriceCurrency != null &&
      typeof b.sellingPriceCurrency !== 'string'
    )
      throw new BadRequestException('sellingPriceCurrency must be a string');
    if (typeof b.tenantId !== 'string')
      throw new BadRequestException('tenantId must be a string');
    if (typeof b.masterServiceId !== 'string')
      throw new BadRequestException('masterServiceId must be a string');
    const dto = new TenantServiceOverrideDto();
    dto.tenantId = b.tenantId;
    dto.masterServiceId = b.masterServiceId;
    dto.isEnabled = b.isEnabled;
    dto.sellingPriceAmount = b.sellingPriceAmount as number | undefined;
    dto.sellingPriceCurrency =
      typeof b.sellingPriceCurrency === 'string'
        ? b.sellingPriceCurrency
        : undefined;
    return dto;
  }
}
