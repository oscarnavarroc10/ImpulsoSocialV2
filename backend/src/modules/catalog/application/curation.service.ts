import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../infrastructure/audit.service';
import { MasterServiceRepository } from '../infrastructure/master-service.repository';
import { ProviderServiceRepository } from '../infrastructure/provider-service.repository';
import { StagedServiceRepository } from '../infrastructure/staged-service.repository';
import { StagedCurationDto } from './dto/staged-curation.dto';

const PLATFORM_BASE_CURRENCY = 'PLATFORM_BASE_CURRENCY';
const BULKFOLLOWS_RATE_CURRENCY = 'BULKFOLLOWS_RATE_CURRENCY';
const BULKFOLLOWS_TO_PLATFORM_EXCHANGE_RATE =
  'BULKFOLLOWS_TO_PLATFORM_EXCHANGE_RATE';
const MAX_DECIMAL_PLACES = 8;
const PRISMA_INT_MAX = 2_147_483_647n;

type ParsedDecimal = {
  unscaled: bigint;
  scale: bigint;
};

function readCurrency(name: string): string {
  const currency = process.env[name]?.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException(
      `${name} must be configured as a three-letter currency code`,
    );
  }
  return currency;
}

const DECIMAL_PATTERN = new RegExp(
  `^\\d+(?:\\.\\d{1,${MAX_DECIMAL_PLACES}})?$`,
);

function parsePositiveDecimal(
  value: unknown,
  errorMessage: string,
): ParsedDecimal {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new BadRequestException(errorMessage);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(errorMessage);
  }

  const raw = typeof value === 'number' ? value.toString() : value;
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new BadRequestException(errorMessage);
  }

  const [wholePart, fractionalPart = ''] = raw.split('.');
  const scale = 10n ** BigInt(fractionalPart.length);
  const unscaled =
    BigInt(wholePart) * scale + BigInt(fractionalPart || '0');

  if (unscaled <= 0n) {
    throw new BadRequestException(errorMessage);
  }

  return { unscaled, scale };
}

function readProviderRate(rawPayload: unknown): ParsedDecimal {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new BadRequestException('Provider payload is missing for approval');
  }

  const rate = (rawPayload as Record<string, unknown>).rate;
  return parsePositiveDecimal(
    rate,
    'Provider payload does not contain a normalized rate value',
  );
}

function toPrismaInt(value: bigint, errorMessage: string): number {
  if (value > PRISMA_INT_MAX) {
    throw new BadRequestException(errorMessage);
  }
  return Number(value);
}

function roundToMinorUnits(decimal: ParsedDecimal): number {
  const scaled = decimal.unscaled * 100n;
  const quotient = scaled / decimal.scale;
  const remainder = scaled % decimal.scale;
  const rounded = quotient + (remainder * 2n >= decimal.scale ? 1n : 0n);

  return toPrismaInt(rounded, 'Provider rate exceeds the supported range');
}

function calculateSellingPriceMinorUnits(
  providerRate: ParsedDecimal,
  exchangeRate: ParsedDecimal,
  multiplier: number,
): number {
  const numerator =
    providerRate.unscaled *
    exchangeRate.unscaled *
    BigInt(multiplier) *
    100n;
  const denominator = providerRate.scale * exchangeRate.scale;
  const roundedUp = (numerator + denominator - 1n) / denominator;

  return toPrismaInt(
    roundedUp,
    'Calculated selling price exceeds the supported range',
  );
}

@Injectable()
export class CurationService {
  constructor(
    private readonly stagedServiceRepository: StagedServiceRepository,
    private readonly providerServiceRepository: ProviderServiceRepository,
    private readonly masterServiceRepository: MasterServiceRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPending(limit = 100) {
    return this.stagedServiceRepository.findPending(limit);
  }

  async curate(actorId: string, dto: StagedCurationDto) {
    return dto.action === 'approve'
      ? this.approve(actorId, dto)
      : this.reject(actorId, dto.stagedServiceId);
  }

  private async approve(actorId: string, dto: StagedCurationDto) {
    const stagedService = await this.stagedServiceRepository.findById(
      dto.stagedServiceId,
    );
    if (!stagedService) {
      throw new NotFoundException('Staged service not found');
    }
    if (stagedService.reviewStatus !== 'pending') {
      throw new BadRequestException(
        'Only pending staged services can be approved',
      );
    }

    const providerService = await this.providerServiceRepository.findById(
      stagedService.providerServiceId,
    );
    if (!providerService) {
      throw new NotFoundException('Provider service not found');
    }

    const providerRate = readProviderRate(providerService.rawPayload);
    const providerCostAmount = roundToMinorUnits(providerRate);
    const providerCostCurrency = readCurrency(BULKFOLLOWS_RATE_CURRENCY);
    const platformBaseCurrency = readCurrency(PLATFORM_BASE_CURRENCY);

    let defaultSellingPriceAmount: number;
    let defaultSellingPriceCurrency: string;

    if (dto.sellingPriceMultiplier != null) {
      const exchangeRate =
        providerCostCurrency === platformBaseCurrency
          ? { unscaled: 1n, scale: 1n }
          : parsePositiveDecimal(
              process.env[BULKFOLLOWS_TO_PLATFORM_EXCHANGE_RATE]?.trim(),
              `${BULKFOLLOWS_TO_PLATFORM_EXCHANGE_RATE} must be configured as a positive decimal`,
            );

      defaultSellingPriceAmount = calculateSellingPriceMinorUnits(
        providerRate,
        exchangeRate,
        dto.sellingPriceMultiplier,
      );
      defaultSellingPriceCurrency = platformBaseCurrency;
    } else {
      if (
        dto.defaultSellingPriceAmount == null ||
        dto.defaultSellingPriceCurrency == null
      ) {
        throw new BadRequestException(
          'Manual selling price amount and currency are required',
        );
      }
      if (dto.defaultSellingPriceCurrency !== platformBaseCurrency) {
        throw new BadRequestException(
          `Manual selling price currency must match ${PLATFORM_BASE_CURRENCY}`,
        );
      }
      defaultSellingPriceAmount = dto.defaultSellingPriceAmount;
      defaultSellingPriceCurrency = dto.defaultSellingPriceCurrency;
    }

    const existing = await this.masterServiceRepository.findByProvenance(
      providerService.id,
    );

    const approvalData = {
      title: dto.curatedTitle!,
      description: dto.curatedDescription!,
      categoryId: dto.curatedCategoryId!,
      socialNetwork: dto.curatedSocialNetwork!,
      providerCostAmount,
      providerCostCurrency,
      defaultSellingPriceAmount,
      defaultSellingPriceCurrency,
      isVisible: dto.isVisible!,
      status: 'active' as const,
      provenanceRef: providerService.id,
    };

    const masterService = existing
      ? await this.masterServiceRepository.applyApproval(
          existing.id,
          approvalData,
        )
      : await this.masterServiceRepository.createCurated(approvalData);

    await this.stagedServiceRepository.updateReviewStatus(
      stagedService.id,
      'approved',
    );
    await this.auditService.recordCuration(actorId, {
      action: 'approve',
      stagedServiceId: stagedService.id,
      providerServiceId: providerService.id,
      masterServiceId: masterService.id,
      curatedFields: {
        title: approvalData.title,
        description: approvalData.description,
        categoryId: approvalData.categoryId,
        socialNetwork: approvalData.socialNetwork,
        defaultSellingPriceAmount: approvalData.defaultSellingPriceAmount,
        defaultSellingPriceCurrency: approvalData.defaultSellingPriceCurrency,
        pricingStrategy:
          dto.sellingPriceMultiplier == null ? 'manual' : 'multiplier',
        ...(dto.sellingPriceMultiplier == null
          ? {}
          : { sellingPriceMultiplier: dto.sellingPriceMultiplier }),
        isVisible: approvalData.isVisible,
      },
      providerCost: {
        amount: approvalData.providerCostAmount,
        currency: approvalData.providerCostCurrency,
      },
    });

    return {
      stagedServiceId: stagedService.id,
      action: 'approve' as const,
      masterService,
    };
  }

  private async reject(actorId: string, stagedServiceId: string) {
    const stagedService =
      await this.stagedServiceRepository.findById(stagedServiceId);
    if (!stagedService) {
      throw new NotFoundException('Staged service not found');
    }
    if (stagedService.reviewStatus !== 'pending') {
      throw new BadRequestException(
        'Only pending staged services can be rejected',
      );
    }

    await this.stagedServiceRepository.updateReviewStatus(
      stagedService.id,
      'rejected',
    );
    await this.auditService.recordCuration(actorId, {
      action: 'reject',
      stagedServiceId: stagedService.id,
    });

    return {
      stagedServiceId: stagedService.id,
      action: 'reject' as const,
    };
  }
}
