import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TenantConfigService } from '../config/tenant-config.service';
import { SessionState } from './auth.models';
import { SessionStorageService } from './session-storage.service';

const session: SessionState = {
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

describe('SessionStorageService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SessionStorageService,
        {
          provide: TenantConfigService,
          useValue: { config: () => ({ tenantSlug: 'test-tenant' }) },
        },
      ],
    });
    sessionStorage.clear();
  });

  afterEach(() => sessionStorage.clear());

  it('persists, restores and clears a tenant-scoped session', () => {
    const service = TestBed.inject(SessionStorageService);
    service.write(session);
    expect(service.read()).toEqual(session);
    expect(sessionStorage.getItem('impulsosocial:test-tenant:session:v1')).not.toBeNull();
    service.clear();
    expect(service.read()).toBeNull();
  });

  it('fails closed and removes malformed stored credentials', () => {
    sessionStorage.setItem('impulsosocial:test-tenant:session:v1', '{"accessToken":true}');
    expect(TestBed.inject(SessionStorageService).read()).toBeNull();
    expect(sessionStorage.getItem('impulsosocial:test-tenant:session:v1')).toBeNull();
  });
});
