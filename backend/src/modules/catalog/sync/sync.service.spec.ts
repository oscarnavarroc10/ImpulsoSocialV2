/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument */
import { SyncService } from './sync.service';

describe('SyncService', () => {
  it('persists a failure when orchestration is not implemented', async () => {
    const updates: any[] = [];
    const fakePrisma = {
      syncJob: {
        create: jest.fn().mockResolvedValue({ id: 'job1' }),
        update: jest.fn().mockImplementation((args: any) => {
          updates.push(args);
          return Promise.resolve(true);
        }),
      },
    } as any;

    const svc = new SyncService(fakePrisma, undefined);
    await expect(svc.runSync('on-demand')).rejects.toThrow(/not implemented/);

    // Verify we created a job and then updated it to failure
    expect(fakePrisma.syncJob.create).toHaveBeenCalled();
    expect(updates.length).toBeGreaterThan(0);
    const failedUpdate = updates.find(
      (u) => u.data && u.data.status === 'failure',
    );
    expect(failedUpdate).toBeTruthy();
  });
});
