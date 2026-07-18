import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderServiceRepository } from './infrastructure/provider-service.repository';
import { StagedServiceRepository } from './infrastructure/staged-service.repository';
import { MasterServiceRepository } from './infrastructure/master-service.repository';
import { AuditService } from './infrastructure/audit.service';
import { SyncService } from './sync/sync.service';
import { CatalogAuthorizationGuard } from './security/catalog-authorization.guard';
import { CATALOG_AUTHORIZATION } from './security/catalog-authorization.interface';

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
  providers: [
    PrismaService,
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    AuditService,
    SyncService,
    CatalogAuthorizationGuard,
    FailClosedAuthProvider,
  ],
  exports: [
    ProviderServiceRepository,
    StagedServiceRepository,
    MasterServiceRepository,
    AuditService,
    SyncService,
  ],
})
export class CatalogModule {}
