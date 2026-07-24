import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderServiceRepository } from './infrastructure/provider-service.repository';
import { StagedServiceRepository } from './infrastructure/staged-service.repository';
import { MasterServiceRepository } from './infrastructure/master-service.repository';
import { AuditService } from './infrastructure/audit.service';
import { SyncService } from './sync/sync.service';
import { ImportOrchestrator } from './sync/import-orchestrator';
import { CatalogAuthorizationGuard } from './security/catalog-authorization.guard';
import { CATALOG_AUTHORIZATION } from './security/catalog-authorization.interface';
import { BulkFollowsClient } from './infrastructure/bulkfollows.client';
import { PROVIDER_CATALOG_CLIENT } from './infrastructure/provider-catalog-client';
import { CurationService } from './application/curation.service';
import { StagedServiceController } from './presentation/staged-service.controller';
import { SyncController } from './presentation/sync.controller';
import { DeprecationService } from './application/deprecation.service';
import { DeprecationController } from './presentation/deprecation.controller';

// Minimal fail-closed adapter for missing external authorization integration.
const FailClosedAuthProvider = {
  provide: CATALOG_AUTHORIZATION,
  useValue: {
    getPrincipal: () => Promise.resolve(null),
    hasRole: (role: string) => {
      void role;
      return Promise.resolve(false);
    },
  },
};

@Module({
  controllers: [StagedServiceController, SyncController, DeprecationController],
  providers: [
    PrismaService,
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    AuditService,
    CurationService,
    DeprecationService,
    SyncService,
    ImportOrchestrator,
    CatalogAuthorizationGuard,
    FailClosedAuthProvider,
    BulkFollowsClient,
    { provide: PROVIDER_CATALOG_CLIENT, useExisting: BulkFollowsClient },
  ],
  exports: [
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    AuditService,
    CurationService,
    DeprecationService,
    SyncService,
    PROVIDER_CATALOG_CLIENT,
  ],
})
export class CatalogModule {}
