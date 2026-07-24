import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantServiceOverrideDto } from '../application/dto/tenant-service-override.dto';
import {
  TenantServiceOverrideService,
  type UpdateTenantServiceOverrideInput,
} from '../application/tenant-service-override.service';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

function parseIdentifier(value: string, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function parseUpdatePayload(body: unknown): UpdateTenantServiceOverrideInput {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Request body must be an object');
  }

  const data = body as {
    isEnabled?: unknown;
    sellingPriceAmount?: unknown;
    sellingPriceCurrency?: unknown;
  };

  const hasIsEnabled = data.isEnabled !== undefined;
  const hasAmount = data.sellingPriceAmount !== undefined;
  const hasCurrency = data.sellingPriceCurrency !== undefined;
  if (!hasIsEnabled && !hasAmount && !hasCurrency) {
    throw new BadRequestException('At least one field must be provided');
  }

  if (hasIsEnabled && typeof data.isEnabled !== 'boolean') {
    throw new BadRequestException('isEnabled must be a boolean');
  }

  if (
    hasAmount &&
    data.sellingPriceAmount !== null &&
    !Number.isInteger(data.sellingPriceAmount)
  ) {
    throw new BadRequestException(
      'sellingPriceAmount must be integer minor units or null',
    );
  }

  if (
    hasCurrency &&
    data.sellingPriceCurrency !== null &&
    typeof data.sellingPriceCurrency !== 'string'
  ) {
    throw new BadRequestException('sellingPriceCurrency must be string or null');
  }

  return {
    isEnabled: hasIsEnabled ? (data.isEnabled as boolean) : undefined,
    sellingPriceAmount: hasAmount
      ? (data.sellingPriceAmount as number | null)
      : undefined,
    sellingPriceCurrency: hasCurrency
      ? (data.sellingPriceCurrency as string | null)
      : undefined,
  };
}

@Controller('catalog/tenant-service-overrides')
@UseGuards(CatalogAuthorizationGuard)
export class TenantServiceOverrideController {
  constructor(
    private readonly tenantServiceOverrideService: TenantServiceOverrideService,
  ) {}

  @Get()
  async list(@Query('tenantId') tenantId: string) {
    return this.tenantServiceOverrideService.listByTenant(
      parseIdentifier(tenantId, 'tenantId'),
    );
  }

  @Get(':tenantId/:masterServiceId')
  async get(
    @Param('tenantId') tenantId: string,
    @Param('masterServiceId') masterServiceId: string,
  ) {
    return this.tenantServiceOverrideService.get(
      parseIdentifier(tenantId, 'tenantId'),
      parseIdentifier(masterServiceId, 'masterServiceId'),
    );
  }

  @Post()
  async create(@Body() body: unknown) {
    const dto = TenantServiceOverrideDto.validate(body);
    return this.tenantServiceOverrideService.create({
      tenantId: parseIdentifier(dto.tenantId, 'tenantId'),
      masterServiceId: parseIdentifier(dto.masterServiceId, 'masterServiceId'),
      isEnabled: dto.isEnabled,
      sellingPriceAmount: dto.sellingPriceAmount,
      sellingPriceCurrency: dto.sellingPriceCurrency,
    });
  }

  @Patch(':tenantId/:masterServiceId')
  async update(
    @Param('tenantId') tenantId: string,
    @Param('masterServiceId') masterServiceId: string,
    @Body() body: unknown,
  ) {
    return this.tenantServiceOverrideService.update(
      parseIdentifier(tenantId, 'tenantId'),
      parseIdentifier(masterServiceId, 'masterServiceId'),
      parseUpdatePayload(body),
    );
  }

  @Delete(':tenantId/:masterServiceId')
  async remove(
    @Param('tenantId') tenantId: string,
    @Param('masterServiceId') masterServiceId: string,
  ) {
    return this.tenantServiceOverrideService.remove(
      parseIdentifier(tenantId, 'tenantId'),
      parseIdentifier(masterServiceId, 'masterServiceId'),
    );
  }
}