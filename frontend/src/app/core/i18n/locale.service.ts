import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Locale } from '../config/tenant-config.model';
import { TenantConfigService } from '../config/tenant-config.service';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  private readonly tenant = inject(TenantConfigService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeSignal = signal<Locale>('es-MX');
  readonly locale = this.localeSignal.asReadonly();

  initialize(): void {
    const config = this.tenant.config();
    if (!config) return;
    const stored = this.readStorage(`impulsosocial:${config.tenantSlug}:locale`);
    const locale = config.localization.supportedLocales.includes(stored as Locale) ? stored as Locale : config.localization.defaultLocale;
    this.setActive(locale, false);
  }

  setLocale(locale: Locale): void {
    if (!this.tenant.config()?.localization.supportedLocales.includes(locale)) return;
    this.setActive(locale, true);
  }

  private setActive(locale: Locale, persist: boolean): void {
    this.localeSignal.set(locale);
    this.document.documentElement.lang = locale;
    if (persist) {
      const slug = this.tenant.config()?.tenantSlug;
      if (slug) this.writeStorage(`impulsosocial:${slug}:locale`, locale);
    }
    this.transloco.setActiveLang(locale);
  }
  private readStorage(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
  private writeStorage(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* storage is optional */ } }
}
