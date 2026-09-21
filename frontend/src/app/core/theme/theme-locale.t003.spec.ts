import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantUiConfig } from '../config/tenant-config.model';
import { TenantConfigService } from '../config/tenant-config.service';
import { LocaleService } from '../i18n/locale.service';
import { ThemeService } from './theme.service';

const config: TenantUiConfig = {
  version: 1,
  tenantSlug: 'theme-test',
  apiBaseUrl: '/api',
  brand: { name: 'Test', shortName: 'T', taglineKey: 'home.tagline' },
  theme: {
    defaultPreference: 'dark',
    defaultPreset: 'spotify',
    presets: [
      {
        key: 'spotify',
        labelKey: 'themes.spotify',
        light: {
          background: '#fff',
          surface: '#fff',
          surfaceElevated: '#eee',
          text: '#111',
          textMuted: '#555',
          border: '#ddd',
          primary: '#080',
          primaryContrast: '#fff',
          secondary: '#060',
          accent: '#0a0',
          focus: '#060',
          success: '#080',
          warning: '#a60',
          danger: '#b00',
          heroStart: '#fff',
          heroEnd: '#eee',
          authSurface: '#111',
          authText: '#fff',
        },
        dark: {
          background: '#111',
          surface: '#222',
          surfaceElevated: '#333',
          text: '#fff',
          textMuted: '#ccc',
          border: '#555',
          primary: '#1db954',
          primaryContrast: '#041108',
          secondary: '#53e389',
          accent: '#1ed760',
          focus: '#73f3a4',
          success: '#4c4',
          warning: '#fc5',
          danger: '#f66',
          heroStart: '#111',
          heroEnd: '#173626',
          authSurface: '#111',
          authText: '#fff',
        },
      },
      {
        key: 'x',
        labelKey: 'themes.x',
        light: {
          background: '#fff',
          surface: '#f7f9f9',
          surfaceElevated: '#eff3f4',
          text: '#0f1419',
          textMuted: '#536471',
          border: '#cfd9de',
          primary: '#0f1419',
          primaryContrast: '#fff',
          secondary: '#1d9bf0',
          accent: '#1d9bf0',
          focus: '#1d9bf0',
          success: '#00ba7c',
          warning: '#b88600',
          danger: '#f4212e',
          heroStart: '#fff',
          heroEnd: '#e8f4fc',
          authSurface: '#0f1419',
          authText: '#fff',
        },
        dark: {
          background: '#0f1419',
          surface: '#16181c',
          surfaceElevated: '#202327',
          text: '#e7e9ea',
          textMuted: '#71767b',
          border: '#2f3336',
          primary: '#eff3f4',
          primaryContrast: '#0f1419',
          secondary: '#1d9bf0',
          accent: '#1d9bf0',
          focus: '#1d9bf0',
          success: '#00ba7c',
          warning: '#ffd400',
          danger: '#f4212e',
          heroStart: '#0f1419',
          heroEnd: '#162d3d',
          authSurface: '#0f1419',
          authText: '#e7e9ea',
        },
      },
    ],
  },
  localization: { defaultLocale: 'es-MX', supportedLocales: ['es-MX', 'en'] },
  socialLinks: {},
  socialAuth: {
    google: { availability: 'comingSoon' },
    apple: { availability: 'comingSoon' },
  },
  catalog: { featuredLimit: 4, networks: [] },
  payments: [],
};

describe('T003 theme and locale services', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['es-MX', 'en'], defaultLang: 'es-MX' },
        }),
        {
          provide: TenantConfigService,
          useValue: { config: () => config },
        },
      ],
    });
    localStorage.clear();
  });

  it('defaults to the configured dark theme', () => {
    const service = TestBed.inject(ThemeService);
    service.initialize();
    expect(service.preference()).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('applies dark tokens and color scheme', () => {
    const service = TestBed.inject(ThemeService);
    service.initialize();
    expect(document.documentElement.style.getPropertyValue('--color-background')).toBe('#111');
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('dark');
  });

  it('persists theme using the tenant namespace', () => {
    const service = TestBed.inject(ThemeService);
    service.initialize();
    service.setPreference('light');
    expect(localStorage.getItem('impulsosocial:theme-test:theme')).toBe('light');
  });

  it('switches and persists a configured visual preset', () => {
    const service = TestBed.inject(ThemeService);
    service.initialize();
    service.setPreset('x');
    expect(service.preset()).toBe('x');
    expect(document.documentElement.dataset['themePreset']).toBe('x');
    expect(document.documentElement.style.getPropertyValue('--color-secondary')).toBe('#1d9bf0');
    expect(localStorage.getItem('impulsosocial:theme-test:theme-preset')).toBe('x');
  });

  it('ignores an unknown visual preset', () => {
    const service = TestBed.inject(ThemeService);
    service.initialize();
    service.setPreset('unknown');
    expect(service.preset()).toBe('spotify');
  });

  it('falls back to the configured preset when storage is invalid', () => {
    localStorage.setItem('impulsosocial:theme-test:theme-preset', 'missing');
    const service = TestBed.inject(ThemeService);
    service.initialize();
    expect(service.preset()).toBe('spotify');
  });

  it('ignores an invalid stored theme preference', () => {
    localStorage.setItem('impulsosocial:theme-test:theme', 'neon');
    const service = TestBed.inject(ThemeService);
    service.initialize();
    expect(service.preference()).toBe('dark');
  });

  it('does not throw when storage is unavailable', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => TestBed.inject(ThemeService).initialize()).not.toThrow();
    get.mockRestore();
  });

  it('adds and removes the system media listener', () => {
    const add = vi.fn();
    const remove = vi.fn();
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: add,
      removeEventListener: remove,
    }));
    const service = TestBed.inject(ThemeService);
    service.initialize();
    service.setPreference('system');
    expect(add).toHaveBeenCalled();
    service.destroy();
    expect(remove).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('initializes the locale from tenant defaults', () => {
    const service = TestBed.inject(LocaleService);
    service.initialize();
    expect(service.locale()).toBe('es-MX');
    expect(document.documentElement.lang).toBe('es-MX');
  });

  it('persists a supported locale in the tenant namespace', () => {
    const service = TestBed.inject(LocaleService);
    service.initialize();
    service.setLocale('en');
    expect(service.locale()).toBe('en');
    expect(localStorage.getItem('impulsosocial:theme-test:locale')).toBe('en');
  });

  it('ignores an unsupported locale', () => {
    const service = TestBed.inject(LocaleService);
    service.initialize();
    service.setLocale('fr' as 'en');
    expect(service.locale()).toBe('es-MX');
  });

  it('uses a valid persisted locale', () => {
    localStorage.setItem('impulsosocial:theme-test:locale', 'en');
    const service = TestBed.inject(LocaleService);
    service.initialize();
    expect(service.locale()).toBe('en');
  });
});
