import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { CatalogApiService } from './catalog-api.service';

describe('CatalogApiService', () => {
  let http: HttpTestingController;
  let service: CatalogApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CatalogApiService, provideHttpClient(), provideHttpClientTesting(),
        { provide: TenantConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } }],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CatalogApiService);
  });

  afterEach(() => http.verify());

  it('returns exact server quantity bounds and ready state', () => {
    service.list().subscribe((result) => {
      expect(result.state).toBe('ready');
      expect(result.response?.items[0].minQuantity).toBe(25);
      expect(result.response?.items[0].maxQuantity).toBe(750);
    });
    const request = http.expectOne('/api/v1/catalog/services');
    request.flush({
      items: [{ id: 'service-1', minQuantity: 25, maxQuantity: 750 }],
      facets: { platforms: [], categories: [] },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('maps transport failures to unavailable', () => {
    service.list().subscribe((result) => expect(result.state).toBe('unavailable'));
    http.expectOne('/api/v1/catalog/services').flush('error', { status: 503, statusText: 'Unavailable' });
  });

  it('sends backend-supported search and pagination parameters', () => {
    service.list({ page: 2, limit: 12, socialNetwork: 'Instagram', categoryId: 'cat-1' }).subscribe();
    const request = http.expectOne(
      '/api/v1/catalog/services?page=2&limit=12&socialNetwork=Instagram&categoryId=cat-1',
    );
    request.flush({
      items: [],
      facets: { platforms: [], categories: [] },
      pagination: { page: 2, limit: 12, total: 0, totalPages: 0 },
    });
  });
});
