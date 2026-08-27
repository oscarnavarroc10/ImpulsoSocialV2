# Feature Specification: Authentication Session Lifecycle

**Feature Branch**: `feature/003-auth-session-lifecycle`

**Created**: 2026-08-27

**Status**: Approved

**Input**: Complete the existing authentication session lifecycle by implementing secure refresh-token rotation and idempotent logout. Reuse the existing JWT claims, SHA-256 refresh-token hashes, `SesionUsuario` records, and authentication module without adding persistence models or dependencies.

## Clarifications

### Session 2026-08-27

- Successful refresh rotates the session: the old `SesionUsuario` is revoked and a new session with a new `sid`, refresh-token hash, and expiration is created atomically.
- The access token and refresh token returned by a successful refresh both carry the new session ID.
- Only one of two concurrent attempts using the same refresh token may succeed.
- Reusing an old, revoked, expired, malformed, mismatched, or otherwise invalid refresh token returns the same HTTP 401 response and never returns new tokens.
- Current user and tenant state is authoritative. New claims use the user's current email, role, and tenant from persistence, not stale role or email claims from the submitted token.
- Logout revokes only the session identified by the submitted refresh-token hash. It does not revoke every user session.
- Logout is idempotent: a syntactically valid request returns HTTP 204 whether the matching session was active, already revoked, expired, missing, or the token was otherwise unknown.
- Refresh and logout accept the refresh token in the existing JSON body DTO. They do not require an access token or bearer header.
- The old unimplemented `/auth/refresh` and `/auth/logout` placeholders are removed. The implemented public contracts are URI-versioned as `/v1/auth/refresh` and `/v1/auth/logout`.

## User Scenarios & Testing

### User Story 1 - Continue an authenticated session (Priority: P1)

As an authenticated user whose access token is expiring, I can exchange my valid refresh token for a new access token and refresh token without entering my password again.

**Why this priority**: Short-lived access tokens are practical only when valid sessions can renew securely.

**Independent Test**: Login, submit the returned refresh token to `POST /v1/auth/refresh`, verify a new token pair is returned, verify the previous session is revoked, and verify only the new refresh token can rotate again.

**Acceptance Scenarios**:

1. **Given** a valid refresh JWT whose hash matches an active, unexpired session and whose claims match an active user in the configured active tenant, **When** refresh is requested, **Then** the old session is revoked, a new session is created atomically, and a new access/refresh token pair containing the new `sid` is returned.
2. **Given** a successful rotation, **When** the previous refresh token is submitted again, **Then** the API returns HTTP 401 and creates no session.
3. **Given** two concurrent refresh attempts with the same valid token, **When** both attempt rotation, **Then** exactly one may create a new session and the other returns HTTP 401.
4. **Given** a refresh token that is malformed, cryptographically invalid, expired, the wrong token type, absent from persistence, revoked, database-expired, or inconsistent with its session/user/tenant, **When** refresh is requested, **Then** the API returns the same generic HTTP 401 response without exposing the reason.
5. **Given** the current user is missing or inactive, or the configured tenant is inactive or does not match the user's tenant, **When** refresh is requested, **Then** no tokens are issued and the API returns HTTP 401.
6. **Given** a successful refresh, **When** the new JWT payloads are inspected in tests, **Then** they use the current persisted user identity, email, role, and tenant plus the new session ID.

---

### User Story 2 - Close one session (Priority: P1)

As an authenticated user, I can log out the current device so its refresh token can no longer renew the session.

**Why this priority**: Users require a reliable way to invalidate the long-lived credential stored on a device.

**Independent Test**: Login, submit the refresh token to `POST /v1/auth/logout`, receive HTTP 204, and verify subsequent refresh with that token returns HTTP 401.

**Acceptance Scenarios**:

1. **Given** an active session, **When** its refresh token is submitted to logout, **Then** that session receives `revocadaEn` and the endpoint returns HTTP 204 with no body.
2. **Given** the same token is submitted to logout again, **When** no active matching session remains, **Then** the endpoint still returns HTTP 204.
3. **Given** an unknown, expired, malformed, or already rotated refresh token in a syntactically valid body, **When** logout is requested, **Then** the endpoint returns HTTP 204 and exposes no session information.
4. **Given** multiple active sessions for one user, **When** one refresh token is logged out, **Then** other sessions remain active.
5. **Given** an empty, missing, or non-string `refreshToken`, **When** logout is requested, **Then** DTO validation returns HTTP 400.

## Edge Cases

- If token signing succeeds but atomic rotation fails, the generated tokens must never be returned.
- If creating the replacement session fails after selecting the old session, the transaction must roll back the old-session revocation.
- Logout racing with refresh must not allow refresh to succeed after logout has already revoked the old session.
- Refresh must compare JWT `sid` and `sub` with the persisted session and compare JWT `tiendaId` with the current user and configured tenant.
- Database expiration is checked even when JWT signature/expiration validation succeeds.
- No token, token hash, JWT payload, password hash, or secret may be written to logs or public errors.
- Session invalidity reasons must not be distinguishable through different refresh error messages.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose `POST /v1/auth/refresh` with `{ "refreshToken": "..." }` and MUST NOT require an access token.
- **FR-002**: A successful refresh MUST respond with HTTP 200 and exactly `{ "accessToken": string, "refreshToken": string }`.
- **FR-003**: Refresh MUST verify the submitted JWT with `JWT_REFRESH_SECRET`, expiration validation, and `tipo='refresh'` before rotating a session.
- **FR-004**: Refresh MUST hash the submitted token using the existing `RefreshTokenHasher`; raw refresh tokens MUST NOT be persisted.
- **FR-005**: Refresh MUST require a matching session whose `id` equals JWT `sid`, whose `usuarioId` equals JWT `sub`, whose hash matches the submitted token, whose `revocadaEn` is null, and whose `expiraEn` is in the future.
- **FR-006**: Refresh MUST require an existing active user and MUST require JWT, user, and configured active tenant identity to agree.
- **FR-007**: New token claims MUST use current persisted user data for `sub`, `email`, `rol`, and `tiendaId`, and a newly generated session ID for `sid`.
- **FR-008**: Refresh rotation MUST atomically mark the old session revoked and create the replacement session. If either write fails, neither state change may persist.
- **FR-009**: The atomic rotation write MUST conditionally match the old session ID, user ID, submitted refresh-token hash, null revocation timestamp, and future database expiration so only one concurrent attempt can succeed.
- **FR-010**: A failed conditional rotation MUST return HTTP 401 and MUST NOT create or return replacement tokens.
- **FR-011**: All refresh authentication failures MUST return the same generic HTTP 401 response without exposing whether the JWT, session, user, tenant, or expiration check failed.
- **FR-012**: The system MUST expose `POST /v1/auth/logout` with `{ "refreshToken": "..." }` and MUST NOT require an access token.
- **FR-013**: Logout MUST hash the submitted value and revoke only an active session with that hash using an idempotent persistence operation.
- **FR-014**: Every syntactically valid logout request MUST return HTTP 204 with no response body, regardless of whether a matching active session exists.
- **FR-015**: Logout MUST NOT revoke other sessions belonging to the same user.
- **FR-016**: The existing `RefreshTokenDto` MUST continue to reject missing, empty, or non-string values with HTTP 400.
- **FR-017**: Swagger MUST document the versioned refresh and logout routes, request DTO, exact refresh response, HTTP 400, HTTP 401 for refresh, and HTTP 204 for logout. Obsolete 501 documentation MUST be removed.
- **FR-018**: Existing register and login behavior and their unversioned paths MUST remain unchanged.
- **FR-019**: The implementation MUST use the existing schema and dependencies. No Prisma schema change, migration, package, guard, cookie, cache, queue, or external service may be added.

### API Contracts

#### Refresh

```http
POST /v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "eyJ..."
}
```

Success — HTTP 200:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

Invalid session — HTTP 401:

```json
{
  "statusCode": 401,
  "message": "Sesión inválida",
  "error": "Unauthorized"
}
```

#### Logout

```http
POST /v1/auth/logout
Content-Type: application/json
```

```json
{
  "refreshToken": "eyJ..."
}
```

Success or already invalid — HTTP 204 with no body.

## Success Criteria

- **SC-001**: Focused tests prove that one valid refresh revokes one old session and creates exactly one replacement session.
- **SC-002**: In a simulated concurrent/replayed rotation, one attempt succeeds and every later attempt with the old token returns HTTP 401.
- **SC-003**: All invalid refresh cases in the fixture set return the same HTTP status and public message and create zero sessions.
- **SC-004**: Logout is idempotent in 100% of active, revoked, expired, malformed, and unknown-token test cases and never affects another session.
- **SC-005**: Automated scans/assertions find zero raw tokens, hashes, password hashes, secrets, or internal session data in public responses.
- **SC-006**: Backend build, focused lint, focused tests, and the complete Jest suite pass without open handles.

## Assumptions

- Refresh tokens remain body-based for the current API; secure browser cookie storage is a separate frontend/security decision.
- SHA-256 is appropriate because refresh tokens are high-entropy signed values and only deterministic lookup is required.
- Each login, registration, or successful refresh represents one device session.
- Existing access-token consumers already validate `sid` against an active session.

## Out of Scope

- Password reset, email verification, MFA, device management, or logout-all.
- Access-token deny lists beyond existing session validation.
- Refresh-token families that revoke every user device after replay detection.
- Cookies, CSRF protection, frontend token storage, or frontend changes.
- Changes to registration, login, catalog, orders, wallets, deposits, or provider integration.
- Prisma migrations, new dependencies, rate limiting, monitoring platforms, or scheduled cleanup of expired sessions.
