import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProviderCatalogClient } from '../infrastructure/provider-catalog-client';
import { PROVIDER_CATALOG_CLIENT } from '../infrastructure/provider-catalog-client';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(PROVIDER_CATALOG_CLIENT)
    private readonly providerClient?: ProviderCatalogClient,
  ) {}

  // Scheduling is intentionally not configured here — the project may add
  // ScheduleModule integration later. The SyncService exposes an on-demand
  // `runSync` entry point that persists SyncJob lifecycle. Since import
  // orchestration (T020) is not implemented, `runSync` records a failed job
  // and throws an explicit error to avoid reporting false success.

  async runSync(source: 'scheduled' | 'on-demand' = 'on-demand') {
    const job = await this.prisma.syncJob.create({
      data: { source, status: 'running', summary: {} },
    });
    try {
      // Import orchestration not implemented yet (T020). Persist explicit failure.
      const summary = {
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: 1,
        message: 'import orchestration not implemented',
      };
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: { status: 'failure', summary, finishedAt: new Date() },
      });
      throw new Error('Import orchestration not implemented');
    } catch (err) {
      this.logger.error('Sync failed', err);
      // Ensure failure persisted (if not already)
      try {
        await this.prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'failure',
            summary: { errors: 1 },
            finishedAt: new Date(),
          },
        });
      } catch (uErr) {
        this.logger.error('Failed to persist sync job failure', uErr);
      }
      throw err;
    }
  }
}
