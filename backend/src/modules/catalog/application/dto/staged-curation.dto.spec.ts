import { StagedCurationDto } from './staged-curation.dto';

describe('StagedCurationDto', () => {
  it('accepts YouTube as a curated social network', () => {
    expect(
      StagedCurationDto.validate({
        stagedServiceId: 'staged-1',
        action: 'approve',
        curatedTitle: 'YouTube Views',
        curatedDescription: 'Native video views',
        curatedCategoryId: 'category-views',
        curatedSocialNetwork: 'YouTube',
        defaultSellingPriceAmount: 100,
        defaultSellingPriceCurrency: 'MXN',
        isVisible: true,
      }),
    ).toMatchObject({ curatedSocialNetwork: 'YouTube' });
  });
});
