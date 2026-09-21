import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TenantUiConfig } from './tenant-config.model';
import { validateTenantConfig } from './tenant-config.validator';

export type TenantConfigState = 'loading' | 'ready' | 'configurationError';

@Injectable({ providedIn: 'root' })
export class TenantConfigService {
  private readonly http = inject(HttpClient);
  private readonly configSignal = signal<TenantUiConfig | null>(null);
  private readonly stateSignal = signal<TenantConfigState>('loading');
  readonly config = this.configSignal.asReadonly();
  readonly state = this.stateSignal.asReadonly();
  readonly failed = () => this.state() === 'configurationError';
  async load(): Promise<void> {
    this.stateSignal.set('loading');
    this.configSignal.set(null);
    try {
      const validated = validateTenantConfig(await firstValueFrom(this.http.get<unknown>('/config/tenant-config.json')));
      this.configSignal.set(validated);
      this.stateSignal.set('ready');
    } catch {
      this.stateSignal.set('configurationError');
    }
  }
  retry(): Promise<void> { return this.load(); }
}
