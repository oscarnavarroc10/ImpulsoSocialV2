import { ApplicationInitStatus, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTransloco, provideTranslocoLoader } from '@jsverse/transloco';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { appConfig } from '../../app.config';
import { TenantConfigService } from './tenant-config.service';
import { TenantUiConfig, ThemeTokens } from './tenant-config.model';
import { validateTenantConfig, iconKeys } from './tenant-config.validator';
import { TranslationLoader } from '../i18n/translation-loader';

const tokens: ThemeTokens = {
  primary: '#123456',
  primaryContrast: '#123456',
  secondary: '#123456',
  accent: '#123456',
  background: '#123456',
  surface: '#123456',
  surfaceElevated: '#123456',
  text: '#123456',
  textMuted: '#123456',
  border: '#123456',
  success: '#123456',
  warning: '#123456',
  danger: '#123456',
  focus: '#123456',
  heroStart: '#123456',
  heroEnd: '#123456',
  authSurface: '#123456',
  authText: '#123456',
};
const makeConfig = (): TenantUiConfig => ({
  version: 1,
  tenantSlug: 'test-tenant',
  apiBaseUrl: '/api',
  brand: { name: 'Test', shortName: 'T', taglineKey: 'home.tagline' },
  theme: {
    defaultPreference: 'dark',
    defaultPreset: 'spotify',
    presets: [
      {
        key: 'spotify',
        labelKey: 'themes.spotify',
        light: tokens,
        dark: tokens,
      },
    ],
  },
  localization: { defaultLocale: 'es-MX', supportedLocales: ['es-MX', 'en'] },
  socialLinks: {},
  socialAuth: {
    google: { availability: 'comingSoon' },
    apple: { availability: 'comingSoon' },
  },
  catalog: {
    featuredLimit: 4,
    networks: [
      {
        key: 'instagram',
        labelKey: 'common.instagram',
        icon: 'instagram',
        enabled: true,
        categories: [{ key: 'likes', icon: 'likes', labelKey: 'home.categories.likes', order: 1 }],
      },
    ],
  },
  payments: [
    {
      key: 'card',
      icon: 'card',
      labelKey: 'payments.card',
      descriptionKey: 'payments.descriptions.card',
      availability: 'comingSoon',
    },
  ],
});

function cloneConfig(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(makeConfig())) as Record<string, unknown>;
}

describe('T001-T002 tenant configuration', () => {
  it('accepts the complete valid contract', () =>
    expect(validateTenantConfig(makeConfig())).toEqual(makeConfig()));
  it('rejects an unknown version', () =>
    expect(() => validateTenantConfig({ version: 2 })).toThrow());
  it('rejects an external non-HTTPS API URL', () => {
    const value = cloneConfig();
    value['apiBaseUrl'] = 'http://example.com';
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('accepts localhost development API URLs', () => {
    const value = cloneConfig();
    value['apiBaseUrl'] = 'http://localhost:3000';
    expect(validateTenantConfig(value).apiBaseUrl).toBe('http://localhost:3000');
  });
  it('rejects a palette with a missing semantic token', () => {
    const value = cloneConfig();
    const theme = value['theme'] as Record<string, unknown>;
    const presets = theme['presets'] as Record<string, unknown>[];
    delete (presets[0]['light'] as Record<string, unknown>)['focus'];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects duplicate theme preset keys', () => {
    const value = cloneConfig();
    const theme = value['theme'] as Record<string, unknown>;
    const preset = makeConfig().theme.presets[0];
    theme['presets'] = [preset, preset];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects a default theme preset that is not configured', () => {
    const value = cloneConfig();
    (value['theme'] as Record<string, unknown>)['defaultPreset'] = 'missing';
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects duplicate network keys', () => {
    const value = cloneConfig();
    (value['catalog'] as Record<string, unknown>)['networks'] = [
      makeConfig().catalog.networks[0],
      makeConfig().catalog.networks[0],
    ];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects duplicate category keys', () => {
    const value = cloneConfig();
    const category = makeConfig().catalog.networks[0].categories[0];
    (value['catalog'] as Record<string, unknown>)['networks'] = [
      { ...makeConfig().catalog.networks[0], categories: [category, category] },
    ];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects an icon outside the allow-list', () => {
    const value = cloneConfig();
    (value['catalog'] as Record<string, unknown>)['networks'] = [
      { ...makeConfig().catalog.networks[0], icon: 'heart' },
    ];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('exposes the theme and payment icons', () => {
    expect(iconKeys).toEqual(
      expect.arrayContaining(['palette', 'wallet', 'card', 'bank', 'crypto']),
    );
  });
  it('rejects duplicate payment keys', () => {
    const value = cloneConfig();
    const payment = makeConfig().payments[0];
    value['payments'] = [payment, payment];
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects an invalid featured limit', () => {
    const value = cloneConfig();
    (value['catalog'] as Record<string, unknown>)['featuredLimit'] = 9;
    expect(() => validateTenantConfig(value)).toThrow();
  });
  it('rejects a locale absent from supported locales', () => {
    const value = cloneConfig();
    (value['localization'] as Record<string, unknown>)['defaultLocale'] = 'en';
    (value['localization'] as Record<string, unknown>)['supportedLocales'] = ['es-MX'];
    expect(() => validateTenantConfig(value)).toThrow();
  });

  describe('real app initializer', () => {
    let http: HttpTestingController;
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          ...appConfig.providers,
          provideHttpClient(),
          provideHttpClientTesting(),
          provideTransloco({ config: { availableLangs: ['es-MX', 'en'], defaultLang: 'es-MX' } }),
          provideTranslocoLoader(TranslationLoader),
        ],
      });
      http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.verify());

    it('resolves ApplicationInitStatus before exposing a valid config', async () => {
      const status = TestBed.inject(ApplicationInitStatus);
      const request = http.expectOne('/config/tenant-config.json');
      request.flush(makeConfig());
      await status.donePromise;
      expect(TestBed.inject(TenantConfigService).state()).toBe('ready');
    });
    it('finishes in configurationError on a 404 without rejecting', async () => {
      const status = TestBed.inject(ApplicationInitStatus);
      http
        .expectOne('/config/tenant-config.json')
        .flush({}, { status: 404, statusText: 'Not Found' });
      await expect(status.donePromise).resolves.toBeUndefined();
      expect(TestBed.inject(TenantConfigService).state()).toBe('configurationError');
    });
    it('clears a previous error and reaches ready after retry', async () => {
      const service = TestBed.inject(TenantConfigService);
      http
        .expectOne('/config/tenant-config.json')
        .flush({}, { status: 500, statusText: 'Server Error' });
      await TestBed.inject(ApplicationInitStatus).donePromise;
      const retry = service.retry();
      expect(service.state()).toBe('loading');
      http.expectOne('/config/tenant-config.json').flush(makeConfig());
      await retry;
      expect(service.state()).toBe('ready');
      expect(service.config()?.tenantSlug).toBe('test-tenant');
    });
  });
});
