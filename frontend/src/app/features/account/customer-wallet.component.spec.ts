import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { provideTransloco, provideTranslocoLoader, TranslocoLoader } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { WalletApiService } from '../../core/customer/wallet-api.service';
import { CustomerWalletComponent } from './customer-wallet.component';

class Loader implements TranslocoLoader {
  getTranslation() {
    return of({
      account: {
        walletEyebrow: 'Wallet',
        wallet: 'Wallet',
        walletIntro: 'Intro',
        walletLoading: 'Loading',
        walletUnavailable: 'Unavailable',
        currentBalance: 'Balance',
        movementsTitle: 'Movements',
        movementsEmpty: 'No movements',
      },
    });
  }
}

describe('CustomerWalletComponent', () => {
  it('renders a real zero balance instead of treating it as unavailable', () => {
    TestBed.configureTestingModule({
      imports: [CustomerWalletComponent],
      providers: [
        provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' } }),
        provideTranslocoLoader(Loader),
        {
          provide: WalletApiService,
          useValue: {
            balance: () =>
              of({ state: 'ready', response: { balance: { amount: 0, currency: 'MXN' } } }),
            movements: () =>
              of({
                state: 'empty',
                response: {
                  items: [],
                  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
                },
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CustomerWalletComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0.00 MXN');
    expect(fixture.nativeElement.textContent).not.toContain('Unavailable');
  });
});
