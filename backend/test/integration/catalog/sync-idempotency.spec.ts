import { CurationService } from '../../../src/modules/catalog/application/curation.service';
import { StagedCurationDto } from '../../../src/modules/catalog/application/dto/staged-curation.dto';
import { ImportOrchestrator } from '../../../src/modules/catalog/sync/import-orchestrator';

type ProviderServiceRecord = {
  id: string;
  providerOrigin: string;
  externalId: string;
  rawPayload: unknown;
};

type StagedServiceRecord = {
  id: string;
  providerServiceId: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  proposedTitle: string | null;
  proposedDescription: string | null;
  proposedCategoryId: string | null;
  proposedSocialNetwork: string | null;
};

type MasterServiceRecord = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  socialNetwork: string;
  providerCostAmount: number;
  providerCostCurrency: string;
  defaultSellingPriceAmount: number;
  defaultSellingPriceCurrency: string;
  isVisible: boolean;
  status: 'active';
  provenanceRef: string;
};

function createHarness() {
  let providerSeq = 0;
  let stagedSeq = 0;
  let masterSeq = 0;

  let payloads: Array<{
    externalId: string;
    title: string;
    description: string;
    categoryId: string;
    socialNetwork: string;
    rawPayload: { rate: string };
  }> = [];

  const providerByComposite = new Map<string, ProviderServiceRecord>();
  const providerById = new Map<string, ProviderServiceRecord>();
  const stagedById = new Map<string, StagedServiceRecord>();
  const mastersById = new Map<string, MasterServiceRecord>();
  const masterByProvenance = new Map<string, string>();

  const providerClient = {
    fetchServices: jest.fn(async () => payloads),
  };

  const providerServiceRepository = {
    findById: jest.fn(async (id: string) => providerById.get(id) ?? null),
    findByOriginAndExternalId: jest.fn(
      async (providerOrigin: string, externalId: string) =>
        providerByComposite.get(`${providerOrigin}:${externalId}`) ?? null,
    ),
    upsertByOriginAndExternalId: jest.fn(
      async (data: {
        providerOrigin: string;
        externalId: string;
        rawPayload: unknown;
      }) => {
        const key = `${data.providerOrigin}:${data.externalId}`;
        const existing = providerByComposite.get(key);
        if (existing) {
          const updated = { ...existing, rawPayload: data.rawPayload };
          providerByComposite.set(key, updated);
          providerById.set(existing.id, updated);
          return updated;
        }

        providerSeq += 1;
        const created: ProviderServiceRecord = {
          id: `provider-${providerSeq}`,
          providerOrigin: data.providerOrigin,
          externalId: data.externalId,
          rawPayload: data.rawPayload,
        };
        providerByComposite.set(key, created);
        providerById.set(created.id, created);
        return created;
      },
    ),
  };

  const stagedServiceRepository = {
    findById: jest.fn(async (id: string) => stagedById.get(id) ?? null),
    upsertPendingFromProvider: jest.fn(
      async (
        providerServiceId: string,
        payload: {
          title?: string;
          description?: string;
          categoryId?: string;
          socialNetwork?: string;
        },
      ) => {
        const existing = Array.from(stagedById.values()).find(
          (item) =>
            item.providerServiceId === providerServiceId &&
            item.reviewStatus === 'pending',
        );

        if (existing) {
          const updated: StagedServiceRecord = {
            ...existing,
            proposedTitle: payload.title ?? null,
            proposedDescription: payload.description ?? null,
            proposedCategoryId: payload.categoryId ?? null,
            proposedSocialNetwork: payload.socialNetwork ?? null,
          };
          stagedById.set(existing.id, updated);
          return updated;
        }

        stagedSeq += 1;
        const created: StagedServiceRecord = {
          id: `staged-${stagedSeq}`,
          providerServiceId,
          reviewStatus: 'pending',
          proposedTitle: payload.title ?? null,
          proposedDescription: payload.description ?? null,
          proposedCategoryId: payload.categoryId ?? null,
          proposedSocialNetwork: payload.socialNetwork ?? null,
        };
        stagedById.set(created.id, created);
        return created;
      },
    ),
    updateReviewStatus: jest.fn(
      async (id: string, status: 'approved' | 'rejected') => {
        const existing = stagedById.get(id);
        if (!existing) return null;
        const updated: StagedServiceRecord = { ...existing, reviewStatus: status };
        stagedById.set(id, updated);
        return updated;
      },
    ),
    findPending: jest.fn(async () =>
      Array.from(stagedById.values()).filter(
        (record) => record.reviewStatus === 'pending',
      ),
    ),
  };

  const masterServiceRepository = {
    findByProvenance: jest.fn(async (provenanceRef: string) => {
      const id = masterByProvenance.get(provenanceRef);
      return id ? mastersById.get(id) ?? null : null;
    }),
    createCurated: jest.fn(async (data: Omit<MasterServiceRecord, 'id'>) => {
      masterSeq += 1;
      const created: MasterServiceRecord = { id: `master-${masterSeq}`, ...data };
      mastersById.set(created.id, created);
      masterByProvenance.set(created.provenanceRef, created.id);
      return created;
    }),
    applyApproval: jest.fn(
      async (id: string, data: Omit<MasterServiceRecord, 'id'>) => {
        const updated: MasterServiceRecord = { id, ...data };
        mastersById.set(id, updated);
        masterByProvenance.set(updated.provenanceRef, id);
        return updated;
      },
    ),
  };

  const auditService = {
    recordCuration: jest.fn(async () => true),
  };

  const importOrchestrator = new ImportOrchestrator(
    providerClient,
    providerServiceRepository as any,
    stagedServiceRepository as any,
  );

  const curationService = new CurationService(
    stagedServiceRepository as any,
    providerServiceRepository as any,
    masterServiceRepository as any,
    auditService as any,
  );

  return {
    setPayloads(nextPayloads: typeof payloads) {
      payloads = nextPayloads;
    },
    importOrchestrator,
    curationService,
    providerByComposite,
    stagedById,
    mastersById,
  };
}

describe('Catalog sync integration: idempotency and curated-field protection', () => {
  beforeEach(() => {
    process.env.PLATFORM_BASE_CURRENCY = 'USD';
  });

  it('keeps provider imports idempotent and avoids duplicate staged pending rows', async () => {
    const harness = createHarness();

    harness.setPayloads([
      {
        externalId: 'svc-1',
        title: 'Provider title v1',
        description: 'Provider desc v1',
        categoryId: 'cat-A',
        socialNetwork: 'Instagram',
        rawPayload: { rate: '1.00' },
      },
    ]);

    const first = await harness.importOrchestrator.run();
    expect(first).toEqual({
      total: 1,
      imported: 1,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });

    harness.setPayloads([
      {
        externalId: 'svc-1',
        title: 'Provider title v2',
        description: 'Provider desc v2',
        categoryId: 'cat-B',
        socialNetwork: 'TikTok',
        rawPayload: { rate: '1.10' },
      },
    ]);

    const second = await harness.importOrchestrator.run();
    expect(second).toEqual({
      total: 1,
      imported: 0,
      updated: 1,
      failed: 0,
      skipped: 0,
      errors: 0,
      errorSummary: [],
    });

    expect(harness.providerByComposite.size).toBe(1);
    const pending = Array.from(harness.stagedById.values()).filter(
      (item) => item.reviewStatus === 'pending',
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].proposedTitle).toBe('Provider title v2');
    expect(pending[0].proposedCategoryId).toBe('cat-B');
  });

  it('does not overwrite curated master fields when provider data changes in later syncs', async () => {
    const harness = createHarness();

    harness.setPayloads([
      {
        externalId: 'svc-2',
        title: 'Provider title v1',
        description: 'Provider desc v1',
        categoryId: 'cat-A',
        socialNetwork: 'Instagram',
        rawPayload: { rate: '2.50' },
      },
    ]);

    await harness.importOrchestrator.run();

    const firstPending = Array.from(harness.stagedById.values()).find(
      (item) => item.reviewStatus === 'pending',
    );
    expect(firstPending).toBeDefined();

    const approveDto = StagedCurationDto.validate({
      stagedServiceId: firstPending!.id,
      action: 'approve',
      curatedTitle: 'Curated title',
      curatedDescription: 'Curated description',
      curatedCategoryId: 'curated-cat',
      curatedSocialNetwork: 'Facebook',
      defaultSellingPriceAmount: 999,
      defaultSellingPriceCurrency: 'USD',
      isVisible: true,
    });

    await harness.curationService.curate('admin-1', approveDto);

    const beforeProviderUpdate = Array.from(harness.mastersById.values())[0];
    expect(beforeProviderUpdate.title).toBe('Curated title');
    expect(beforeProviderUpdate.description).toBe('Curated description');
    expect(beforeProviderUpdate.categoryId).toBe('curated-cat');
    expect(beforeProviderUpdate.socialNetwork).toBe('Facebook');
    expect(beforeProviderUpdate.defaultSellingPriceAmount).toBe(999);

    harness.setPayloads([
      {
        externalId: 'svc-2',
        title: 'Provider title v2',
        description: 'Provider desc v2',
        categoryId: 'cat-B',
        socialNetwork: 'TikTok',
        rawPayload: { rate: '7.00' },
      },
    ]);

    await harness.importOrchestrator.run();

    const afterProviderUpdate = Array.from(harness.mastersById.values())[0];
    expect(afterProviderUpdate.id).toBe(beforeProviderUpdate.id);
    expect(afterProviderUpdate.title).toBe('Curated title');
    expect(afterProviderUpdate.description).toBe('Curated description');
    expect(afterProviderUpdate.categoryId).toBe('curated-cat');
    expect(afterProviderUpdate.socialNetwork).toBe('Facebook');
    expect(afterProviderUpdate.defaultSellingPriceAmount).toBe(999);

    const pendingRows = Array.from(harness.stagedById.values()).filter(
      (item) => item.reviewStatus === 'pending',
    );
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0].proposedTitle).toBe('Provider title v2');
    expect(pendingRows[0].proposedSocialNetwork).toBe('TikTok');
  });
});
