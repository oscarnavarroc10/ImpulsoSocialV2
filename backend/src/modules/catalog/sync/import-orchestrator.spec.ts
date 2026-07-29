import { ImportOrchestrator } from './import-orchestrator';
import type { ProviderServiceRepository } from '../infrastructure/provider-service.repository';
import type { StagedServiceRepository } from '../infrastructure/staged-service.repository';
import { BULKFOLLOWS_PROVIDER_ORIGIN } from '../infrastructure/bulkfollows.client';

function buildPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    externalId: '1',
    title: 'Followers',
    rawPayload: { service: 1, name: 'Followers' },
    ...overrides,
  };
}

describe('ImportOrchestrator', () => {
  function buildDeps() {
    const providerClient: { fetchServices: jest.Mock } = {
      fetchServices: jest.fn().mockResolvedValue([]),
    };

    const providerServiceRepository = {
      findManyByOriginAndExternalIds: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockImplementation(
          (
            providerOrigin: string,
            externalIds: string[],
          ): Promise<
            Array<{
              id: string;
              externalId: string;
              importTimestamp: Date;
            }>
          > =>
            Promise.resolve(
              externalIds.map((externalId) => ({
                id: `provider-service-${externalId}`,
                externalId,
                importTimestamp: new Date(),
              })),
            ),
        ),

      createMany: jest
        .fn()
        .mockImplementation((items: unknown[]) =>
          Promise.resolve(items.length),
        ),

      updateMany: jest
        .fn()
        .mockImplementation((items: unknown[]) =>
          Promise.resolve(items.length),
        ),
    };

    const stagedServiceRepository = {
      findPendingByProviderServiceIds: jest.fn().mockResolvedValue([]),

      createManyPending: jest
        .fn()
        .mockImplementation((items: unknown[]) =>
          Promise.resolve(items.length),
        ),

      updateManyPending: jest
        .fn()
        .mockImplementation((items: unknown[]) =>
          Promise.resolve(items.length),
        ),
    };

    const orchestrator = new ImportOrchestrator(
      providerClient,
      providerServiceRepository as unknown as ProviderServiceRepository,
      stagedServiceRepository as unknown as StagedServiceRepository,
    );

    return {
      orchestrator,
      providerClient,
      providerServiceRepository,
      stagedServiceRepository,
    };
  }

  it('fetches services through ProviderCatalogClient', async () => {
    const { orchestrator, providerClient } = buildDeps();

    await orchestrator.run();

    expect(providerClient.fetchServices).toHaveBeenCalledTimes(1);
  });

  it('creates new ProviderService records and counts them as imported', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();

    providerClient.fetchServices.mockResolvedValue([buildPayload()]);

    const summary = await orchestrator.run();

    expect(providerServiceRepository.createMany).toHaveBeenCalledWith([
      {
        providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId: '1',
        rawPayload: { service: 1, name: 'Followers' },
      },
    ]);

    expect(providerServiceRepository.updateMany).not.toHaveBeenCalled();

    expect(summary).toEqual({
      total: 1,
      imported: 1,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });
  });

  it('updates existing ProviderService records and counts them as updated', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();

    providerClient.fetchServices.mockResolvedValue([buildPayload()]);

    providerServiceRepository.findManyByOriginAndExternalIds
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: 'provider-service-1',
          externalId: '1',
          importTimestamp: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'provider-service-1',
          externalId: '1',
          importTimestamp: new Date(),
        },
      ]);

    const summary = await orchestrator.run();

    expect(providerServiceRepository.createMany).not.toHaveBeenCalled();

    expect(providerServiceRepository.updateMany).toHaveBeenCalledWith([
      {
        providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId: '1',
        rawPayload: { service: 1, name: 'Followers' },
      },
    ]);

    expect(summary).toEqual({
      total: 1,
      imported: 0,
      updated: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });
  });

  it('calls createMany with the correct provider origin, external id and raw payload', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();

    const payload = buildPayload({
      externalId: '42',
      rawPayload: { service: 42, name: 'Likes' },
    });

    providerClient.fetchServices.mockResolvedValue([payload]);

    await orchestrator.run();

    expect(providerServiceRepository.createMany).toHaveBeenCalledWith([
      {
        providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
        externalId: '42',
        rawPayload: { service: 42, name: 'Likes' },
      },
    ]);
  });

  it('creates staging records using persisted ProviderService ids', async () => {
    const { orchestrator, providerClient, stagedServiceRepository } =
      buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '7' }),
    ]);

    await orchestrator.run();

    expect(stagedServiceRepository.createManyPending).toHaveBeenCalledWith([
      expect.objectContaining({
        providerServiceId: 'provider-service-7',
        title: 'Followers',
      }),
    ]);
  });

  it('updates an existing pending staging record instead of creating another one', async () => {
    const { orchestrator, providerClient, stagedServiceRepository } =
      buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '7' }),
    ]);

    stagedServiceRepository.findPendingByProviderServiceIds.mockResolvedValue([
      {
        id: 'staged-7',
        providerServiceId: 'provider-service-7',
      },
    ]);

    const summary = await orchestrator.run();

    expect(stagedServiceRepository.createManyPending).not.toHaveBeenCalled();

    expect(stagedServiceRepository.updateManyPending).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'staged-7',
        providerServiceId: 'provider-service-7',
        title: 'Followers',
      }),
    ]);

    expect(summary).toEqual({
      total: 1,
      imported: 1,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });
  });

  it('returns a successful zero-count summary for an empty provider response', async () => {
    const { orchestrator, providerClient } = buildDeps();

    providerClient.fetchServices.mockResolvedValue([]);

    const summary = await orchestrator.run();

    expect(summary).toEqual({
      total: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });
  });

  it('propagates provider-client failures without reporting success', async () => {
    const { orchestrator, providerClient } = buildDeps();

    const error = new Error('provider request failed');

    providerClient.fetchServices.mockRejectedValue(error);

    await expect(orchestrator.run()).rejects.toBe(error);
  });

  it('records deterministic failures when the ProviderService batch creation fails', async () => {
    const {
      orchestrator,
      providerClient,
      providerServiceRepository,
      stagedServiceRepository,
    } = buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '1' }),
      buildPayload({ externalId: '2' }),
    ]);

    providerServiceRepository.createMany.mockRejectedValue(
      new Error('batch write failed'),
    );

    const summary = await orchestrator.run();

    expect(summary).toEqual({
      total: 2,
      imported: 0,
      updated: 0,
      failed: 2,
      skipped: 0,
      errors: 2,
      errorSummary: [
        '1:PROVIDER_SERVICE_CREATE_FAILED',
        '2:PROVIDER_SERVICE_CREATE_FAILED',
      ],
    });

    expect(stagedServiceRepository.createManyPending).not.toHaveBeenCalled();
  });

  it('does not count imported records when staging batch creation fails', async () => {
    const { orchestrator, providerClient, stagedServiceRepository } =
      buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '10' }),
      buildPayload({ externalId: '11' }),
    ]);

    stagedServiceRepository.createManyPending.mockRejectedValue(
      new Error('staging batch failed'),
    );

    const summary = await orchestrator.run();

    expect(summary).toEqual({
      total: 2,
      imported: 0,
      updated: 0,
      failed: 2,
      skipped: 0,
      errors: 2,
      errorSummary: [
        '10:STAGED_SERVICE_CREATE_FAILED',
        '11:STAGED_SERVICE_CREATE_FAILED',
      ],
    });
  });

  it('records deterministic invalid-payload errors without leaking runtime error text', async () => {
    const { orchestrator, providerClient } = buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({
        externalId: '99',
        rawPayload: undefined,
      }),
    ]);

    const summary = await orchestrator.run();

    expect(summary).toEqual({
      total: 1,
      imported: 0,
      updated: 0,
      failed: 1,
      skipped: 0,
      errors: 1,
      errorSummary: ['99:INVALID_RAW_PAYLOAD'],
    });
  });

  it('skips duplicate external ids received in the same provider response', async () => {
    const { orchestrator, providerClient } = buildDeps();

    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '1' }),
      buildPayload({ externalId: '1' }),
    ]);

    const summary = await orchestrator.run();

    expect(summary).toEqual({
      total: 2,
      imported: 1,
      updated: 0,
      failed: 0,
      skipped: 1,
      errors: 0,
      errorSummary: [],
    });
  });
});
