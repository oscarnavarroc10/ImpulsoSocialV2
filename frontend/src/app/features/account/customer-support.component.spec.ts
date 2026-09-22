import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { CustomerSupportComponent } from './customer-support.component';

class Loader implements TranslocoLoader { getTranslation() { return of({ account: { supportEyebrow: 'Help', support: 'Support', supportIntro: 'Intro', supportNotConfigured: 'Support is not configured', supportUnavailable: 'No support channel' }, common: { unavailable: 'Unavailable' } }); } }

describe('CustomerSupportComponent', () => {
  it('shows the honest not-configured state without making a support request', () => {
    TestBed.configureTestingModule({ imports: [CustomerSupportComponent], providers: [provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }), provideTranslocoLoader(Loader)] });
    const fixture = TestBed.createComponent(CustomerSupportComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Support is not configured');
    expect(fixture.nativeElement.textContent).toContain('No support channel');
  });
});
