import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ThemePreference, ThemePresetConfig, ThemeTokens } from '../config/tenant-config.model';
import { TenantConfigService } from '../config/tenant-config.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly tenant = inject(TenantConfigService);
  private readonly preferenceSignal = signal<ThemePreference>('light');
  private readonly effectiveSignal = signal<'light' | 'dark'>('dark');
  private readonly personalitySignal = signal<'girly' | 'tomboy'>('girly');
  private mediaQuery: MediaQueryList | null = null;
  private initialized = false;

  private readonly mediaListener = (): void => {
    if (this.preference() === 'system') this.apply();
  };

  readonly preference = this.preferenceSignal.asReadonly();
  readonly effectiveTheme = this.effectiveSignal.asReadonly();
  readonly preset = this.personalitySignal.asReadonly();
  readonly personality = this.personalitySignal.asReadonly();
  readonly personalities = [
    { key: 'girly' as const, labelKey: 'themes.girly' },
    { key: 'tomboy' as const, labelKey: 'themes.tomboy' },
  ] as const;
  readonly presets = computed<readonly ThemePresetConfig[]>(() =>
    this.personalities.map((personality) => ({
      key: personality.key,
      labelKey: personality.labelKey,
      light: PERSONALITY_TOKENS[personality.key].light,
      dark: PERSONALITY_TOKENS[personality.key].dark,
    })),
  );

  initialize(): void {
    const config = this.tenant.config();
    if (!config) return;

    const themeStorageKey = `${config.tenantSlug}:theme`;
    const presetStorageKey = `${config.tenantSlug}:theme-preset`;
    const storedPreference = this.readStorage(themeStorageKey);
    const storedPreset = this.readStorage(presetStorageKey);
    const preference = this.isPreference(storedPreference)
      ? storedPreference
      : config.theme.defaultPreference;
    const personality = this.isPersonality(storedPreset) ? storedPreset : 'girly';

    this.preferenceSignal.set(preference);
    this.personalitySignal.set(personality);
    this.removeListener();
    this.mediaQuery = this.createMediaQuery();
    if (preference === 'system') this.addListener();
    this.initialized = true;
    this.apply();
  }

  setPreference(preference: ThemePreference): void {
    if (!this.isPreference(preference)) return;

    this.preferenceSignal.set(preference);
    const slug = this.tenant.config()?.tenantSlug;
    if (slug) this.writeStorage(`${slug}:theme`, preference);
    this.removeListener();
    if (preference === 'system') this.addListener();
    this.apply();
  }

  setPersonality(personality: 'girly' | 'tomboy'): void {
    const config = this.tenant.config();
    if (!config || !this.isPersonality(personality)) return;

    this.personalitySignal.set(personality);
    this.writeStorage(`${config.tenantSlug}:theme-preset`, personality);
    this.apply();
  }

  setPreset(presetKey: string): void {
    if (this.isPersonality(presetKey)) this.setPersonality(presetKey);
  }

  destroy(): void {
    this.removeListener();
    this.mediaQuery = null;
    this.initialized = false;
  }

  private apply(): void {
    const config = this.tenant.config();
    if (!this.initialized || !config) return;

    const preference = this.preference();
    const dark =
      preference === 'dark' || (preference === 'system' && this.mediaQuery?.matches === true);
    const effectiveTheme = dark ? 'dark' : 'light';
    const tokens = PERSONALITY_TOKENS[this.personality()][effectiveTheme];

    this.effectiveSignal.set(effectiveTheme);
    this.applyTokens(tokens);
    const root = this.document.documentElement;
    root.dataset['theme'] = effectiveTheme;
    root.dataset['themePreset'] = this.personality();
    root.style.setProperty('color-scheme', effectiveTheme);
  }

  private applyTokens(tokens: ThemeTokens): void {
    const root = this.document.documentElement;
    for (const key of Object.keys(tokens) as (keyof ThemeTokens)[]) {
      root.style.setProperty(
        `--color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        tokens[key],
      );
    }
    root.style.setProperty('--color-background-elevated', tokens.surfaceElevated);
    root.style.setProperty('--color-surface-secondary', tokens.surfaceElevated);
    root.style.setProperty('--color-surface-selected', `${tokens.primary}18`);
    root.style.setProperty('--color-text-primary', tokens.text);
    root.style.setProperty('--color-text-secondary', tokens.textMuted);
    root.style.setProperty('--color-text-accent', tokens.accent);
    root.style.setProperty('--color-heading', tokens.text);
    root.style.setProperty('--color-heading-accent', tokens.accent);
    root.style.setProperty('--color-link', tokens.secondary);
    root.style.setProperty('--color-border-strong', tokens.secondary);
    root.style.setProperty(
      '--gradient-background',
      `linear-gradient(135deg, ${tokens.heroStart}, ${tokens.heroEnd})`,
    );
    root.style.setProperty(
      '--gradient-accent',
      `linear-gradient(135deg, ${tokens.secondary}, ${tokens.accent})`,
    );
    root.style.setProperty(
      '--gradient-cta',
      `linear-gradient(135deg, ${tokens.primary}, ${tokens.accent})`,
    );
    root.style.setProperty(
      '--gradient-heading',
      `linear-gradient(135deg, ${tokens.secondary}, ${tokens.accent})`,
    );
    root.style.setProperty('--shadow-popover', `0 22px 58px ${tokens.authSurface}24`);
  }

  private createMediaQuery(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia('(prefers-color-scheme: dark)');
  }

  private addListener(): void {
    this.mediaQuery?.addEventListener('change', this.mediaListener);
  }

  private removeListener(): void {
    this.mediaQuery?.removeEventListener('change', this.mediaListener);
  }

  private isPreference(value: unknown): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private isPersonality(value: unknown): value is 'girly' | 'tomboy' {
    return value === 'girly' || value === 'tomboy';
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is optional; the active theme still changes in memory.
    }
  }
}

const PERSONALITY_TOKENS: Record<'girly' | 'tomboy', Record<'light' | 'dark', ThemeTokens>> = {
  girly: {
    light: {
      primary: '#d13b82',
      primaryContrast: '#fff',
      secondary: '#a72d68',
      accent: '#f06aa8',
      background: '#fff8fb',
      surface: '#fff',
      surfaceElevated: '#fff0f6',
      text: '#2b1721',
      textMuted: '#765d69',
      border: '#ecd5df',
      success: '#21845a',
      warning: '#9a6500',
      danger: '#b4234d',
      focus: '#c63b7d',
      heroStart: '#fffafd',
      heroEnd: '#fbe4ef',
      authSurface: '#291522',
      authText: '#fff8fb',
    },
    dark: {
      primary: '#ee6aaa',
      primaryContrast: '#2d1020',
      secondary: '#ff9cc8',
      accent: '#c94c91',
      background: '#101116',
      surface: '#191a20',
      surfaceElevated: '#242631',
      text: '#fff5fa',
      textMuted: '#b9b6bf',
      border: '#3d3744',
      success: '#66c995',
      warning: '#f0c35c',
      danger: '#ff7c9d',
      focus: '#ff9cc8',
      heroStart: '#101116',
      heroEnd: '#282035',
      authSurface: '#090a0e',
      authText: '#fff5fa',
    },
  },
  tomboy: {
    light: {
      primary: '#1769d2',
      primaryContrast: '#fff',
      secondary: '#1252a3',
      accent: '#12a9c7',
      background: '#f4f8fc',
      surface: '#fff',
      surfaceElevated: '#eaf2f9',
      text: '#101d2c',
      textMuted: '#5d7185',
      border: '#cfdeeb',
      success: '#16815d',
      warning: '#966400',
      danger: '#b52c39',
      focus: '#1769d2',
      heroStart: '#fbfdff',
      heroEnd: '#e0f1fb',
      authSurface: '#0c1b2c',
      authText: '#f4f9ff',
    },
    dark: {
      primary: '#4b9cff',
      primaryContrast: '#071525',
      secondary: '#75c9ef',
      accent: '#25bfd1',
      background: '#0d1724',
      surface: '#142334',
      surfaceElevated: '#1d3044',
      text: '#eef7ff',
      textMuted: '#9eb3c6',
      border: '#2c465e',
      success: '#5dd0a3',
      warning: '#f0c35c',
      danger: '#ff7e83',
      focus: '#75c9ef',
      heroStart: '#0d1724',
      heroEnd: '#112f4a',
      authSurface: '#07111d',
      authText: '#eef7ff',
    },
  },
};
