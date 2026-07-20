/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument */
import { SyncService } from './sync.service';

describe('SyncService', () => {
  function buildFakePrisma() {
    const updates: any[] = [];
    return {
      updates,
      prisma: {
        syncJob: {
          create: jest.fn().mockResolvedValue({ id: 'job1' }),
          update: jest.fn().mockImplementation((args: any) => {
            updates.push(args);
            return Promise.resolve(true);
          }),
        },
      } as any,
    };
  }

  it('creates a running SyncJob and invokes ImportOrchestrator', async () => {
    const { prisma } = buildFakePrisma();
    const summary = { imported: 1, updated: 0, skipped: 0, errors: 0 };
    const importOrchestrator = {
      run: jest.fn().mockResolvedValue(summary),
    } as any;

    const svc = new SyncService(prisma, importOrchestrator);
    await svc.runSync('on-demand');

    expect(prisma.syncJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'on-demand',
          status: 'running',
        }),
      }),
    );
    expect(importOrchestrator.run).toHaveBeenCalledTimes(1);
  });

  it('finalizes a successful SyncJob with the returned summary and finishedAt', async () => {
    const { prisma, updates } = buildFakePrisma();
    const summary = { imported: 2, updated: 1, skipped: 0, errors: 0 };
    const importOrchestrator = {
      run: jest.fn().mockResolvedValue(summary),
    } as any;

    const svc = new SyncService(prisma, importOrchestrator);
    const result = await svc.runSync('on-demand');

    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('success');
    expect(updates[0].data.summary).toEqual(summary);
    expect(updates[0].data.finishedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('success');
    expect(result.summary).toEqual(summary);
  });

  it('finalizes a failed SyncJob once, with a minimal failure summary, and rethrows the original error', async () => {
    const { prisma, updates } = buildFakePrisma();
    const originalError = new Error('provider unavailable');
    const importOrchestrator = {
      run: jest.fn().mockRejectedValue(originalError),
    } as any;

    const svc = new SyncService(prisma, importOrchestrator);

    await expect(svc.runSync('on-demand')).rejects.toBe(originalError);

    expect(updates).toHaveLength(1);
    expect(updates[0].data.status).toBe('failure');
    expect(updates[0].data.summary).toEqual({
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 1,
    });
    expect(updates[0].data.finishedAt).toBeInstanceOf(Date);
  });
});
