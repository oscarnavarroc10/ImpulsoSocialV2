export const SUPPORTED_SOCIAL_NETWORKS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Facebook',
] as const;

export type SupportedSocialNetwork = (typeof SUPPORTED_SOCIAL_NETWORKS)[number];

export interface NormalizedTaxonomy {
  socialNetwork: SupportedSocialNetwork;
  categoryName: string;
}

type ProviderPayload = Record<string, unknown>;

const PLATFORM_PATTERNS: ReadonlyArray<
  readonly [SupportedSocialNetwork, RegExp]
> = [
  ['Instagram', /\binstagram\b/i],
  ['TikTok', /\btik\s*tok\b/i],
  ['YouTube', /\byou\s*tube\b/i],
  ['Facebook', /\bfacebook\b/i],
];

const CATEGORY_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Story Views', /\bstory\s+views?\b/i],
  ['Story Reactions', /\bstory\s+reactions?\b/i],
  ['Live Views', /\blive\s+views?\b/i],
  ['Watch Time', /\bwatch\s+time\b/i],
  ['Subscribers', /\bsubscriber(?:s)?\b/i],
  ['Followers', /\bfollower(?:s)?\b/i],
  ['Comments', /\bcomments?\b/i],
  ['Reactions', /\breactions?\b|\bpost\s+reactions?\b/i],
  ['Shares', /\bshares?\b/i],
  ['Likes', /\blikes?\b/i],
  ['Views', /\bviews?\b/i],
];

function stringValue(payload: ProviderPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function findPlatform(category: string): SupportedSocialNetwork | null {
  for (const [platform, pattern] of PLATFORM_PATTERNS) {
    if (pattern.test(category)) {
      return platform;
    }
  }

  return null;
}

function findCategory(category: string): string | null {
  for (const [name, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(category)) {
      return name;
    }
  }

  return null;
}

export function normalizeProviderTaxonomy(
  rawPayload: unknown,
): NormalizedTaxonomy | null {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return null;
  }

  const payload = rawPayload as ProviderPayload;
  const providerCategory = stringValue(payload, 'category');
  if (!providerCategory) {
    return null;
  }

  const socialNetwork = findPlatform(providerCategory);
  if (!socialNetwork) {
    return null;
  }

  const ambiguousCategory =
    /\b(likes\s*\+\s*followers|followers\s*\+\s*likes)\b/i.test(
      providerCategory,
    );
  const categorySource = ambiguousCategory
    ? stringValue(payload, 'name')
    : providerCategory;
  if (!categorySource) {
    return null;
  }

  const categoryName = findCategory(categorySource);
  if (!categoryName || (ambiguousCategory && categoryName === 'Views')) {
    return null;
  }

  return { socialNetwork, categoryName };
}
