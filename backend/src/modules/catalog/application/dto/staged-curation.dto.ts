import { BadRequestException } from '@nestjs/common';

const ALLOWED_SOCIAL_NETWORKS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'Website',
  'Other',
] as const;

export class StagedCurationDto {
  stagedServiceId!: string;
  action!: 'approve' | 'reject';
  curatedTitle?: string;
  curatedDescription?: string;
  curatedCategoryId?: string;
  curatedSocialNetwork?: (typeof ALLOWED_SOCIAL_NETWORKS)[number];
  defaultSellingPriceAmount?: number;
  defaultSellingPriceCurrency?: string;
  sellingPriceMultiplier?: number;
  isVisible?: boolean;

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

    if (typeof b.curatedSocialNetwork === 'string') {
      if (!ALLOWED_SOCIAL_NETWORKS.includes(b.curatedSocialNetwork as never)) {
        throw new BadRequestException(
          'curatedSocialNetwork must be one of Instagram, Facebook, TikTok, Website, or Other',
        );
      }
      dto.curatedSocialNetwork =
        b.curatedSocialNetwork as (typeof ALLOWED_SOCIAL_NETWORKS)[number];
    }

    if (b.defaultSellingPriceAmount != null) {
      if (
        typeof b.defaultSellingPriceAmount !== 'number' ||
        !Number.isInteger(b.defaultSellingPriceAmount) ||
        b.defaultSellingPriceAmount <= 0
      ) {
        throw new BadRequestException(
          'defaultSellingPriceAmount must be a positive integer',
        );
      }
      dto.defaultSellingPriceAmount = b.defaultSellingPriceAmount;
    }

    if (b.defaultSellingPriceCurrency != null) {
      if (
        typeof b.defaultSellingPriceCurrency !== 'string' ||
        b.defaultSellingPriceCurrency.trim().length === 0
      ) {
        throw new BadRequestException(
          'defaultSellingPriceCurrency must be a non-empty string',
        );
      }
      dto.defaultSellingPriceCurrency = b.defaultSellingPriceCurrency
        .trim()
        .toUpperCase();
    }

    if (b.sellingPriceMultiplier != null) {
      if (
        typeof b.sellingPriceMultiplier !== 'number' ||
        !Number.isInteger(b.sellingPriceMultiplier) ||
        b.sellingPriceMultiplier < 2 ||
        b.sellingPriceMultiplier > 100
      ) {
        throw new BadRequestException(
          'sellingPriceMultiplier must be an integer between 2 and 100',
        );
      }
      dto.sellingPriceMultiplier = b.sellingPriceMultiplier;
    }

    if (b.isVisible != null) {
      if (typeof b.isVisible !== 'boolean') {
        throw new BadRequestException('isVisible must be a boolean');
      }
      dto.isVisible = b.isVisible;
    }

    if (dto.action === 'approve') {
      if (!dto.curatedTitle)
        throw new BadRequestException('curatedTitle is required for approval');
      if (!dto.curatedDescription)
        throw new BadRequestException(
          'curatedDescription is required for approval',
        );
      if (!dto.curatedCategoryId)
        throw new BadRequestException(
          'curatedCategoryId is required for approval',
        );
      if (!dto.curatedSocialNetwork)
        throw new BadRequestException(
          'curatedSocialNetwork is required for approval',
        );
      const hasManualAmount = dto.defaultSellingPriceAmount != null;
      const hasManualCurrency = dto.defaultSellingPriceCurrency != null;
      const hasMultiplier = dto.sellingPriceMultiplier != null;

      if (hasManualAmount !== hasManualCurrency)
        throw new BadRequestException(
          'defaultSellingPriceAmount and defaultSellingPriceCurrency must be provided together',
        );
      if (hasMultiplier && hasManualAmount)
        throw new BadRequestException(
          'Use either sellingPriceMultiplier or a manual selling price, not both',
        );
      if (!hasMultiplier && !hasManualAmount)
        throw new BadRequestException(
          'sellingPriceMultiplier or a manual selling price is required for approval',
        );
      if (dto.isVisible == null)
        throw new BadRequestException('isVisible is required for approval');
    }

    return dto;
  }
}
