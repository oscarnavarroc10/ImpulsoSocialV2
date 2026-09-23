import { ImportOrchestrator } from '../../../src/modules/catalog/sync/import-orchestrator';

describe('ImportOrchestrator provider origin and snapshot gate', () => {
  function createHarness(complete: boolean) {
    const providerService = { id: 'provider-record-1', externalId: 'smm-1' };
    const providerClient = {
      resolve: jest.fn().mockReturnValue({
        providerOrigin: 'smmgen',
        fetchServices: jest.fn(),
        fetchServicesSnapshot: jest.fn().mockResolvedValue({
          complete,
          services: [
            {
              providerOrigin: 'smmgen',
              externalId: 'smm-1',
              rawPayload: { type: 'Default', min: 1, max: 10 },
            },
          ],
        }),
      }),
    };
    const providerServiceRepository = {
      findManyByOriginAndExternalIds: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([providerService]),
      createMany: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue(undefined),
    };
    const stagedServiceRepository = {
      findPendingByProviderServiceIds: jest.fn().mockResolvedValue([]),
      createManyPending: jest.fn().mockResolvedValue(undefined),
      updateManyPending: jest.fn(),
    };
    const categoryRepository = {
      findOrCreateByName: jest.fn().mockResolvedValue(null),
    };
    const offeringRepository = {
      disableUnavailableProviderServices: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    return {
      service: new ImportOrchestrator(
        providerClient as never,
        providerServiceRepository as never,
        stagedServiceRepository as never,
        categoryRepository as never,
        offeringRepository as never,
      ),
      providerClient,
      providerServiceRepository,
      stagedServiceRepository,
      offeringRepository,
    };
  }

  it('uses the requested origin and does not reconcile an incomplete snapshot', async () => {
    const harness = createHarness(false);
    await harness.service.run('smmgen');
    expect(harness.providerClient.resolve).toHaveBeenCalledWith('smmgen');
    expect(
      harness.providerServiceRepository.findManyByOriginAndExternalIds,
    ).toHaveBeenCalledWith('smmgen', ['smm-1']);
    expect(
      harness.offeringRepository.disableUnavailableProviderServices,
    ).not.toHaveBeenCalled();
  });

  it('reconciles disappearance only after complete successful persistence', async () => {
    const harness = createHarness(true);
    await harness.service.run('smmgen');
    expect(
      harness.offeringRepository.disableUnavailableProviderServices,
    ).toHaveBeenCalledWith(['provider-record-1'], 'smmgen');
  });
});
