import { ProviderOfferingBackfillService } from '../../../src/modules/catalog/application/provider-offering-backfill.service';

describe('ProviderOfferingBackfillService', () => {
  it('classifies only independently verified BulkFollows Standard mappings', async () => {
    const prisma = {
      masterService: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'master-valid', provenanceRef: 'provider-valid' },
          { id: 'master-missing', provenanceRef: 'provider-missing' },
          { id: 'master-unsupported', provenanceRef: 'provider-smmgen' },
          { id: 'master-malformed', provenanceRef: 'provider-malformed' },
        ]),
      },
      providerService: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'provider-valid', providerOrigin: 'bulkfollows', externalId: '123', rawPayload: { type: 'Default', min: 10, max: 100 } })
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'provider-smmgen', providerOrigin: 'smmgen', externalId: '123', rawPayload: {} })
          .mockResolvedValueOnce({ id: 'provider-malformed', providerOrigin: 'bulkfollows', externalId: 'not-an-id', rawPayload: { type: 'Default', min: 10, max: 100 } }),
      },
      masterServiceProviderOffering: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const offerings = { createNormalized: jest.fn() };
    const service = new ProviderOfferingBackfillService(prisma as never, offerings as never);

    await expect(service.report()).resolves.toEqual([
      { masterServiceId: 'master-valid', providerServiceId: 'provider-valid', classification: 'created' },
      { masterServiceId: 'master-missing', providerServiceId: 'provider-missing', classification: 'missing_provider' },
      { masterServiceId: 'master-unsupported', providerServiceId: 'provider-smmgen', classification: 'unsupported_provider' },
      { masterServiceId: 'master-malformed', providerServiceId: 'provider-malformed', classification: 'malformed_capability' },
    ]);
    expect(offerings.createNormalized).not.toHaveBeenCalled();
  });

  it('never uses external provider order IDs to infer historical linkage', async () => {
    const prisma = {
      masterService: { findMany: jest.fn().mockResolvedValue([]) },
      providerService: { findUnique: jest.fn() },
      masterServiceProviderOffering: { findMany: jest.fn() },
    };
    const service = new ProviderOfferingBackfillService(prisma as never, { createNormalized: jest.fn() } as never);
    await expect(service.report()).resolves.toEqual([]);
    expect(prisma.providerService.findUnique).not.toHaveBeenCalled();
  });
});
