import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const createUrlTree = vi.fn((commands: unknown[], extras: { queryParams: unknown }) => ({
    commands,
    extras,
  }));
  const auth = { isAuthenticated: vi.fn(() => false) };

  beforeEach(() => {
    auth.isAuthenticated.mockReturnValue(false);
    createUrlTree.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('preserves the requested customer URL for unauthenticated users', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(
        {} as ActivatedRouteSnapshot,
        { url: '/cuenta/ordenes' } as RouterStateSnapshot,
      ),
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/cuenta/ordenes' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      extras: { queryParams: { returnUrl: '/cuenta/ordenes' } },
    });
  });

  it('allows an authenticated customer through', () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, { url: '/cuenta' } as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
});