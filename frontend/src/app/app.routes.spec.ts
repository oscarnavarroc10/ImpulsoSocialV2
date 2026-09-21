import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('public routes', () => {
  const publicShell = routes.find((route) => route.path === '');
  const children = publicShell?.children ?? [];

  it('defines the home route as an exact match', () => {
    expect(children.find((route) => route.path === '')?.pathMatch).toBe('full');
  });

  it('defines every public informational route explicitly', () => {
    expect(children.map((route) => route.path)).toEqual(
      expect.arrayContaining(['', 'services', 'about', 'faq']),
    );
  });

  it('defines canonical authentication and account routes explicitly', () => {
    expect(routes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['login', 'registro', 'cuenta']),
    );
    expect(routes.find((route) => route.path === 'cuenta')?.canActivate?.length).toBe(1);
  });

  it('keeps legacy auth links as redirects', () => {
    expect(routes.find((route) => route.path === 'auth/login')?.redirectTo).toBe('login');
    expect(routes.find((route) => route.path === 'auth/register')?.redirectTo).toBe('registro');
  });

  it('keeps the wildcard as the final child route', () => {
    expect(children.at(-1)?.path).toBe('**');
  });

  it('does not reuse the not-found component for planned routes', () => {
    const planned = [
      ...children.filter((route) => route.path === 'services'),
      ...routes.filter((route) => ['login', 'registro', 'cuenta'].includes(route.path ?? '')),
    ];
    expect(planned.every((route) => !String(route.loadComponent).includes('not-found'))).toBe(true);
  });
});
