# Session Persistence Decision

## Current verified behavior

- `SessionStorageService` stores the authenticated session in browser `sessionStorage`.
- The key is tenant-namespaced as `impulsosocial:{tenantSlug}:session:v1`.
- `AuthService` restores the session after tenant configuration loads.
- Access-token refresh rotates both tokens and rewrites the same storage entry.
- Logout attempts remote revocation and always clears local credentials.
- Invalid or unavailable storage fails closed for restore and keeps an active in-memory session usable for the current page.

## Security gate

The optional persistent-login choice must not automatically move credentials to `localStorage` or create a second token-storage path. Before implementing persistence-specific behavior, verify token exposure, tenant isolation, refresh rotation, logout clearing, refresh failure, browser restart semantics, and storage availability.

If a safe strategy cannot be implemented through the existing authentication boundary without a separately approved auth change, preserve the current `sessionStorage` behavior, test that behavior as a regression, and record the requirement as blocked.

## Scope for T001-T016

The customer-area shell does not change session persistence. This decision document is a gate for the later US5 tasks only.