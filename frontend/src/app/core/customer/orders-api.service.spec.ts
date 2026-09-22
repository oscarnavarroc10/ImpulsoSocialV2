import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { OrdersApiService } from './orders-api.service';

describe('OrdersApiService', () => {
  let http: HttpTestingController;
  let service: OrdersApiService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [OrdersApiService, provideHttpClient(), provideHttpClientTesting(), { provide: TenantConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } }],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(OrdersApiService);
  });
  afterEach(() => http.verify());

  it('lists scoped orders with pagination', () => {
    service.list({ page: 2, limit: 10 }).subscribe((result) => expect(result.state).toBe('ready'));
    const request = http.expectOne('/api/v1/orders?page=2&limit=10');
    request.flush({ items: [{ id: 'order-1' }], pagination: { page: 2, limit: 10, total: 1, totalPages: 1 } });
  });

  it('sends service, target, quantity and idempotency key', () => {
    service.create({ serviceId: 'service-1', target: 'https://example.test', quantity: 500 }, 'key-12345678').subscribe((result) => {
      expect(result.state).toBe('ready');
      expect(result.statusCode).toBe(201);
    });
    const request = http.expectOne('/api/v1/orders');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    expect(request.request.body).toEqual({ serviceId: 'service-1', target: 'https://example.test', quantity: 500 });
    request.flush({ id: 'order-1', serviceId: 'service-1', target: 'https://example.test', quantity: 500, totalPrice: { amount: 100, currency: 'MXN' }, status: 'enviando', createdAt: new Date().toISOString() }, { status: 201, statusText: 'Created' });
  });

  it('preserves 202 as pending and maps business failures', () => {
    service.create({ serviceId: 'service-1', target: 'https://example.test', quantity: 500 }, 'key-12345678').subscribe((result) => expect(result.state).toBe('pending'));
    const request = http.expectOne('/api/v1/orders');
    request.flush({ id: 'order-1', serviceId: 'service-1', target: 'https://example.test', quantity: 500, totalPrice: { amount: 100, currency: 'MXN' }, status: 'enviando', createdAt: new Date().toISOString() }, { status: 202, statusText: 'Accepted' });
  });
});
