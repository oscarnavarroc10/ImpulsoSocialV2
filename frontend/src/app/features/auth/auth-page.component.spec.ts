import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTransloco, provideTranslocoLoader } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { TranslationLoader } from '../../core/i18n/translation-loader';
import { AuthPageComponent } from './auth-page.component';

function setInput(element: HTMLInputElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('input'));
}

describe('AuthPageComponent login', () => {
  const login = vi.fn(() => Promise.resolve());
  const navigateByUrl = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideTransloco({
          config: { availableLangs: ['es-MX', 'en'], defaultLang: 'es-MX' },
        }),
        provideTranslocoLoader(TranslationLoader),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode: 'login' },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => false,
            isBusy: () => false,
            login,
          },
        },
        {
          provide: TenantConfigService,
          useValue: {
            config: () => ({
              socialAuth: {
                google: { availability: 'comingSoon' },
                apple: { availability: 'comingSoon' },
              },
            }),
          },
        },
      ],
    });
  });

  it('does not call the API when the form is invalid', () => {
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.auth-submit')
      ?.click();
    expect(login).not.toHaveBeenCalled();
  });

  it('keeps the password unchanged and navigates to the safe account default', async () => {
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const email = host.querySelector<HTMLInputElement>('input[formControlName="email"]');
    const password = host.querySelector<HTMLInputElement>('input[formControlName="password"]');
    if (!email || !password) throw new Error('Login controls are missing');

    setInput(email, '  oscar@example.com  ');
    setInput(password, ' password-1 ');
    host.querySelector<HTMLButtonElement>('.auth-submit')?.click();
    await fixture.whenStable();

    expect(login).toHaveBeenCalledWith({
      email: 'oscar@example.com',
      password: ' password-1 ',
    });
    expect(navigateByUrl).toHaveBeenCalledWith('/cuenta');
  });

  it('renders social providers as disabled preparation only', () => {
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.social-auth-button',
      ),
    );
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.social-auth-button small'),
    ).toBeNull();
  });
});
