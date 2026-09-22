import '@angular/compiler';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTransloco, provideTranslocoLoader } from '@jsverse/transloco';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerBalanceStore } from '../../core/customer/customer-balance.store';
import { TranslationLoader } from '../../core/i18n/translation-loader';
import { AccountDashboardComponent } from './account-dashboard.component';

describe('AccountDashboardComponent', () => {
  const user = signal({
    id: 'user-1',
    nombre: 'Oscar Navarro',
    email: 'oscar@example.com',
    rol: 'cliente',
    tiendaId: 'tenant-1',
  });
  const logout = vi.fn(() => Promise.resolve());
  const reload = vi.fn();
  const balance = signal({ balance: { amount: 0, currency: 'MXN' } });
  const balanceState = signal<'ready'>('ready');

  beforeEach(() => {
    logout.mockClear();
    TestBed.configureTestingModule({
      imports: [AccountDashboardComponent],
      providers: [
        provideRouter([]),
        provideTransloco({ config: { availableLangs: ['es-MX'], defaultLang: 'es-MX' } }),
        provideTranslocoLoader(TranslationLoader),
        { provide: AuthService, useValue: { user, logout } },
        { provide: CustomerBalanceStore, useValue: { state: balanceState, balance, reload } },
      ],
    });
  });

  it('renders authenticated navigation and session identity', () => {
    const fixture = TestBed.createComponent(AccountDashboardComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[routerLink="/cuenta/servicios"]')).not.toBeNull();
    expect(host.querySelector('[routerLink="/cuenta/ordenes"]')).not.toBeNull();
    expect(host.querySelector('[routerLink="/cuenta/saldo"]')).not.toBeNull();
    expect(host.querySelector('[routerLink="/cuenta"]')).toBeNull();
    expect(host.textContent).toContain('Oscar Navarro');
    expect(host.querySelector('.account-welcome')).toBeNull();
    expect(host.querySelector('[aria-disabled="true"]')).toBeNull();
    expect(host.querySelector('.account-topbar')).not.toBeNull();
    expect(host.querySelector('.account-mobile-theme-control')).not.toBeNull();
    expect(host.querySelectorAll('.account-mobile-theme-control button')).toHaveLength(2);
    expect(host.querySelector('.account-toolbar-control--appearance')).not.toBeNull();
    expect(host.textContent).toContain('0.00 MXN');
    expect(host.querySelector('.account-sidebar .brand')?.getAttribute('href')).toBe(
      '/cuenta/nueva-orden',
    );
    expect(host.querySelector('.account-mobile-brand .brand')?.getAttribute('href')).toBe(
      '/cuenta/nueva-orden',
    );
  });

  it('exposes the logout control without inventing customer data', () => {
    const fixture = TestBed.createComponent(AccountDashboardComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.icon-button');

    expect(button).not.toBeNull();
    expect(button?.hasAttribute('aria-label')).toBe(true);
    expect(host.textContent).not.toContain('1000');
  });

  it('provides mobile primary destinations and a closable More sheet', () => {
    const fixture = TestBed.createComponent(AccountDashboardComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const mobileNav = host.querySelector('.account-mobile-nav')!;
    expect(mobileNav.querySelector('[routerLink="/cuenta/nueva-orden"]')).not.toBeNull();
    expect(mobileNav.querySelector('[routerLink="/cuenta/servicios"]')).not.toBeNull();
    expect(mobileNav.querySelector('[routerLink="/cuenta/saldo"]')).not.toBeNull();
    expect(mobileNav.querySelector('[routerLink="/cuenta/ordenes"]')).not.toBeNull();
    expect(mobileNav.querySelectorAll('a, button')).toHaveLength(5);
    expect(host.querySelector('.account-mobile-avatar')?.textContent?.trim()).toBe('ON');

    mobileNav.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    const sheet = host.querySelector('.account-mobile-sheet')!;
    expect(sheet.querySelector('[routerLink="/cuenta/soporte"]')).not.toBeNull();
    expect(sheet.querySelector('[routerLink="/cuenta/perfil"]')).toBeNull();
    expect(sheet.querySelector('app-locale-switcher')).toBeNull();
    expect(sheet.querySelector('app-theme-toggle')).toBeNull();
    expect(sheet.querySelector('.account-mobile-sheet__logout')).not.toBeNull();

    sheet.querySelector<HTMLButtonElement>('.icon-button')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.account-mobile-sheet')).toBeNull();

    host.querySelector<HTMLButtonElement>('.account-mobile-avatar')!.click();
    fixture.detectChanges();
    const profile = host.querySelector('.account-profile-popover')!;
    expect(profile.textContent).toContain('Oscar Navarro');
    expect(profile.textContent).toContain('oscar@example.com');
    expect(profile.querySelector('[routerLink="/cuenta/perfil"]')).not.toBeNull();
    expect(profile.querySelector('app-locale-switcher')).not.toBeNull();
    expect(profile.querySelector('app-theme-toggle .theme-segment')).not.toBeNull();
    expect(profile.querySelectorAll('app-theme-toggle .theme-segment')).toHaveLength(1);
    expect(profile.querySelectorAll('app-theme-toggle button')).toHaveLength(2);
    expect(profile.querySelector('.account-mobile-sheet__logout')).not.toBeNull();
  });
});
