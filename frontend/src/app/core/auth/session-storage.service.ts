import { inject, Injectable } from '@angular/core';
import { TenantConfigService } from '../config/tenant-config.service';
import { parseAuthResponse, SessionState } from './auth.models';

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  private readonly tenant = inject(TenantConfigService);

  read(): SessionState | null {
    const key = this.key();
    if (!key) return null;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return parseAuthResponse(JSON.parse(raw) as unknown);
    } catch {
      this.clear();
      return null;
    }
  }

  write(session: SessionState): void {
    const key = this.key();
    if (!key) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(session));
    } catch {
      // The current in-memory session remains usable when storage is unavailable.
    }
  }

  clear(): void {
    const key = this.key();
    if (!key) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Clearing an unavailable browser storage is intentionally idempotent.
    }
  }

  private key(): string | null {
    const slug = this.tenant.config()?.tenantSlug;
    return slug ? `impulsosocial:${slug}:session:v1` : null;
  }
}
