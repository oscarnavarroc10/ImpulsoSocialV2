import { SyncService } from '../../../src/modules/catalog/sync/sync.service';

type SyncJobRecord = {
  id: string;
  source: 'scheduled' | 'on-demand';
  status: 'running' | 'success' | 'partial' | 'failure';
  summary: Record<string, unknown>;
  finishedAt: Date | null;
};

function createSyncJobHarness() {
  let seq = 0;
  const jobs = new Map<string, SyncJobRecord>();

  const prisma = {
    syncJob: {
      create: jest.fn(async ({ data }: { data: Partial<SyncJobRecord> }) => {
        seq += 1;
        const id = `job-${seq}`;
        const created: SyncJobRecord = {
          id,
          source: (data.source as 'scheduled' | 'on-demand') ?? 'on-demand',
          status: (data.status as SyncJobRecord['status']) ?? 'running',
          summary: (data.summary as Record<string, unknown>) ?? {},
          finishedAt: null,
        };
        jobs.set(id, created);
        return { id };
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SyncJobRecord>;
        }) => {
          const existing = jobs.get(where.id);
          if (!existing) {
            throw new Error(`SyncJob not found: ${where.id}`);
          }

          const updated: SyncJobRecord = {
            ...existing,
            ...data,
            summary: (data.summary as Record<string, unknown>) ?? existing.summary,
            finishedAt: (data.finishedAt as Date | null) ?? existing.finishedAt,
          };

          jobs.set(where.id, updated);
          return updated;
        },
      ),
    },
  };

  return {
    prisma,
    jobs,
  };
}

describe('SyncService integration: scheduled and on-demand job persistence', () => {
  it('persists a scheduled successful sync job with final summary and finishedAt', async () => {
    const { prisma, jobs } = createSyncJobHarness();
    const importOrchestrator = {
      run: jest.fn(async () => ({
        total: 2,
        imported: 2,
        updated: 0,
        failed: 0,
        skipped: 0,
        errors: 0,
        errorSummary: [],
      })),
    };

    const service = new SyncService(prisma as any, importOrchestrator as any);

    const result = await service.runSync('scheduled');

    expect(result.status).toBe('success');
    const persisted = jobs.get(result.jobId)!;
    expect(persisted.source).toBe('scheduled');
    expect(persisted.status).toBe('success');
    expect(persisted.summary).toEqual({
      total: 2,
      imported: 2,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });
    expect(persisted.finishedAt).toBeInstanceOf(Date);
  });

  it('persists an on-demand partially successful sync job', async () => {
    const { prisma, jobs } = createSyncJobHarness();
    const importOrchestrator = {
      run: jest.fn(async () => ({
        total: 3,
        imported: 1,
        updated: 1,
        failed: 1,
        skipped: 0,
        errors: 1,
        errorSummary: ['svc-2:STAGED_SERVICE_UPSERT_FAILED'],
      })),
    };

    const service = new SyncService(prisma as any, importOrchestrator as any);

    const result = await service.runSync('on-demand');

    expect(result.status).toBe('partial');
    const persisted = jobs.get(result.jobId)!;
    expect(persisted.source).toBe('on-demand');
    expect(persisted.status).toBe('partial');
    expect(persisted.summary).toEqual({
      total: 3,
      imported: 1,
      updated: 1,
      failed: 1,
      skipped: 0,
      errors: 1,
      errorSummary: ['svc-2:STAGED_SERVICE_UPSERT_FAILED'],
    });
    expect(persisted.finishedAt).toBeInstanceOf(Date);
  });

  it('persists a failure SyncJob on provider-request exceptions and rethrows the error', async () => {
    const { prisma, jobs } = createSyncJobHarness();
    const originalError = new Error('provider unavailable');
    const importOrchestrator = {
      run: jest.fn(async () => {
        throw originalError;
      }),
    };

    const service = new SyncService(prisma as any, importOrchestrator as any);

    await expect(service.runSync('scheduled')).rejects.toBe(originalError);

    expect(jobs.size).toBe(1);
    const persisted = Array.from(jobs.values())[0];
    expect(persisted.source).toBe('scheduled');
    expect(persisted.status).toBe('failure');
    expect(persisted.summary).toEqual({
      total: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 1,
      errorSummary: ['PROVIDER_REQUEST_FAILED'],
    });
    expect(persisted.finishedAt).toBeInstanceOf(Date);
  });
});
