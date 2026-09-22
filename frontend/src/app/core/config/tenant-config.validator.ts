import {
  IconKey,
  Locale,
  TenantUiConfig,
  ThemePreference,
  ThemeTokens,
} from './tenant-config.model';

export const tokenKeys = [
  'primary',
  'primaryContrast',
  'secondary',
  'accent',
  'background',
  'surface',
  'surfaceElevated',
  'text',
  'textMuted',
  'border',
  'success',
  'warning',
  'danger',
  'focus',
  'heroStart',
  'heroEnd',
  'authSurface',
  'authText',
] as const satisfies readonly (keyof ThemeTokens)[];

export const iconKeys = [
  'instagram',
  'followers',
  'likes',
  'views',
  'reposts',
  'comments',
  'whatsapp',
  'tiktok',
  'sun',
  'moon',
  'system',
  'palette',
  'wallet',
  'card',
  'bank',
  'crypto',
  'google',
  'apple',
  'eye',
  'link',
  'hash',
  'mail',
  'lock',
  'user',
  'home',
  'orders',
  'support',
  'logout',
  'menu',
  'close',
  'arrowRight',
  'check',
  'alert',
] as const satisfies readonly IconKey[];

const themePreferences = ['light', 'dark', 'system'] as const satisfies readonly ThemePreference[];
const locales = ['es-MX', 'en'] as const satisfies readonly Locale[];
const paymentAvailabilities = ['manual', 'comingSoon', 'disabled'] as const;
const socialAuthAvailabilities = ['comingSoon', 'disabled'] as const;

type UnknownRecord = Record<string, unknown>;

function invalid(): never {
  throw new Error('Invalid tenant configuration');
}

const isRecord = (value: unknown): value is UnknownRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function assertRecord(value: unknown): asserts value is UnknownRecord {
  if (!isRecord(value)) invalid();
}

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.includes(value as T);

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

const isSafeLocalOrHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value, 'http://localhost');
    const isLocalDevelopmentHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalDevelopmentHost);
  } catch {
    return false;
  }
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const isIconKey = (value: unknown): value is IconKey => isOneOf(value, iconKeys);

const isThemeTokens = (value: unknown): value is ThemeTokens =>
  isRecord(value) && tokenKeys.every((key) => isString(value[key]));

function validateOptionalUrl(record: UnknownRecord, key: string, externalOnly = false): void {
  const value = record[key];
  if (value === undefined) return;
  if (!isString(value) || !(externalOnly ? isHttpsUrl(value) : isSafeLocalOrHttpsUrl(value))) {
    invalid();
  }
}

function assertTenantConfig(value: unknown): asserts value is TenantUiConfig {
  assertRecord(value);
  if (value['version'] !== 1) invalid();

  const tenantSlug = value['tenantSlug'];
  const apiBaseUrl = value['apiBaseUrl'];
  if (!isString(tenantSlug) || !isString(apiBaseUrl) || !isSafeLocalOrHttpsUrl(apiBaseUrl)) {
    invalid();
  }

  const brand = value['brand'];
  const theme = value['theme'];
  const localization = value['localization'];
  const socialLinks = value['socialLinks'];
  const socialAuth = value['socialAuth'];
  const catalog = value['catalog'];
  assertRecord(brand);
  assertRecord(theme);
  assertRecord(localization);
  assertRecord(socialLinks);
  assertRecord(socialAuth);
  assertRecord(catalog);

  if (!isString(brand['name']) || !isString(brand['shortName']) || !isString(brand['taglineKey'])) {
    invalid();
  }
  validateOptionalUrl(brand, 'logoLightUrl');
  validateOptionalUrl(brand, 'logoDarkUrl');
  validateOptionalUrl(brand, 'faviconUrl');
  const personalityLogoUrls = brand['personalityLogoUrls'];
  if (personalityLogoUrls !== undefined) {
    assertRecord(personalityLogoUrls);
    for (const key of ['girly', 'tomboy'] as const) {
      validateOptionalUrl(personalityLogoUrls, key);
    }
  }

  const defaultPreference = theme['defaultPreference'];
  const defaultPreset = theme['defaultPreset'];
  const presets = theme['presets'];
  if (
    !isOneOf(defaultPreference, themePreferences) ||
    !isString(defaultPreset) ||
    !Array.isArray(presets) ||
    presets.length === 0 ||
    presets.length > 8
  ) {
    invalid();
  }

  const presetKeys: string[] = [];
  for (const preset of presets) {
    assertRecord(preset);
    if (
      !isString(preset['key']) ||
      !isString(preset['labelKey']) ||
      !isThemeTokens(preset['light']) ||
      !isThemeTokens(preset['dark'])
    ) {
      invalid();
    }
    presetKeys.push(preset['key']);
  }
  if (hasDuplicates(presetKeys) || !presetKeys.includes(defaultPreset)) invalid();

  const defaultLocale = localization['defaultLocale'];
  const supportedLocales = localization['supportedLocales'];
  if (
    !isOneOf(defaultLocale, locales) ||
    !Array.isArray(supportedLocales) ||
    supportedLocales.length === 0 ||
    !supportedLocales.every((locale) => isOneOf(locale, locales)) ||
    hasDuplicates(supportedLocales) ||
    !supportedLocales.includes(defaultLocale)
  ) {
    invalid();
  }

  validateOptionalUrl(socialLinks, 'whatsappUrl', true);
  validateOptionalUrl(socialLinks, 'tiktokUrl', true);
  validateOptionalUrl(socialLinks, 'instagramUrl', true);

  for (const providerKey of ['google', 'apple'] as const) {
    const provider = socialAuth[providerKey];
    assertRecord(provider);
    if (!isOneOf(provider['availability'], socialAuthAvailabilities)) invalid();
  }

  const networks = catalog['networks'];
  const featuredLimit = catalog['featuredLimit'];
  if (
    !Array.isArray(networks) ||
    typeof featuredLimit !== 'number' ||
    !Number.isInteger(featuredLimit) ||
    featuredLimit < 1 ||
    featuredLimit > 8
  ) {
    invalid();
  }

  const networkKeys: string[] = [];
  for (const network of networks) {
    assertRecord(network);
    if (
      !isString(network['key']) ||
      !isString(network['labelKey']) ||
      !isIconKey(network['icon']) ||
      typeof network['enabled'] !== 'boolean' ||
      !Array.isArray(network['categories'])
    ) {
      invalid();
    }
    networkKeys.push(network['key']);

    const categoryKeys: string[] = [];
    for (const category of network['categories']) {
      assertRecord(category);
      if (
        !isString(category['key']) ||
        !isIconKey(category['icon']) ||
        !isString(category['labelKey']) ||
        typeof category['order'] !== 'number' ||
        !Number.isInteger(category['order']) ||
        (category['backendCategoryId'] !== undefined && !isString(category['backendCategoryId']))
      ) {
        invalid();
      }
      categoryKeys.push(category['key']);
    }
    if (hasDuplicates(categoryKeys)) invalid();
  }
  if (hasDuplicates(networkKeys)) invalid();

  const payments = value['payments'];
  if (!Array.isArray(payments)) invalid();
  const paymentKeys: string[] = [];
  for (const payment of payments) {
    assertRecord(payment);
    if (
      !isString(payment['key']) ||
      !isIconKey(payment['icon']) ||
      !isString(payment['labelKey']) ||
      !isString(payment['descriptionKey']) ||
      !isOneOf(payment['availability'], paymentAvailabilities)
    ) {
      invalid();
    }
    paymentKeys.push(payment['key']);
  }
  if (hasDuplicates(paymentKeys)) invalid();
}

export function validateTenantConfig(value: unknown): TenantUiConfig {
  assertTenantConfig(value);
  return value;
}
