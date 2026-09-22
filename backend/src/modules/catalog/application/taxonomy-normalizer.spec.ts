import { normalizeProviderTaxonomy } from './taxonomy-normalizer';

describe('normalizeProviderTaxonomy', () => {
  it.each([
    ['Instagram - Likes [ Country Targeted ]', 'Instagram', 'Likes'],
    ['Instagram - Followers [ Refill 30D ]', 'Instagram', 'Followers'],
    ['TikTok - Likes | Guaranteed', 'TikTok', 'Likes'],
    ['TikTok - Followers [ HQ ]', 'TikTok', 'Followers'],
    ['YouTube - Likes [ High Speed ]', 'YouTube', 'Likes'],
    ['YouTube - Native Views | Country Targeted', 'YouTube', 'Views'],
    ['YouTube - Subscribers [ Refill ]', 'YouTube', 'Subscribers'],
    ['Facebook - Post Reactions', 'Facebook', 'Reactions'],
  ])('normalizes %s', (category, socialNetwork, categoryName) => {
    expect(
      normalizeProviderTaxonomy({ category, name: 'provider service' }),
    ).toEqual({ socialNetwork, categoryName });
  });

  it('uses the service name only for the known Likes+Followers ambiguity', () => {
    expect(
      normalizeProviderTaxonomy({
        category: 'TikTok - Likes+Followers [ Newly Added ]',
        name: 'TikTok - Likes ~ HQ ~ REFILL 30D',
      }),
    ).toEqual({ socialNetwork: 'TikTok', categoryName: 'Likes' });
  });

  it('does not classify Website traffic as the platform mentioned in the name', () => {
    expect(
      normalizeProviderTaxonomy({
        category: 'Website Traffic from Argentina',
        name: 'Argentina Traffic from Instagram',
      }),
    ).toBeNull();
  });

  it('does not classify unsupported or unknown provider categories', () => {
    expect(
      normalizeProviderTaxonomy({
        category: 'Spotify - Followers',
        name: 'Spotify followers',
      }),
    ).toBeNull();
    expect(
      normalizeProviderTaxonomy({ category: 'TikTok - Traffic' }),
    ).toBeNull();
  });
});
