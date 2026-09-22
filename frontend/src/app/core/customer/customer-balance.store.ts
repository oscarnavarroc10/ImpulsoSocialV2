import { inject, Injectable, signal } from '@angular/core';
import { ResourceState, WalletBalance } from './customer.models';
import { WalletApiService } from './wallet-api.service';

@Injectable({ providedIn: 'root' })
export class CustomerBalanceStore {
  private readonly wallet = inject(WalletApiService);

  readonly state = signal<ResourceState>('loading');
  readonly balance = signal<WalletBalance | null>(null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.state.set('loading');
    this.wallet.balance().subscribe((result) => {
      this.state.set(result.state);
      this.balance.set(result.response);
    });
  }
}
