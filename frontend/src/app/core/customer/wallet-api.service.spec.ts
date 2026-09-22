import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { WalletApiService } from './wallet-api.service';

describe('WalletApiService', () => {
  let http: HttpTestingController;
  let service: WalletApiService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WalletApiService, provideHttpClient(), provideHttpClientTesting(), { provide: TenantConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } }],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(WalletApiService);
  });
  afterEach(() => http.verify());

  it('keeps a real zero balance distinct from unavailable', () => {
    service.balance().subscribe((result) => {
      expect(result.state).toBe('ready');
      expect(result.response?.balance.amount).toBe(0);
    });
    http.expectOne('/api/v1/wallet').flush({ balance: { amount: 0, currency: 'MXN' } });
  });

  it('loads wallet movements with server money values', () => {
    service.movements().subscribe((result) => {
      expect(result.state).toBe('ready');
      expect(result.response?.items[0].amount).toEqual({ amount: 1500, currency: 'MXN' });
    });
    http.expectOne('/api/v1/wallet/movements?page=1&limit=20').flush({ items: [{ id: 'movement-1', type: 'compra', amount: { amount: 1500, currency: 'MXN' }, balanceAfter: { amount: 0, currency: 'MXN' }, description: null, createdAt: new Date().toISOString() }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  });

  it('maps missing wallet to unavailable', () => {
    service.balance().subscribe((result) => expect(result.state).toBe('unavailable'));
    http.expectOne('/api/v1/wallet').flush({}, { status: 404, statusText: 'Not Found' });
  });
});
