import { inject, Injectable } from '@angular/core';
import { TenantConfigService } from '../config/tenant-config.service';
import { parseAuthResponse, SessionState } from './auth.models';

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  private readonly tenant = inject(TenantConfigService);
  private remembered = false;

  read(): SessionState | null {
    const persistent = this.readFrom(localStorage);
    if (persistent) {
      this.remembered = true;
      return persistent;
    }
    this.remembered = false;
    return this.readFrom(sessionStorage);
  }

  isRemembered(): boolean {
    return this.remembered;
  }

  write(session: SessionState, rememberMe = false): void {
    this.remembered = rememberMe;
    const activeStorage = rememberMe ? localStorage : sessionStorage;
    const inactiveStorage = rememberMe ? sessionStorage : localStorage;
    const key = this.key();
    if (!key) return;
    try {
      activeStorage.setItem(key, JSON.stringify(session));
      inactiveStorage.removeItem(key);
    } catch {
      // The current in-memory session remains usable when storage is unavailable.
    }
  }

  clear(): void {
    this.remembered = false;
    const key = this.key();
    if (!key) return;
    this.removeFrom(sessionStorage, key);
    this.removeFrom(localStorage, key);
  }

  private key(): string | null {
    const slug = this.tenant.config()?.tenantSlug;
    return slug ? `impulsosocial:${slug}:session:v1` : null;
  }

  private readFrom(storage: Storage): SessionState | null {
    const key = this.key();
    if (!key) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      return parseAuthResponse(JSON.parse(raw) as unknown);
    } catch {
      this.removeFrom(storage, key);
      return null;
    }
  }

  private removeFrom(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch {
      // Clearing unavailable browser storage is intentionally idempotent.
    }
  }
}
