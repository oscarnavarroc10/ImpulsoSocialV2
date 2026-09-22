export type ThemePreference = 'light' | 'dark' | 'system';
export type Locale = 'es-MX' | 'en';
export type PaymentAvailability = 'manual' | 'comingSoon' | 'disabled';
export type SocialAuthAvailability = 'comingSoon' | 'disabled';

export type IconKey =
  | 'instagram'
  | 'followers'
  | 'likes'
  | 'views'
  | 'reposts'
  | 'comments'
  | 'whatsapp'
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'sun'
  | 'moon'
  | 'system'
  | 'palette'
  | 'wallet'
  | 'card'
  | 'bank'
  | 'crypto'
  | 'google'
  | 'apple'
  | 'eye'
  | 'mail'
  | 'lock'
  | 'user'
  | 'home'
  | 'orders'
  | 'support'
  | 'logout'
  | 'menu'
  | 'close'
  | 'arrowRight'
  | 'check'
  | 'alert';

export interface ThemeTokens {
  primary: string;
  primaryContrast: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  focus: string;
  heroStart: string;
  heroEnd: string;
  authSurface: string;
  authText: string;
}

export interface ThemePresetConfig {
  key: string;
  labelKey: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export interface CatalogCategoryConfig {
  key: string;
  icon: IconKey;
  labelKey: string;
  order: number;
  backendCategoryId?: string;
}

export interface CatalogNetworkConfig {
  key: string;
  labelKey: string;
  icon: IconKey;
  enabled: boolean;
  categories: CatalogCategoryConfig[];
}

export interface PaymentMethodConfig {
  key: string;
  icon: IconKey;
  labelKey: string;
  descriptionKey: string;
  availability: PaymentAvailability;
}

export interface SocialAuthProviderConfig {
  availability: SocialAuthAvailability;
}

export interface TenantUiConfig {
  version: 1;
  tenantSlug: string;
  apiBaseUrl: string;
  brand: {
    name: string;
    shortName: string;
    taglineKey: string;
    logoLightUrl?: string;
    logoDarkUrl?: string;
    personalityLogoUrls?: Partial<Record<'girly' | 'tomboy', string>>;
    faviconUrl?: string;
  };
  theme: {
    defaultPreference: ThemePreference;
    defaultPreset: string;
    presets: ThemePresetConfig[];
  };
  localization: {
    defaultLocale: Locale;
    supportedLocales: Locale[];
  };
  socialLinks: {
    whatsappUrl?: string;
    tiktokUrl?: string;
    instagramUrl?: string;
  };
  socialAuth: {
    google: SocialAuthProviderConfig;
    apple: SocialAuthProviderConfig;
  };
  catalog: {
    networks: CatalogNetworkConfig[];
    featuredLimit: number;
  };
  payments: PaymentMethodConfig[];
}
