import 'dotenv/config';
import { CurationService } from '../src/modules/catalog/application/curation.service';
import { AuditService } from '../src/modules/catalog/infrastructure/audit.service';
import { CatalogPricingConfigurationRepository } from '../src/modules/catalog/infrastructure/catalog-pricing-configuration.repository';
import { MasterServiceRepository } from '../src/modules/catalog/infrastructure/master-service.repository';
import { ProviderServiceRepository } from '../src/modules/catalog/infrastructure/provider-service.repository';
import { StagedServiceRepository } from '../src/modules/catalog/infrastructure/staged-service.repository';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  const prisma = new PrismaService();

  try {
    const curationService = new CurationService(
      new StagedServiceRepository(prisma),
      new ProviderServiceRepository(prisma),
      new MasterServiceRepository(prisma),
      new AuditService(prisma),
      new CatalogPricingConfigurationRepository(prisma),
    );
    const report = apply
      ? await curationService.promotePending('catalog-promotion-script')
      : await curationService.previewPromotion();

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          ...report,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
