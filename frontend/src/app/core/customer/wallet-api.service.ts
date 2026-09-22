import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { TenantConfigService } from '../config/tenant-config.service';
import { CustomerError, ResourceState, WalletBalance, WalletMovementResponse } from './customer.models';

@Injectable({ providedIn: 'root' })
export class WalletApiService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantConfigService);

  balance(): Observable<{ state: ResourceState; response: WalletBalance | null; error?: CustomerError }> {
    const url = this.url('/v1/wallet');
    if (!url) return of({ state: 'unavailable', response: null, error: { code: 'network' } });
    return this.http.get<WalletBalance>(url).pipe(
      map((response) => ({ state: 'ready' as const, response })),
      catchError((error: unknown) => of({ state: 'unavailable' as const, response: null, error: normalizeError(error) })),
    );
  }

  movements(page = 1, limit = 20): Observable<{ state: ResourceState; response: WalletMovementResponse | null; error?: CustomerError }> {
    const url = this.url('/v1/wallet/movements', { page, limit });
    if (!url) return of({ state: 'unavailable', response: null, error: { code: 'network' } });
    return this.http.get<unknown>(url).pipe(
      map((value) => {
        if (!isMovementList(value)) return { state: 'unavailable' as const, response: null, error: { code: 'unknown' as const } };
        return { state: value.items.length ? ('ready' as const) : ('empty' as const), response: value };
      }),
      catchError((error: unknown) => of({ state: 'unavailable' as const, response: null, error: normalizeError(error) })),
    );
  }

  private url(path: string, options: Record<string, string | number> = {}): string | null {
    const baseUrl = this.tenant.config()?.apiBaseUrl;
    if (!baseUrl) return null;
    const params = new URLSearchParams(Object.entries(options).map(([key, value]) => [key, String(value)]));
    const query = params.toString();
    return `${baseUrl}${path}${query ? `?${query}` : ''}`;
  }
}

function isMovementList(value: unknown): value is WalletMovementResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record['items']) && !!record['pagination'] && typeof record['pagination'] === 'object';
}

function normalizeError(error: unknown): CustomerError {
  if (!(error instanceof HttpErrorResponse)) return { code: 'unknown' };
  if (error.status === 0) return { code: 'network' };
  if (error.status === 401) return { code: 'unauthorized' };
  if (error.status === 404) return { code: 'notFound' };
  if (error.status === 409) return { code: 'conflict' };
  if (error.status === 400 || error.status === 422) return { code: 'validation' };
  if (error.status >= 500) return { code: 'server' };
  return { code: 'unknown' };
}