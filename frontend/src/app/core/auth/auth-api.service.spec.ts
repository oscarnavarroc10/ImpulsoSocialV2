import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { AuthApiService } from './auth-api.service';

const response = {
  usuario: {
    id: 'user-1',
    nombre: 'Oscar Navarro',
    email: 'oscar@example.com',
    rol: 'cliente',
    tiendaId: 'tenant-1',
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('AuthApiService contracts', () => {
  let http: HttpTestingController;
  let service: AuthApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthApiService);
  });

  afterEach(() => http.verify());

  it('uses the exact login contract', () => {
    service.login({ email: 'oscar@example.com', password: 'password-1' }).subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'oscar@example.com',
      password: 'password-1',
    });
    request.flush(response);
  });

  it('uses the exact registration contract', () => {
    service
      .register({ nombre: 'Oscar Navarro', email: 'oscar@example.com', password: 'password-1' })
      .subscribe();
    const request = http.expectOne('/api/auth/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      nombre: 'Oscar Navarro',
      email: 'oscar@example.com',
      password: 'password-1',
    });
    request.flush(response);
  });

  it('rotates tokens through the versioned refresh endpoint', () => {
    service.refresh('refresh-token').subscribe();
    const request = http.expectOne('/api/v1/auth/refresh');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-token' });
    request.flush({ accessToken: 'next-access', refreshToken: 'next-refresh' });
  });

  it('revokes through the versioned logout endpoint', () => {
    service.logout('refresh-token').subscribe();
    const request = http.expectOne('/api/v1/auth/logout');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-token' });
    request.flush(null);
  });
});
