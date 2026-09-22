import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CustomerBalanceStore } from '../../core/customer/customer-balance.store';
import { ResourceState, WalletMovement } from '../../core/customer/customer.models';
import { WalletApiService } from '../../core/customer/wallet-api.service';

@Component({
  selector: 'app-customer-wallet',
  imports: [DatePipe, DecimalPipe, TranslocoPipe],
  template: `
    <section class="account-page-heading customer-wallet-heading">
      <div>
        <span class="eyebrow">{{ 'account.walletEyebrow' | transloco }}</span>
        <h1>{{ 'account.wallet' | transloco }}</h1>
        <p>{{ 'account.walletIntro' | transloco }}</p>
      </div>
    </section>
    @if (balanceStore.state() === 'loading') {
      <div class="account-resource-message" role="status">
        {{ 'account.walletLoading' | transloco }}
      </div>
    } @else if (balanceStore.state() === 'unavailable') {
      <div class="account-resource-message" role="alert">
        <span>{{ 'account.walletUnavailable' | transloco }}</span
        ><button class="button button-small" type="button" (click)="load()">
          {{ 'account.retry' | transloco }}
        </button>
      </div>
    } @else {
      <section class="account-card customer-balance-card">
        <span class="eyebrow">{{ 'account.currentBalance' | transloco }}</span
        ><strong
          >{{
            balanceStore.balance()?.balance?.amount === 0
              ? '0.00'
              : ((balanceStore.balance()?.balance?.amount ?? 0) / 100 | number: '1.2-2')
          }}
          {{ balanceStore.balance()?.balance?.currency }}</strong
        >
      </section>
      <section class="customer-movements">
        <h2>{{ 'account.movementsTitle' | transloco }}</h2>
        @if (movementState() === 'loading') {
          <p>{{ 'account.walletLoading' | transloco }}</p>
        } @else if (movementState() === 'empty') {
          <p>{{ 'account.movementsEmpty' | transloco }}</p>
        } @else if (movementState() === 'unavailable') {
          <p>{{ 'account.walletUnavailable' | transloco }}</p>
        } @else {
          <div class="customer-movement-list">
            @for (movement of movements(); track movement.id) {
              <article class="account-card customer-movement">
                <div>
                  <strong>{{ movement.type }}</strong
                  ><small>{{ movement.createdAt | date: 'mediumDate' }}</small>
                </div>
                <strong
                  >{{ movement.amount.amount / 100 | number: '1.2-2' }}
                  {{ movement.amount.currency }}</strong
                >
                <p>{{ movement.description }}</p>
              </article>
            }
          </div>
        }
      </section>
    }
  `,
})
export class CustomerWalletComponent {
  private readonly api = inject(WalletApiService);
  protected readonly balanceStore = inject(CustomerBalanceStore);
  protected readonly movementState = signal<ResourceState>('loading');
  protected readonly movements = signal<WalletMovement[]>([]);
  constructor() {
    this.load();
  }
  protected load(): void {
    this.balanceStore.reload();
    this.movementState.set('loading');
    this.api.movements().subscribe((result) => {
      this.movementState.set(result.state);
      this.movements.set(result.response?.items ?? []);
    });
  }
}
