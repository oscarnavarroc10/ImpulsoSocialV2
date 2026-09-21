import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiService } from './auth-api.service';
import { AuthResponse, RefreshResponse, SessionState } from './auth.models';
import { AuthService } from './auth.service';
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

describe('AuthService', () => {
  const login = vi.fn(() => of(session satisfies AuthResponse));
  const register = vi.fn(() => of(session satisfies AuthResponse));
  const refresh = vi.fn(() => of({ accessToken: 'next-access', refreshToken: 'next-refresh' }));
  const logout = vi.fn(() => of(undefined));
  const read = vi.fn<() => SessionState | null>(() => null);
  const write = vi.fn<(value: SessionState) => void>();
  const clear = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    read.mockReturnValue(null);
    login.mockReturnValue(of(session));
    register.mockReturnValue(of(session));
    refresh.mockReturnValue(of({ accessToken: 'next-access', refreshToken: 'next-refresh' }));
    logout.mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: AuthApiService, useValue: { login, register, refresh, logout } },
        { provide: SessionStorageService, useValue: { read, write, clear } },
      ],
    });
  });

  it('restores and exposes an existing session', () => {
    read.mockReturnValue(session);
    const service = TestBed.inject(AuthService);
    service.restore();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('oscar@example.com');
  });

  it('persists a successful email and password login', async () => {
    const service = TestBed.inject(AuthService);
    await service.login({ email: 'oscar@example.com', password: 'password-1' });
    expect(login).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(session);
    expect(service.accessToken()).toBe('access-token');
  });

  it('coalesces concurrent refreshes and rotates both tokens', async () => {
    read.mockReturnValue(session);
    const response = new Subject<RefreshResponse>();
    refresh.mockReturnValue(response.asObservable());
    const service = TestBed.inject(AuthService);
    service.restore();

    const first = firstValueFrom(service.refreshAccessToken());
    const second = firstValueFrom(service.refreshAccessToken());
    const third = firstValueFrom(service.refreshAccessToken());
    response.next({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    response.complete();

    await expect(first).resolves.toBe('next-access');
    await expect(second).resolves.toBe('next-access');
    await expect(third).resolves.toBe('next-access');
    expect(refresh).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith({
      ...session,
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
  });

  it('always clears local credentials when remote logout fails', async () => {
    read.mockReturnValue(session);
    logout.mockReturnValue(throwError(() => new Error('offline')));
    const service = TestBed.inject(AuthService);
    service.restore();
    await expect(service.logout()).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
    expect(service.isAuthenticated()).toBe(false);
  });
});
