import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportOrchestrator } from './import-orchestrator';

function resolveFinalStatus(summary: {
  imported: number;
  updated: number;
  failed: number;
  total: number;
}): 'success' | 'partial' | 'failure' {
  if (summary.failed === 0) {
    return 'success';
  }

  const successfulItems = summary.imported + summary.updated;
  if (successfulItems === 0 && summary.total > 0) {
    return 'failure';
  }

  return 'partial';
}

function toSyncJobSummaryJson(summary: {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: number;
  errorSummary: string[];
}): Prisma.InputJsonObject {
  return {
    total: summary.total,
    imported: summary.imported,
    updated: summary.updated,
    failed: summary.failed,
    skipped: summary.skipped,
    errors: summary.errors,
    errorSummary: summary.errorSummary,
  };
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importOrchestrator: ImportOrchestrator,
  ) {}

  // Scheduling is intentionally not configured here - the project may add
  // ScheduleModule integration later. `runSync` is the on-demand entry point;
  // it owns the full SyncJob lifecycle (create -> running, then a single
  // finalizing update to success, partial, or failure). Import orchestration
  // is delegated to ImportOrchestrator.

  async runSync(source: 'scheduled' | 'on-demand' = 'on-demand') {
    const job = await this.prisma.syncJob.create({
      data: { source, status: 'running', summary: {} },
    });

    let summary;
    try {
      summary = await this.importOrchestrator.run();
    } catch (err) {
      this.logger.error('Sync failed', err);
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'failure',
          summary: {
            total: 0,
            imported: 0,
            updated: 0,
            failed: 0,
            skipped: 0,
            errors: 1,
            errorSummary: ['PROVIDER_REQUEST_FAILED'],
          },
          finishedAt: new Date(),
        },
      });
      throw err;
    }

    const finalStatus = resolveFinalStatus(summary);
    const persistedSummary = toSyncJobSummaryJson(summary);

    await this.prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        summary: persistedSummary,
        finishedAt: new Date(),
      },
    });

    return { jobId: job.id, status: finalStatus, summary };
  }
}
