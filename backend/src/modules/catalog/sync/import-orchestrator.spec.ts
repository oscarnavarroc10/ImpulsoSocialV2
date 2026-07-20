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
      findByOriginAndExternalId: jest.fn().mockResolvedValue(null),
      upsertByOriginAndExternalId: jest
        .fn()
        .mockImplementation((data: { externalId: string }) =>
          Promise.resolve({ id: `provider-service-${data.externalId}` }),
        ),
    };
    const stagedServiceRepository = {
      upsertPendingFromProvider: jest
        .fn()
        .mockResolvedValue({ id: 'staged-1', reviewStatus: 'pending' }),
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

  it('creates a new ProviderService and counts it as imported when it does not already exist', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();
    providerClient.fetchServices.mockResolvedValue([buildPayload()]);
    providerServiceRepository.findByOriginAndExternalId.mockResolvedValue(null);

    const summary = await orchestrator.run();

    expect(summary).toEqual({ imported: 1, updated: 0, skipped: 0, errors: 0 });
  });

  it('updates an existing ProviderService and counts it as updated', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();
    providerClient.fetchServices.mockResolvedValue([buildPayload()]);
    providerServiceRepository.findByOriginAndExternalId.mockResolvedValue({
      id: 'provider-service-1',
    });

    const summary = await orchestrator.run();

    expect(summary).toEqual({ imported: 0, updated: 1, skipped: 0, errors: 0 });
  });

  it('calls upsertByOriginAndExternalId with the correct providerOrigin, externalId, and rawPayload', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();
    const payload = buildPayload({
      externalId: '42',
      rawPayload: { service: 42, name: 'Likes' },
    });
    providerClient.fetchServices.mockResolvedValue([payload]);

    await orchestrator.run();

    expect(
      providerServiceRepository.upsertByOriginAndExternalId,
    ).toHaveBeenCalledWith({
      providerOrigin: BULKFOLLOWS_PROVIDER_ORIGIN,
      externalId: '42',
      rawPayload: { service: 42, name: 'Likes' },
    });
  });

  it('creates a staging record using the persisted ProviderService id', async () => {
    const { orchestrator, providerClient, stagedServiceRepository } =
      buildDeps();
    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '7' }),
    ]);

    await orchestrator.run();

    expect(
      stagedServiceRepository.upsertPendingFromProvider,
    ).toHaveBeenCalledWith(
      'provider-service-7',
      expect.objectContaining({ title: 'Followers' }),
    );
  });

  it('returns a successful zero-count summary for an empty provider response', async () => {
    const { orchestrator, providerClient } = buildDeps();
    providerClient.fetchServices.mockResolvedValue([]);

    const summary = await orchestrator.run();

    expect(summary).toEqual({ imported: 0, updated: 0, skipped: 0, errors: 0 });
  });

  it('propagates provider-client failures without reporting success', async () => {
    const { orchestrator, providerClient } = buildDeps();
    const error = new Error('provider request failed');
    providerClient.fetchServices.mockRejectedValue(error);

    await expect(orchestrator.run()).rejects.toBe(error);
  });

  it('propagates repository failures without continuing to later items', async () => {
    const { orchestrator, providerClient, providerServiceRepository } =
      buildDeps();
    const error = new Error('upsert failed');
    providerClient.fetchServices.mockResolvedValue([
      buildPayload({ externalId: '1' }),
      buildPayload({ externalId: '2' }),
    ]);
    providerServiceRepository.upsertByOriginAndExternalId
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ id: 'provider-service-2' });

    await expect(orchestrator.run()).rejects.toBe(error);
    expect(
      providerServiceRepository.upsertByOriginAndExternalId,
    ).toHaveBeenCalledTimes(1);
  });
});
