import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportOrchestrator } from './import-orchestrator';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importOrchestrator: ImportOrchestrator,
  ) {}

  // Scheduling is intentionally not configured here — the project may add
  // ScheduleModule integration later. `runSync` is the on-demand entry point;
  // it owns the full SyncJob lifecycle (create -> running, then a single
  // finalizing update to either success or failure). Import orchestration is
  // delegated to ImportOrchestrator (T020). Partial-failure aggregation
  // within a single run belongs to T021 and is not handled here.

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
          summary: { imported: 0, updated: 0, skipped: 0, errors: 1 },
          finishedAt: new Date(),
        },
      });
      throw err;
    }

    await this.prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: 'success',
        summary,
        finishedAt: new Date(),
      },
    });

    return { jobId: job.id, status: 'success' as const, summary };
  }
}
