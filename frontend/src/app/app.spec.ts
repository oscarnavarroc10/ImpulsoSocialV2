import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { TenantConfigService, TenantConfigState } from './core/config/tenant-config.service';
import { TranslationLoader } from './core/i18n/translation-loader';

describe('App shell', () => {
  const configState = signal<TenantConfigState>('loading');
  const retry = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    configState.set('loading');
    retry.mockClear();

    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideTransloco({
          config: { availableLangs: ['es-MX', 'en'], defaultLang: 'es-MX' },
        }),
        provideTranslocoLoader(TranslationLoader),
        {
          provide: TenantConfigService,
          useValue: {
            state: configState.asReadonly(),
            retry,
          },
        },
      ],
    });
  });

  it('creates without the Angular starter content', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Hello, frontend');
  });

  it('renders a loading shell before tenant configuration is ready', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.config-loading')).not.toBeNull();
  });

  it('exposes an explicit configuration error shell', () => {
    configState.set('configurationError');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.config-error')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).not.toBeNull();
  });
});
