import '@angular/compiler';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { ThemeService } from '../../core/theme/theme.service';
import { BrandLogoComponent } from './brand-logo.component';

describe('BrandLogoComponent', () => {
  it('resolves the configured personality logo without hardcoding a tenant path', () => {
    const personality = signal<'girly' | 'tomboy'>('girly');
    const effectiveTheme = signal<'light' | 'dark'>('light');
    TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantConfigService,
          useValue: {
            config: () => ({
              brand: {
                name: 'White label',
                shortName: 'WL',
                personalityLogoUrls: {
                  girly: '/assets/branding/impulsocuentas/logo-girly.png',
                  tomboy: '/assets/branding/impulsocuentas/logo-tomboy.png',
                },
              },
            }),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            personality: personality.asReadonly(),
            effectiveTheme: effectiveTheme.asReadonly(),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(BrandLogoComponent);
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.src).toContain('/assets/branding/impulsocuentas/logo-girly.png');

    effectiveTheme.set('dark');
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('img') as HTMLImageElement).src).toContain(
      '/assets/branding/impulsocuentas/logo-girly.png',
    );

    personality.set('tomboy');
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('img') as HTMLImageElement).src).toContain(
      '/assets/branding/impulsocuentas/logo-tomboy.png',
    );
  });

  it('falls back to configured generic logos or neutral brand text', () => {
    const personality = signal<'girly' | 'tomboy'>('girly');
    TestBed.configureTestingModule({
      imports: [BrandLogoComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantConfigService,
          useValue: {
            config: () => ({
              brand: { name: 'Other tenant', shortName: 'Other' },
            }),
          },
        },
        {
          provide: ThemeService,
          useValue: { personality: personality.asReadonly(), effectiveTheme: signal('light') },
        },
      ],
    });

    const fixture = TestBed.createComponent(BrandLogoComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Other');
  });
});
