import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { TenantConfigService } from '../config/tenant-config.service';
import {
  CustomerError,
  CustomerOrder,
  CustomerOrderResponse,
  OrderRequestResult,
  ResourceState,
} from './customer.models';

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantConfigService);

  list(options: { page?: number; limit?: number; status?: string } = {}): Observable<{ state: ResourceState; response: CustomerOrderResponse | null; error?: CustomerError }> {
    const url = this.url('/v1/orders', options);
    if (!url) return of({ state: 'unavailable', response: null, error: { code: 'network' } });
    return this.http.get<unknown>(url).pipe(
      map((value) => {
        if (!isOrderList(value)) return { state: 'unavailable' as const, response: null, error: { code: 'unknown' as const } };
        return { state: value.items.length ? ('ready' as const) : ('empty' as const), response: value };
      }),
      catchError((error: unknown) => of({ state: 'unavailable' as const, response: null, error: normalizeError(error) })),
    );
  }

  getById(id: string): Observable<CustomerOrder | null> {
    const url = this.url(`/v1/orders/${encodeURIComponent(id)}`);
    if (!url) return of(null);
    return this.http.get<CustomerOrder>(url).pipe(catchError(() => of(null)));
  }

  create(input: { serviceId: string; target: string; quantity: number }, idempotencyKey: string = crypto.randomUUID()): Observable<OrderRequestResult> {
    const url = this.url('/v1/orders');
    if (!url) return of({ state: 'unavailable', order: null, statusCode: null, error: { code: 'network' } });
    return this.http.post<CustomerOrder>(url, input, {
      observe: 'response',
      headers: { 'Idempotency-Key': idempotencyKey },
    }).pipe(
      map((response) => response.status === 202
        ? { state: 'pending' as const, order: response.body as CustomerOrder, statusCode: 202 as const }
        : { state: 'ready' as const, order: response.body as CustomerOrder, statusCode: response.status as 200 | 201 }),
      catchError((error: unknown) => {
        const statusCode = error instanceof HttpErrorResponse ? error.status : null;
        return of({ state: 'unavailable' as const, order: null, statusCode, error: normalizeError(error) });
      }),
    );
  }

  private url(path: string, options: Record<string, string | number | undefined> = {}): string | null {
    const baseUrl = this.tenant.config()?.apiBaseUrl;
    if (!baseUrl) return null;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options)) if (value !== undefined) params.set(key, String(value));
    const query = params.toString();
    return `${baseUrl}${path}${query ? `?${query}` : ''}`;
  }
}

function isOrderList(value: unknown): value is CustomerOrderResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const pagination = record['pagination'];
  return Array.isArray(record['items']) && !!pagination && typeof pagination === 'object';
}

function normalizeError(error: unknown): CustomerError {
  if (!(error instanceof HttpErrorResponse)) return { code: 'unknown' };
  if (error.status === 0) return { code: 'network' };
  if (error.status === 401) return { code: 'unauthorized' };
  if (error.status === 404) return { code: 'notFound' };
  if (error.status === 409) return { code: 'conflict' };
  if (error.status === 422 || error.status === 400) return { code: 'validation' };
  if (error.status >= 500) return { code: 'server' };
  return { code: 'unknown' };
}