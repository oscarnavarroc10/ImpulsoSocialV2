import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export const DEFAULT_CATALOG_PRICING_CONFIGURATION_ID = 'default';

@Injectable()
export class CatalogPricingConfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSellingPriceMultiplier(): Promise<string> {
    const configuration =
      await this.prisma.catalogPricingConfiguration.findUnique({
        where: { id: DEFAULT_CATALOG_PRICING_CONFIGURATION_ID },
        select: { sellingPriceMultiplier: true },
      });

    if (!configuration) {
      throw new Error('Catalog pricing multiplier configuration is missing');
    }

    return configuration.sellingPriceMultiplier.toString();
  }
}
