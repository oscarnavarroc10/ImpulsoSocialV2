import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthOperationError, LoginRequest, RegisterRequest, SessionState } from './auth.models';
import { SessionStorageService } from './session-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionSignal = signal<SessionState | null>(null);
  private readonly busySignal = signal(false);
  private rememberMe = false;
  private refreshRequest: Observable<string> | null = null;

  readonly user = computed(() => this.sessionSignal()?.usuario ?? null);
  readonly accessToken = computed(() => this.sessionSignal()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);
  readonly isBusy = this.busySignal.asReadonly();

  restore(): void {
    this.sessionSignal.set(this.storage.read());
    this.rememberMe = this.storage.isRemembered?.() ?? false;
  }

  login(request: LoginRequest, rememberMe = false): Promise<void> {
    this.rememberMe = rememberMe;
    return this.run(() => firstValueFrom(this.api.login(request)));
  }

  register(request: RegisterRequest): Promise<void> {
    return this.run(() => firstValueFrom(this.api.register(request)));
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest) return this.refreshRequest;

    this.refreshRequest = defer(() => {
      const current = this.sessionSignal();
      if (!current) return throwError(() => new AuthOperationError('unauthorized'));
      return this.api.refresh(current.refreshToken).pipe(
        tap((response) => {
          const next: SessionState = { ...current, ...response };
          this.sessionSignal.set(next);
          this.persist(next);
        }),
        map((response) => response.accessToken),
      );
    }).pipe(
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => this.normalizeError(error));
      }),
      finalize(() => {
        this.refreshRequest = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshRequest;
  }

  async logout(): Promise<void> {
    const refreshToken = this.sessionSignal()?.refreshToken;
    try {
      if (refreshToken) await firstValueFrom(this.api.logout(refreshToken));
    } catch {
      // Remote revocation is best-effort; local credentials are always removed.
    } finally {
      this.clearSession();
    }
  }

  clearSession(): void {
    this.sessionSignal.set(null);
    this.rememberMe = false;
    this.storage.clear();
  }

  private async run(operation: () => Promise<SessionState>): Promise<void> {
    if (this.busySignal()) throw new AuthOperationError('busy');
    this.busySignal.set(true);
    try {
      const session = await operation();
      this.sessionSignal.set(session);
      this.persist(session);
    } catch (error) {
      throw this.normalizeError(error);
    } finally {
      this.busySignal.set(false);
    }
  }

  private normalizeError(error: unknown): AuthOperationError {
    if (error instanceof AuthOperationError) return error;
    if (!(error instanceof HttpErrorResponse)) return new AuthOperationError('unknown');
    if (error.status === 0) return new AuthOperationError('network');
    if (error.status === 400) return new AuthOperationError('validation');
    if (error.status === 401) return new AuthOperationError('unauthorized');
    if (error.status === 409) return new AuthOperationError('conflict');
    if (error.status >= 500) return new AuthOperationError('server');
    return new AuthOperationError('unknown');
  }

  private persist(session: SessionState): void {
    if (this.rememberMe) this.storage.write(session, true);
    else this.storage.write(session);
  }
}
