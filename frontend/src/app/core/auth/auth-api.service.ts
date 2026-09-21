import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { TenantConfigService } from '../config/tenant-config.service';
import {
  AuthResponse,
  LoginRequest,
  parseAuthResponse,
  parseRefreshResponse,
  RefreshResponse,
  RegisterRequest,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly tenant = inject(TenantConfigService);

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<unknown>(this.url('/auth/login'), request)
      .pipe(map((response) => parseAuthResponse(response)));
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<unknown>(this.url('/auth/register'), request)
      .pipe(map((response) => parseAuthResponse(response)));
  }

  refresh(refreshToken: string): Observable<RefreshResponse> {
    return this.http
      .post<unknown>(this.url('/v1/auth/refresh'), { refreshToken })
      .pipe(map((response) => parseRefreshResponse(response)));
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(this.url('/v1/auth/logout'), { refreshToken });
  }

  private url(path: string): string {
    const baseUrl = this.tenant.config()?.apiBaseUrl;
    if (!baseUrl) throw new Error('Tenant API is not configured');
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
}
