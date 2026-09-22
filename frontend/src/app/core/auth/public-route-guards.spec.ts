import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { guestGuard } from './guest.guard';
import { publicHomeGuard } from './public-home.guard';

describe('public route guards', () => {
  const createUrlTree = vi.fn((commands: unknown[]) => ({ commands }));
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

  it('leaves public home and guest routes available without a session', () => {
    expect(TestBed.runInInjectionContext(() => publicHomeGuard({} as never, {} as never))).toBe(
      true,
    );
    expect(TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never))).toBe(true);
  });

  it('redirects authenticated users from public home and guest routes', () => {
    auth.isAuthenticated.mockReturnValue(true);
    expect(TestBed.runInInjectionContext(() => publicHomeGuard({} as never, {} as never))).toEqual({
      commands: ['/cuenta/nueva-orden'],
    });
    expect(TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never))).toEqual({
      commands: ['/cuenta/nueva-orden'],
    });
  });
});
