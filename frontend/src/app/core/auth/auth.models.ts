export interface AuthenticatedUser {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  tiendaId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  nombre: string;
}

export interface AuthResponse {
  usuario: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export type SessionState = AuthResponse;
export type AuthFailureCode =
  'validation' | 'unauthorized' | 'conflict' | 'network' | 'server' | 'unknown' | 'busy';

export class AuthOperationError extends Error {
  constructor(readonly code: AuthFailureCode) {
    super(code);
    this.name = 'AuthOperationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) throw new AuthOperationError('unknown');
  return value;
}

export function parseAuthenticatedUser(value: unknown): AuthenticatedUser {
  if (!isRecord(value)) throw new AuthOperationError('unknown');
  return {
    id: readString(value, 'id'),
    nombre: readString(value, 'nombre'),
    email: readString(value, 'email'),
    rol: readString(value, 'rol'),
    tiendaId: readString(value, 'tiendaId'),
  };
}

export function parseAuthResponse(value: unknown): AuthResponse {
  if (!isRecord(value)) throw new AuthOperationError('unknown');
  return {
    usuario: parseAuthenticatedUser(value['usuario']),
    accessToken: readString(value, 'accessToken'),
    refreshToken: readString(value, 'refreshToken'),
  };
}

export function parseRefreshResponse(value: unknown): RefreshResponse {
  if (!isRecord(value)) throw new AuthOperationError('unknown');
  return {
    accessToken: readString(value, 'accessToken'),
    refreshToken: readString(value, 'refreshToken'),
  };
}

export function isSafeInternalReturnUrl(value: string | null): value is string {
  return value !== null && value.startsWith('/') && !value.startsWith('//');
}
