import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  PublicCatalogQueryDto,
  PublicCatalogServiceDto,
  PublicCatalogListResponseDto,
} from './dto/public-catalog.dto';
import {
  PublicCatalogRepository,
  PublicCatalogRow,
} from '../infrastructure/public-catalog.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function mapRowToDto(row: PublicCatalogRow): PublicCatalogServiceDto {
  const hasCompleteOverride =
    row.tenantOverride?.sellingPriceAmount != null &&
    row.tenantOverride?.sellingPriceCurrency != null;

  const sellingPrice = hasCompleteOverride
    ? {
        amount: row.tenantOverride!.sellingPriceAmount!,
        currency: row.tenantOverride!.sellingPriceCurrency!,
      }
    : {
        amount: row.defaultSellingPriceAmount,
        currency: row.defaultSellingPriceCurrency,
      };

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    socialNetwork: row.socialNetwork,
    categoryId: row.categoryId,
    sellingPrice,
  };
}

@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly configService: ConfigService,
    private readonly repository: PublicCatalogRepository,
  ) {}

  async list(
    query: PublicCatalogQueryDto,
  ): Promise<PublicCatalogListResponseDto> {
    const tenantId = await this.resolveActiveTenantId();
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters = {
      socialNetwork: query.socialNetwork,
      categoryId: query.categoryId,
    };
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.repository.findMany(tenantId, filters, skip, limit),
      this.repository.count(tenantId, filters),
    ]);

    return {
      items: rows.map(mapRowToDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string): Promise<PublicCatalogServiceDto> {
    const tenantId = await this.resolveActiveTenantId();
    const row = await this.repository.findEligibleById(tenantId, id);
    if (!row) {
      throw new NotFoundException('Service not found');
    }

    return mapRowToDto(row);
  }

  private async resolveActiveTenantId(): Promise<string> {
    const rawSlug = this.configService.get<string>('DEFAULT_TENANT_SLUG');
    const slug = rawSlug?.trim().toLowerCase();
    if (!slug) {
      throw new InternalServerErrorException(
        'DEFAULT_TENANT_SLUG is not configured',
      );
    }

    const tenantId = await this.repository.findActiveTenantIdBySlug(slug);
    if (!tenantId) {
      throw new InternalServerErrorException(
        'The configured tenant does not exist or is not active',
      );
    }

    return tenantId;
  }
}
