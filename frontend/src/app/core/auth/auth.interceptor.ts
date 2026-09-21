import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { TenantConfigService } from '../config/tenant-config.service';
import { AuthService } from './auth.service';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);
const excludedPaths = ['/auth/login', '/auth/register', '/v1/auth/refresh', '/v1/auth/logout'];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const tenant = inject(TenantConfigService);
  const auth = inject(AuthService);
  const router = inject(Router);
  const baseUrl = tenant.config()?.apiBaseUrl;

  if (!baseUrl || !isApiRequest(request.url, baseUrl) || isExcluded(request.url, baseUrl)) {
    return next(request);
  }

  const accessToken = auth.accessToken();
  const authenticatedRequest = accessToken
    ? request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !accessToken ||
        request.context.get(AUTH_RETRY)
      ) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        catchError((refreshError: unknown) => {
          auth.clearSession();
          const returnUrl =
            router.url.startsWith('/') && !router.url.startsWith('//') ? router.url : '/cuenta';
          void router.navigate(['/login'], { queryParams: { returnUrl } });
          return throwError(() => refreshError);
        }),
        switchMap((token) =>
          next(
            request.clone({
              context: request.context.set(AUTH_RETRY, true),
              setHeaders: { Authorization: `Bearer ${token}` },
            }),
          ),
        ),
      );
    }),
  );
};

function isApiRequest(url: string, baseUrl: string): boolean {
  if (baseUrl.startsWith('/')) return url === baseUrl || url.startsWith(`${baseUrl}/`);
  try {
    const requestUrl = new URL(url);
    const apiUrl = new URL(baseUrl);
    return requestUrl.origin === apiUrl.origin && requestUrl.pathname.startsWith(apiUrl.pathname);
  } catch {
    return false;
  }
}

function isExcluded(url: string, baseUrl: string): boolean {
  const path =
    baseUrl.startsWith('/') && url.startsWith(baseUrl)
      ? url.slice(baseUrl.length)
      : safePathname(url);
  return excludedPaths.some((excluded) => path === excluded || path.startsWith(`${excluded}?`));
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
