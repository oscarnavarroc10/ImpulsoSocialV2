import { CurationService } from '../../../src/modules/catalog/application/curation.service';
import { StagedCurationDto } from '../../../src/modules/catalog/application/dto/staged-curation.dto';

describe('SMMGEN explicit curation integration', () => {
  it('keeps local identity and price while upserting multiple normalized offerings', async () => {
    const stagedServiceRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'staged-a',
          providerServiceId: 'provider-a',
          reviewStatus: 'pending',
        })
        .mockResolvedValueOnce({
          id: 'staged-b',
          providerServiceId: 'provider-b',
          reviewStatus: 'pending',
        }),
      updateReviewStatus: jest.fn(),
    };
    const providerServiceRepository = {
      findById: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'provider-a',
          providerOrigin: 'smmgen',
          externalId: 'smm-a',
          rawPayload: { type: 'Default', min: 10, max: 1000 },
        })
        .mockResolvedValueOnce({
          id: 'provider-b',
          providerOrigin: 'smmgen',
          externalId: 'smm-b',
          rawPayload: { type: 'Default', min: 20, max: 2000 },
        }),
    };
    const masterServiceRepository = {
      findByProvenance: jest.fn().mockResolvedValue({ id: 'master-1' }),
      applyApproval: jest.fn().mockResolvedValue({ id: 'master-1' }),
    };
    const offeringRepository = { createNormalized: jest.fn() };
    const service = new CurationService(
      stagedServiceRepository as never,
      providerServiceRepository as never,
      masterServiceRepository as never,
      { recordCuration: jest.fn() } as never,
      { findSellingPriceMultiplier: jest.fn() } as never,
      offeringRepository as never,
    );
    const dto = (stagedServiceId: string) =>
      StagedCurationDto.validate({
        stagedServiceId,
        action: 'approve',
        curatedTitle: 'Local title',
        curatedDescription: 'Local description',
        curatedCategoryId: 'category-1',
        curatedSocialNetwork: 'Instagram',
        defaultSellingPriceAmount: 500,
        defaultSellingPriceCurrency: 'USD',
        isVisible: true,
      });

    process.env.PLATFORM_BASE_CURRENCY = 'USD';
    process.env.BULKFOLLOWS_RATE_CURRENCY = 'USD';

    await service.curate('admin-1', dto('staged-a'));
    await service.curate('admin-1', dto('staged-b'));

    expect(masterServiceRepository.applyApproval).toHaveBeenCalledTimes(2);
    expect(masterServiceRepository.applyApproval).toHaveBeenCalledWith(
      'master-1',
      expect.objectContaining({
        title: 'Local title',
        defaultSellingPriceAmount: 500,
        providerCostAmount: 0,
      }),
    );
    expect(offeringRepository.createNormalized).toHaveBeenCalledTimes(2);
    expect(offeringRepository.createNormalized).toHaveBeenNthCalledWith(
      1,
      'master-1',
      'provider-a',
      expect.objectContaining({
        capabilityKey: 'STANDARD',
        contractVersion: 'smmgen-default-v1',
      }),
    );
    expect(offeringRepository.createNormalized).toHaveBeenNthCalledWith(
      2,
      'master-1',
      'provider-b',
      expect.objectContaining({
        capabilityKey: 'STANDARD',
        contractVersion: 'smmgen-default-v1',
      }),
    );
  });
});
