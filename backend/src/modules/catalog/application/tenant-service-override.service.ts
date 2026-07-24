import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MasterServiceRepository } from '../infrastructure/master-service.repository';
import {
  TenantServiceOverrideRepository,
  type TenantServiceOverrideWriteModel,
} from '../infrastructure/tenant-service-override.repository';
import {
  assertCurrencyConsistency,
  type OptionalMonetaryInput,
  validateOptionalMonetary,
} from './pricing.validation';

export interface CreateTenantServiceOverrideInput {
  tenantId: string;
  masterServiceId: string;
  isEnabled: boolean;
  sellingPriceAmount?: number;
  sellingPriceCurrency?: string;
}

export interface UpdateTenantServiceOverrideInput {
  isEnabled?: boolean;
  sellingPriceAmount?: number | null;
  sellingPriceCurrency?: string | null;
}

@Injectable()
export class TenantServiceOverrideService {
  constructor(
    private readonly repository: TenantServiceOverrideRepository,
    private readonly masterServiceRepository: MasterServiceRepository,
  ) {}

  async listByTenant(tenantId: string) {
    this.ensureNonEmpty(tenantId, 'tenantId');

    const rows = await this.repository.findByTenantId(tenantId);
    return rows.map((row) => this.toResponse(row));
  }

  async get(tenantId: string, masterServiceId: string) {
    this.ensureNonEmpty(tenantId, 'tenantId');
    this.ensureNonEmpty(masterServiceId, 'masterServiceId');

    const existing = await this.repository.findByTenantAndMasterService(
      tenantId,
      masterServiceId,
    );
    if (!existing) {
      throw new NotFoundException('Tenant service override not found');
    }

    return this.toResponse(existing);
  }

  async create(input: CreateTenantServiceOverrideInput) {
    this.ensureNonEmpty(input.tenantId, 'tenantId');
    this.ensureNonEmpty(input.masterServiceId, 'masterServiceId');

    const existing = await this.repository.findByTenantAndMasterService(
      input.tenantId,
      input.masterServiceId,
    );
    if (existing) {
      throw new ConflictException(
        'Tenant override already exists for this tenant and master service',
      );
    }

    const master = await this.masterServiceRepository.findById(
      input.masterServiceId,
    );
    if (!master) {
      throw new NotFoundException('Master service not found');
    }

    const validatedSellingPrice = this.validateAgainstMasterCurrency(
      {
        amount: input.sellingPriceAmount,
        currency: input.sellingPriceCurrency,
      },
      master.defaultSellingPriceCurrency,
    );

    const created = await this.repository.create({
      tenantId: input.tenantId,
      masterServiceId: input.masterServiceId,
      isEnabled: input.isEnabled,
      sellingPriceAmount: validatedSellingPrice?.amount ?? null,
      sellingPriceCurrency: validatedSellingPrice?.currency ?? null,
    });

    return this.toResponse(created);
  }

  async update(
    tenantId: string,
    masterServiceId: string,
    input: UpdateTenantServiceOverrideInput,
  ) {
    this.ensureNonEmpty(tenantId, 'tenantId');
    this.ensureNonEmpty(masterServiceId, 'masterServiceId');

    const existing = await this.repository.findByTenantAndMasterService(
      tenantId,
      masterServiceId,
    );
    if (!existing) {
      throw new NotFoundException('Tenant service override not found');
    }

    const master = await this.masterServiceRepository.findById(masterServiceId);
    if (!master) {
      throw new NotFoundException('Master service not found');
    }

    const pricingInput = this.resolvePricingUpdateInput(input, existing);
    const validatedSellingPrice = this.validateAgainstMasterCurrency(
      pricingInput,
      master.defaultSellingPriceCurrency,
    );

    const nextIsEnabled = input.isEnabled ?? existing.isEnabled;
    if (typeof nextIsEnabled !== 'boolean') {
      throw new BadRequestException('isEnabled must be a boolean');
    }

    const updated = await this.repository.update(tenantId, masterServiceId, {
      isEnabled: nextIsEnabled,
      sellingPriceAmount: validatedSellingPrice?.amount ?? null,
      sellingPriceCurrency: validatedSellingPrice?.currency ?? null,
    });

    return this.toResponse(updated);
  }

  async remove(tenantId: string, masterServiceId: string) {
    this.ensureNonEmpty(tenantId, 'tenantId');
    this.ensureNonEmpty(masterServiceId, 'masterServiceId');

    const existing = await this.repository.findByTenantAndMasterService(
      tenantId,
      masterServiceId,
    );
    if (!existing) {
      throw new NotFoundException('Tenant service override not found');
    }

    await this.repository.delete(tenantId, masterServiceId);
    return {
      tenantId,
      masterServiceId,
      action: 'deleted' as const,
    };
  }

  private resolvePricingUpdateInput(
    input: UpdateTenantServiceOverrideInput,
    existing: {
      sellingPriceAmount: number | null;
      sellingPriceCurrency: string | null;
    },
  ): OptionalMonetaryInput {
    const priceWasProvided =
      input.sellingPriceAmount !== undefined ||
      input.sellingPriceCurrency !== undefined;

    if (!priceWasProvided) {
      return {
        amount: existing.sellingPriceAmount,
        currency: existing.sellingPriceCurrency,
      };
    }

    return {
      amount: input.sellingPriceAmount,
      currency: input.sellingPriceCurrency,
    };
  }

  private validateAgainstMasterCurrency(
    pricingInput: OptionalMonetaryInput,
    masterCurrency: string,
  ) {
    const validated = validateOptionalMonetary(pricingInput, 'sellingPrice');
    if (!validated) {
      return null;
    }

    assertCurrencyConsistency(
      validated.currency,
      masterCurrency,
      'sellingPriceCurrency must match the master service default currency',
    );

    return validated;
  }

  private ensureNonEmpty(value: string, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }
  }

  private toResponse(row: TenantServiceOverrideWriteModel & { id: string }) {
    return {
      id: row.id,
      tenantId: row.tenantId,
      masterServiceId: row.masterServiceId,
      isEnabled: row.isEnabled,
      sellingPrice:
        row.sellingPriceAmount == null || row.sellingPriceCurrency == null
          ? null
          : {
              amount: row.sellingPriceAmount,
              currency: row.sellingPriceCurrency,
            },
    };
  }
}