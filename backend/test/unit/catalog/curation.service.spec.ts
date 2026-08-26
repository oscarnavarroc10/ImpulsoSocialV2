import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CurationService } from '../../../src/modules/catalog/application/curation.service';
import { StagedCurationDto } from '../../../src/modules/catalog/application/dto/staged-curation.dto';

describe('CurationService', () => {
  const stagedServiceRepository = {
    findPending: jest.fn(),
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

  const service = new CurationService(
    stagedServiceRepository as any,
    providerServiceRepository as any,
    masterServiceRepository as any,
    auditService as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PLATFORM_BASE_CURRENCY = 'USD';
  });

  it('approves a staged service by creating a new master service when no linked record exists', async () => {
    stagedServiceRepository.findById.mockResolvedValue({
      id: 'staged-1',
      providerServiceId: 'provider-1',
      reviewStatus: 'pending',
    });
    providerServiceRepository.findById.mockResolvedValue({
      id: 'provider-1',
      rawPayload: { rate: '1.25' },
    });
    masterServiceRepository.findByProvenance.mockResolvedValue(null);
    masterServiceRepository.createCurated.mockResolvedValue({ id: 'master-1' });

    const dto = StagedCurationDto.validate({
      stagedServiceId: 'staged-1',
      action: 'approve',
      curatedTitle: 'Curated title',
      curatedDescription: 'Curated description',
      curatedCategoryId: 'cat-1',
      curatedSocialNetwork: 'Instagram',
      defaultSellingPriceAmount: 300,
      defaultSellingPriceCurrency: 'USD',
      isVisible: true,
    });

    const result = await service.curate('admin-1', dto);

    expect(masterServiceRepository.createCurated).toHaveBeenCalledWith({
      title: 'Curated title',
      description: 'Curated description',
      categoryId: 'cat-1',
      socialNetwork: 'Instagram',
      providerCostAmount: 125,
      providerCostCurrency: 'USD',
      defaultSellingPriceAmount: 300,
      defaultSellingPriceCurrency: 'USD',
      isVisible: true,
      status: 'active',
      provenanceRef: 'provider-1',
    });
    expect(stagedServiceRepository.updateReviewStatus).toHaveBeenCalledWith(
      'staged-1',
      'approved',
    );
    expect(auditService.recordCuration).toHaveBeenCalled();
    expect(result).toEqual({
      stagedServiceId: 'staged-1',
      action: 'approve',
      masterService: { id: 'master-1' },
    });
  });

  it('approves by updating the existing linked master service when provenance already exists', async () => {
    stagedServiceRepository.findById.mockResolvedValue({
      id: 'staged-2',
      providerServiceId: 'provider-2',
      reviewStatus: 'pending',
    });
    providerServiceRepository.findById.mockResolvedValue({
      id: 'provider-2',
      rawPayload: { rate: '2.00' },
    });
    masterServiceRepository.findByProvenance.mockResolvedValue({
      id: 'master-2',
    });
    masterServiceRepository.applyApproval.mockResolvedValue({ id: 'master-2' });

    const dto = StagedCurationDto.validate({
      stagedServiceId: 'staged-2',
      action: 'approve',
      curatedTitle: 'Updated title',
      curatedDescription: 'Updated description',
      curatedCategoryId: 'cat-2',
      curatedSocialNetwork: 'TikTok',
      defaultSellingPriceAmount: 450,
      defaultSellingPriceCurrency: 'USD',
      isVisible: false,
    });

    await service.curate('admin-2', dto);

    expect(masterServiceRepository.applyApproval).toHaveBeenCalledWith(
      'master-2',
      expect.objectContaining({
        providerCostAmount: 200,
        provenanceRef: 'provider-2',
        status: 'active',
      }),
    );
  });

  it('rejects a pending staged service and records an audit entry', async () => {
    stagedServiceRepository.findById.mockResolvedValue({
      id: 'staged-3',
      providerServiceId: 'provider-3',
      reviewStatus: 'pending',
    });

    const dto = StagedCurationDto.validate({
      stagedServiceId: 'staged-3',
      action: 'reject',
    });

    const result = await service.curate('admin-3', dto);

    expect(stagedServiceRepository.updateReviewStatus).toHaveBeenCalledWith(
      'staged-3',
      'rejected',
    );
    expect(auditService.recordCuration).toHaveBeenCalledWith('admin-3', {
      action: 'reject',
      stagedServiceId: 'staged-3',
    });
    expect(result).toEqual({ stagedServiceId: 'staged-3', action: 'reject' });
  });

  describe('provider rate normalization (deterministic, no floating point)', () => {
    function stageWithRate(rate: unknown) {
      stagedServiceRepository.findById.mockResolvedValue({
        id: 'staged-rate',
        providerServiceId: 'provider-rate',
        reviewStatus: 'pending',
      });
      providerServiceRepository.findById.mockResolvedValue({
        id: 'provider-rate',
        rawPayload: { rate },
      });
      masterServiceRepository.findByProvenance.mockResolvedValue(null);
      masterServiceRepository.createCurated.mockResolvedValue({
        id: 'master-rate',
      });
    }

    function approveDto() {
      return StagedCurationDto.validate({
        stagedServiceId: 'staged-rate',
        action: 'approve',
        curatedTitle: 'Curated title',
        curatedDescription: 'Curated description',
        curatedCategoryId: 'cat-1',
        curatedSocialNetwork: 'Instagram',
        defaultSellingPriceAmount: 300,
        defaultSellingPriceCurrency: 'USD',
        isVisible: true,
      });
    }

    it('accepts an integer string rate ("5")', async () => {
      stageWithRate('5');
      await service.curate('admin-rate', approveDto());
      expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
        expect.objectContaining({ providerCostAmount: 500 }),
      );
    });

    it('accepts a two-decimal string rate ("5.00")', async () => {
      stageWithRate('5.00');
      await service.curate('admin-rate', approveDto());
      expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
        expect.objectContaining({ providerCostAmount: 500 }),
      );
    });

    it('accepts a two-decimal string rate ("5.99")', async () => {
      stageWithRate('5.99');
      await service.curate('admin-rate', approveDto());
      expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
        expect.objectContaining({ providerCostAmount: 599 }),
      );
    });

    it('accepts a numeric rate (5)', async () => {
      stageWithRate(5);
      await service.curate('admin-rate', approveDto());
      expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
        expect.objectContaining({ providerCostAmount: 500 }),
      );
    });

    it('accepts a numeric rate (5.5)', async () => {
      stageWithRate(5.5);
      await service.curate('admin-rate', approveDto());
      expect(masterServiceRepository.createCurated).toHaveBeenCalledWith(
        expect.objectContaining({ providerCostAmount: 550 }),
      );
    });

    it('rejects a rate with 3+ decimal digits ("5.123")', async () => {
      stageWithRate('5.123');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative rate ("-1.00")', async () => {
      stageWithRate('-1.00');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a non-numeric rate ("abc")', async () => {
      stageWithRate('abc');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an empty rate ("")', async () => {
      stageWithRate('');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a rate with multiple decimal points ("5.5.5")', async () => {
      stageWithRate('5.5.5');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a rate with thousands separators ("1,000.00")', async () => {
      stageWithRate('1,000.00');
      await expect(service.curate('admin-rate', approveDto())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  it('validates approval payload requirements', () => {
    expect(() =>
      StagedCurationDto.validate({
        stagedServiceId: 'staged-4',
        action: 'approve',
      }),
    ).toThrow(BadRequestException);
  });

  it('fails if the staged service is missing', async () => {
    stagedServiceRepository.findById.mockResolvedValue(null);

    const dto = StagedCurationDto.validate({
      stagedServiceId: 'missing',
      action: 'reject',
    });

    await expect(service.curate('admin-4', dto)).rejects.toThrow(
      NotFoundException,
    );
  });
});
