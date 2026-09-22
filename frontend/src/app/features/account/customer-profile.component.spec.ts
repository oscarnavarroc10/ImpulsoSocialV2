import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerProfileComponent } from './customer-profile.component';

class Loader implements TranslocoLoader { getTranslation() { return of({ account: { profileEyebrow: 'Profile', profileTitle: 'Your profile', profileIntro: 'Intro', profilePhone: 'Phone', role: 'Role' }, auth: { name: 'Name', email: 'Email' }, common: { unavailable: 'Unavailable' } }); } }

describe('CustomerProfileComponent', () => {
  it('renders only authenticated identity fields and marks unsupported fields unavailable', () => {
    TestBed.configureTestingModule({ imports: [CustomerProfileComponent], providers: [provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }), provideTranslocoLoader(Loader), { provide: AuthService, useValue: { user: () => ({ nombre: 'Ada', email: 'ada@example.test', rol: 'customer' }) } }] });
    const fixture = TestBed.createComponent(CustomerProfileComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada');
    expect(fixture.nativeElement.textContent).toContain('Unavailable');
  });
});
