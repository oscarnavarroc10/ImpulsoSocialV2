import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { TenantConfigService } from '../config/tenant-config.service';
import { CatalogResponse, CatalogService, ResourceState } from './customer.models';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantConfigService);

  list(
    options: { page?: number; limit?: number; socialNetwork?: string; categoryId?: string } = {},
  ): Observable<{ state: ResourceState; response: CatalogResponse | null }> {
    const baseUrl = this.tenant.config()?.apiBaseUrl;
    if (!baseUrl) return of({ state: 'unavailable', response: null });

    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.socialNetwork) params.set('socialNetwork', options.socialNetwork);
    if (options.categoryId) params.set('categoryId', options.categoryId);
    const query = params.toString();
    return this.http.get<unknown>(`${baseUrl}/v1/catalog/services${query ? `?${query}` : ''}`).pipe(
      map((value) => {
        if (!isCatalogResponse(value)) return { state: 'unavailable' as const, response: null };
        return {
          state: value.items.length ? ('ready' as const) : ('empty' as const),
          response: value,
        };
      }),
      catchError(() => of({ state: 'unavailable' as const, response: null })),
    );
  }

  listAll(options: {
    socialNetwork: string;
    categoryId: string;
  }): Observable<{ state: ResourceState; response: CatalogResponse | null }> {
    return this.list({ ...options, page: 1, limit: 100 }).pipe(
      switchMap((first) => {
        if (!first.response || first.response.pagination.totalPages <= 1) return of(first);
        const remainingPages = Array.from(
          { length: first.response.pagination.totalPages - 1 },
          (_, index) => index + 2,
        );
        return forkJoin(
          remainingPages.map((page) => this.list({ ...options, page, limit: 100 })),
        ).pipe(
          map((pages) => {
            const responses = pages.map((page) => page.response);
            if (
              pages.some((page) => page.state === 'unavailable') ||
              responses.some((response) => !response)
            ) {
              return { state: 'unavailable' as const, response: null };
            }
            const items = [
              first.response!.items,
              ...responses.map((response) => response!.items),
            ].flat();
            return {
              state: items.length ? ('ready' as const) : ('empty' as const),
              response: {
                ...first.response!,
                items,
                pagination: {
                  ...first.response!.pagination,
                  page: 1,
                  limit: items.length,
                  total: items.length,
                  totalPages: 1,
                },
              },
            };
          }),
        );
      }),
    );
  }

  getById(id: string): Observable<CatalogService | null> {
    const baseUrl = this.tenant.config()?.apiBaseUrl;
    if (!baseUrl) return of(null);
    return this.http
      .get<CatalogService>(`${baseUrl}/v1/catalog/services/${encodeURIComponent(id)}`)
      .pipe(catchError(() => of(null)));
  }
}

function isCatalogResponse(value: unknown): value is CatalogResponse {
  if (
    !value ||
    typeof value !== 'object' ||
    !Array.isArray((value as Record<string, unknown>)['items'])
  ) {
    return false;
  }
  const pagination = (value as Record<string, unknown>)['pagination'];
  const facets = (value as Record<string, unknown>)['facets'];
  return !!pagination && typeof pagination === 'object' && !!facets && typeof facets === 'object';
}
