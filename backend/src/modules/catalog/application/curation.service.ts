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

function readPlatformBaseCurrency(): string {
  const currency = process.env[PLATFORM_BASE_CURRENCY]?.trim();
  if (!currency) {
    throw new BadRequestException(
      `${PLATFORM_BASE_CURRENCY} must be configured for curation approval`,
    );
  }
  return currency;
}

// Whole part plus at most 2 fractional digits; no sign, no thousands separators.
const DECIMAL_MINOR_UNITS_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Converts a non-negative decimal amount (at most 2 fractional digits) into
 * integer minor units (cents) using string/BigInt arithmetic exclusively, so
 * the conversion never routes through floating-point `Number` multiplication.
 */
function parseDecimalToMinorUnits(
  value: unknown,
  errorMessage: string,
): number {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new BadRequestException(errorMessage);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BadRequestException(errorMessage);
  }

  const raw = typeof value === 'number' ? value.toString() : value;
  if (!DECIMAL_MINOR_UNITS_PATTERN.test(raw)) {
    throw new BadRequestException(errorMessage);
  }

  const [wholePart, fractionalPart = ''] = raw.split('.');
  const minorUnits =
    BigInt(wholePart) * 100n + BigInt(fractionalPart.padEnd(2, '0'));

  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BadRequestException(errorMessage);
  }

  return Number(minorUnits);
}

function parseProviderCostMinorUnits(rawPayload: unknown): number {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new BadRequestException('Provider payload is missing for approval');
  }

  const rate = (rawPayload as Record<string, unknown>).rate;
  return parseDecimalToMinorUnits(
    rate,
    'Provider payload does not contain a normalized rate value',
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

    const providerCostAmount = parseProviderCostMinorUnits(
      providerService.rawPayload,
    );
    const providerCostCurrency = readPlatformBaseCurrency();

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
      defaultSellingPriceAmount: dto.defaultSellingPriceAmount!,
      defaultSellingPriceCurrency: dto.defaultSellingPriceCurrency!,
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
