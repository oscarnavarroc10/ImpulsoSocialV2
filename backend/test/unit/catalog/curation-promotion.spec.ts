import { CurationService } from '../../../src/modules/catalog/application/curation.service';

describe('CurationService classified promotion', () => {
  type StagedFixture = {
    id: string;
    reviewStatus: string;
    providerService: { id: string; rawPayload: Record<string, unknown> };
  };

  const stagedServiceRepository = {
    findPromotionRecords: jest.fn(),
    findById: jest.fn(),
    updateReviewStatus: jest.fn(),
  };
  const providerServiceRepository = {
    findById: jest.fn(),
  };
  const masterServiceRepository = {
    findByProvenance: jest.fn(),
    createCurated: jest.fn(),
    applyApproval: jest.fn(),
  };
  const auditService = {
    recordCuration: jest.fn(),
  };
  const catalogPricingConfigurationRepository = {
    findSellingPriceMultiplier: jest.fn(),
  };
  const service = new CurationService(
    stagedServiceRepository as any,
    providerServiceRepository as any,
    masterServiceRepository as any,
    auditService as any,
    catalogPricingConfigurationRepository as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PLATFORM_BASE_CURRENCY = 'USD';
    process.env.BULKFOLLOWS_RATE_CURRENCY = 'USD';
    catalogPricingConfigurationRepository.findSellingPriceMultiplier.mockResolvedValue(
      '1.0',
    );
    stagedServiceRepository.updateReviewStatus.mockImplementation(
      (id: string, status: string) => {
        const records =
          (stagedServiceRepository as unknown as { records?: StagedFixture[] })
            .records ?? [];
        const staged = records.find((item) => item.id === id);
        if (staged) staged.reviewStatus = status;
        return Promise.resolve(staged);
      },
    );
  });

  function record(overrides: Record<string, unknown> = {}) {
    return {
      id: 'staged-1',
      providerServiceId: 'provider-1',
      reviewStatus: 'pending',
      proposedTitle: 'Instagram Followers HQ',
      proposedDescription: 'Provider description',
      proposedCategoryId: 'category-followers',
      proposedSocialNetwork: 'Instagram',
      providerService: {
        id: 'provider-1',
        externalId: '15057',
        rawPayload: { rate: '0.30', name: 'Instagram Followers HQ' },
      },
      ...overrides,
    };
  }

  it('promotes eligible records with the persisted x1 pricing multiplier', async () => {
    const staged = record();
    stagedServiceRepository.records = [staged];
    stagedServiceRepository.findPromotionRecords.mockResolvedValue(
      stagedServiceRepository.records,
    );
    stagedServiceRepository.findById.mockResolvedValue(staged);
    providerServiceRepository.findById.mockResolvedValue(
      staged.providerService,
    );
    masterServiceRepository.findByProvenance.mockResolvedValue(null);
    masterServiceRepository.createCurated.mockResolvedValue({ id: 'master-1' });

    const result = await service.promotePending('catalog-promotion-script');

    expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'category-followers',
        socialNetwork: 'Instagram',
        provenanceRef: 'provider-1',
        providerCostAmount: 30,
        defaultSellingPriceAmount: 30,
      }),
    );
    expect(staged.providerService.rawPayload).toEqual({
      rate: '0.30',
      name: 'Instagram Followers HQ',
    });
    expect(result).toMatchObject({
      eligible: 1,
      createdMasterService: 1,
      approvedStagedService: 1,
      byPlatform: { Instagram: 1, TikTok: 0, YouTube: 0, Facebook: 0 },
      failed: 0,
    });
    expect(
      catalogPricingConfigurationRepository.findSellingPriceMultiplier,
    ).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, '0', '-1', 'not-a-decimal'])(
    'fails safely when persisted multiplier is %s',
    async (multiplier) => {
      catalogPricingConfigurationRepository.findSellingPriceMultiplier.mockResolvedValue(
        multiplier,
      );

      await expect(
        service.promotePending('catalog-promotion-script'),
      ).rejects.toThrow();
      expect(stagedServiceRepository.updateReviewStatus).not.toHaveBeenCalled();
      expect(masterServiceRepository.createCurated).not.toHaveBeenCalled();
    },
  );

  it('skips unclassified, unsupported, and already approved records', async () => {
    const records = [
      record({ id: 'unclassified', proposedCategoryId: null }),
      record({ id: 'unsupported', proposedSocialNetwork: 'Website' }),
      record({ id: 'approved', reviewStatus: 'approved' }),
    ];
    stagedServiceRepository.findPromotionRecords.mockResolvedValue(records);

    const preview = await service.previewPromotion();
    const result = await service.promotePending('catalog-promotion-script');

    expect(preview).toMatchObject({
      unclassified: 1,
      unsupported: 1,
      alreadyApproved: 1,
      eligible: 0,
    });
    expect(result.skipped).toBe(3);
    expect(stagedServiceRepository.updateReviewStatus).not.toHaveBeenCalled();
    expect(masterServiceRepository.createCurated).not.toHaveBeenCalled();
  });

  it('updates an existing master by provenance and is idempotent on a second run', async () => {
    const staged = record();
    stagedServiceRepository.records = [staged];
    stagedServiceRepository.findPromotionRecords.mockImplementation(() =>
      Promise.resolve(stagedServiceRepository.records),
    );
    stagedServiceRepository.findById.mockResolvedValue(staged);
    providerServiceRepository.findById.mockResolvedValue(
      staged.providerService,
    );
    masterServiceRepository.findByProvenance.mockResolvedValue({
      id: 'master-1',
    });
    masterServiceRepository.applyApproval.mockResolvedValue({ id: 'master-1' });

    const first = await service.promotePending('catalog-promotion-script');
    const second = await service.promotePending('catalog-promotion-script');

    expect(first.updatedMasterService).toBe(1);
    expect(second).toMatchObject({
      alreadyApproved: 1,
      skipped: 1,
      approvedStagedService: 0,
    });
    expect(masterServiceRepository.applyApproval).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed record pending and continues with unrelated records', async () => {
    const failed = record({
      id: 'failed',
      providerServiceId: 'provider-failed',
    });
    const healthy = record({
      id: 'healthy',
      providerServiceId: 'provider-healthy',
    });
    failed.providerService = {
      ...failed.providerService,
      id: 'provider-failed',
    };
    healthy.providerService = {
      ...healthy.providerService,
      id: 'provider-healthy',
    };
    stagedServiceRepository.records = [failed, healthy];
    stagedServiceRepository.findPromotionRecords.mockResolvedValue(
      stagedServiceRepository.records,
    );
    stagedServiceRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(
        (stagedServiceRepository.records as StagedFixture[]).find(
          (item) => item.id === id,
        ),
      ),
    );
    providerServiceRepository.findById.mockImplementation((id: string) => {
      if (id === 'provider-failed') {
        return Promise.reject(new Error('missing rate'));
      }
      return Promise.resolve(healthy.providerService);
    });
    masterServiceRepository.findByProvenance.mockResolvedValue(null);
    masterServiceRepository.createCurated.mockResolvedValue({
      id: 'master-healthy',
    });

    const result = await service.promotePending('catalog-promotion-script');

    expect(result).toMatchObject({
      failed: 1,
      createdMasterService: 1,
      approvedStagedService: 1,
    });
    expect(failed.reviewStatus).toBe('pending');
    expect(healthy.reviewStatus).toBe('approved');
  });
});
