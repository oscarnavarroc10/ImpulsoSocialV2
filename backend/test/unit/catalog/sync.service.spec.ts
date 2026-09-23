import { SyncService } from '../../../src/modules/catalog/sync/sync.service';

describe('SyncService provider forwarding', () => {
  it('forwards the requested provider origin and persists a sanitized success summary', async () => {
    const prisma = {
      syncJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const importOrchestrator = {
      run: jest
        .fn()
        .mockResolvedValue({
          total: 1,
          imported: 1,
          updated: 0,
          failed: 0,
          skipped: 0,
          errors: 0,
          errorSummary: [],
        }),
    };
    const service = new SyncService(
      prisma as never,
      importOrchestrator as never,
    );

    await expect(service.runSync('on-demand', 'smmgen')).resolves.toMatchObject(
      { status: 'success' },
    );
    expect(importOrchestrator.run).toHaveBeenCalledWith('smmgen');
    expect(prisma.syncJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'success',
          summary: expect.objectContaining({ total: 1 }),
        }),
      }),
    );
  });
});
