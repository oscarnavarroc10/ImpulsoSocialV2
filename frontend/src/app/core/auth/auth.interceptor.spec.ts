import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  const refreshAccessToken = vi.fn(() => of('next-token'));
  const clearSession = vi.fn<() => void>();
  const navigate = vi.fn(() => Promise.resolve(true));
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: TenantConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: {
            accessToken: () => 'access-token',
            refreshAccessToken,
            clearSession,
          },
        },
        { provide: Router, useValue: { url: '/cuenta', navigate } },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('attaches bearer only to the configured API', () => {
    client.get('/api/private').subscribe();
    const api = http.expectOne('/api/private');
    expect(api.request.headers.get('Authorization')).toBe('Bearer access-token');
    api.flush({ ok: true });

    client.get('https://example.com/public').subscribe();
    const external = http.expectOne('https://example.com/public');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({ ok: true });
  });

  it('does not attach bearer to login, refresh or logout', () => {
    for (const path of ['/auth/login', '/v1/auth/refresh', '/v1/auth/logout']) {
      client.post(`/api${path}`, {}).subscribe();
      const request = http.expectOne(`/api${path}`);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('refreshes once and retries the protected request once', () => {
    client.get('/api/private').subscribe((value) => expect(value).toEqual({ ok: true }));
    const first = http.expectOne('/api/private');
    expect(first.request.headers.get('Authorization')).toBe('Bearer access-token');
    first.flush({}, { status: 401, statusText: 'Unauthorized' });

    const retry = http.expectOne('/api/private');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer next-token');
    retry.flush({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledOnce();
  });
});
