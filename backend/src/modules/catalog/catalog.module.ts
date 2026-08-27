import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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
import { CategoryRepository } from './infrastructure/category.repository';
import { CategoryService } from './application/category.service';
import { CategoryController } from './presentation/category.controller';
import { MasterServiceVisibilityService } from './application/master-service-visibility.service';
import { VisibilityResolutionService } from './application/visibility-resolution.service';
import { MasterServiceVisibilityController } from './presentation/master-service-visibility.controller';
import { TenantServiceOverrideRepository } from './infrastructure/tenant-service-override.repository';
import { TenantServiceOverrideService } from './application/tenant-service-override.service';
import { TenantServiceOverrideController } from './presentation/tenant-service-override.controller';
import { SnapshotService } from './snapshot/snapshot.service';
import { SnapshotController } from './presentation/snapshot.controller';
import { ExportService } from './snapshot/export.service';
import { SnapshotExportController } from './presentation/snapshot-export.controller';
import { CatalogAuthorizationService } from './security/catalog-authorization.service';
import { PublicCatalogRepository } from './infrastructure/public-catalog.repository';
import { PublicCatalogService } from './application/public-catalog.service';
import { PublicCatalogController } from './presentation/public-catalog.controller';

// Minimal fail-closed adapter for missing external authorization integration.
/*const FailClosedAuthProvider = {
  provide: CATALOG_AUTHORIZATION,
  useValue: {
    getPrincipal: () => Promise.resolve(null),
    hasRole: (role: string) => {
      void role;
      return Promise.resolve(false);
    },
  },
};
*/
@Module({
  imports: [AuthModule],
  controllers: [
    StagedServiceController,
    SyncController,
    DeprecationController,
    CategoryController,
    MasterServiceVisibilityController,
    TenantServiceOverrideController,
    SnapshotController,
    SnapshotExportController,
    PublicCatalogController,
  ],
  providers: [
    PrismaService,
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    CategoryRepository,
    TenantServiceOverrideRepository,
    AuditService,
    CurationService,
    DeprecationService,
    CategoryService,
    MasterServiceVisibilityService,
    VisibilityResolutionService,
    TenantServiceOverrideService,
    SnapshotService,
    ExportService,
    SyncService,
    ImportOrchestrator,
    CatalogAuthorizationGuard,
    {
      provide: CATALOG_AUTHORIZATION,
      useClass: CatalogAuthorizationService,
    },
    BulkFollowsClient,
    { provide: PROVIDER_CATALOG_CLIENT, useExisting: BulkFollowsClient },
    PublicCatalogRepository,
    PublicCatalogService,
  ],
  exports: [
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    AuditService,
    CurationService,
    DeprecationService,
    CategoryRepository,
    CategoryService,
    MasterServiceVisibilityService,
    VisibilityResolutionService,
    TenantServiceOverrideRepository,
    TenantServiceOverrideService,
    SnapshotService,
    ExportService,
    SyncService,
    PROVIDER_CATALOG_CLIENT,
  ],
})
export class CatalogModule {}
