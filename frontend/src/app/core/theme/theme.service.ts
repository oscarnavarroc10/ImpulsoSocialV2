import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { ThemePreference, ThemePresetConfig, ThemeTokens } from '../config/tenant-config.model';
import { TenantConfigService } from '../config/tenant-config.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly tenant = inject(TenantConfigService);
  private readonly preferenceSignal = signal<ThemePreference>('dark');
  private readonly effectiveSignal = signal<'light' | 'dark'>('dark');
  private readonly presetSignal = signal('');
  private mediaQuery: MediaQueryList | null = null;
  private initialized = false;

  private readonly mediaListener = (): void => {
    if (this.preference() === 'system') this.apply();
  };

  readonly preference = this.preferenceSignal.asReadonly();
  readonly effectiveTheme = this.effectiveSignal.asReadonly();
  readonly preset = this.presetSignal.asReadonly();
  readonly presets = computed<readonly ThemePresetConfig[]>(
    () => this.tenant.config()?.theme.presets ?? [],
  );

  initialize(): void {
    const config = this.tenant.config();
    if (!config) return;

    const themeStorageKey = `impulsosocial:${config.tenantSlug}:theme`;
    const presetStorageKey = `impulsosocial:${config.tenantSlug}:theme-preset`;
    const storedPreference = this.readStorage(themeStorageKey);
    const storedPreset = this.readStorage(presetStorageKey);
    const preference = this.isPreference(storedPreference)
      ? storedPreference
      : config.theme.defaultPreference;
    const preset =
      storedPreset !== null &&
      config.theme.presets.some((candidate) => candidate.key === storedPreset)
        ? storedPreset
        : config.theme.defaultPreset;

    this.preferenceSignal.set(preference);
    this.presetSignal.set(preset);
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
    if (slug) this.writeStorage(`impulsosocial:${slug}:theme`, preference);
    this.removeListener();
    if (preference === 'system') this.addListener();
    this.apply();
  }

  setPreset(presetKey: string): void {
    const config = this.tenant.config();
    if (!config?.theme.presets.some((preset) => preset.key === presetKey)) return;

    this.presetSignal.set(presetKey);
    this.writeStorage(`impulsosocial:${config.tenantSlug}:theme-preset`, presetKey);
    this.apply();
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
    const preset =
      config.theme.presets.find((candidate) => candidate.key === this.preset()) ??
      config.theme.presets.find((candidate) => candidate.key === config.theme.defaultPreset);
    if (!preset) return;

    this.effectiveSignal.set(effectiveTheme);
    this.applyTokens(preset[effectiveTheme]);
    const root = this.document.documentElement;
    root.dataset['theme'] = effectiveTheme;
    root.dataset['themePreset'] = preset.key;
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
