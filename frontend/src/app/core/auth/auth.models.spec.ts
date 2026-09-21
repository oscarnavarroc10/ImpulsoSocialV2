import { describe, expect, it } from 'vitest';
import {
  AuthOperationError,
  isSafeInternalReturnUrl,
  parseAuthResponse,
  parseRefreshResponse,
} from './auth.models';

const validResponse = {
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

describe('authentication response contracts', () => {
  it('accepts the exact backend login and registration contract', () => {
    expect(parseAuthResponse(validResponse)).toEqual(validResponse);
  });

  it('rejects malformed session and refresh responses', () => {
    expect(() => parseAuthResponse({ ...validResponse, accessToken: '' })).toThrow(
      AuthOperationError,
    );
    expect(() => parseRefreshResponse({ accessToken: 'next' })).toThrow(AuthOperationError);
  });

  it('accepts only internal return URLs', () => {
    expect(isSafeInternalReturnUrl('/cuenta?tab=profile')).toBe(true);
    expect(isSafeInternalReturnUrl('//attacker.example')).toBe(false);
    expect(isSafeInternalReturnUrl('https://attacker.example')).toBe(false);
    expect(isSafeInternalReturnUrl(null)).toBe(false);
  });
});
