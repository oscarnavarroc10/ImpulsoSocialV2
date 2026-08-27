# Tasks: Authentication Session Lifecycle

**Input**: `specs/003-auth-session-lifecycle/spec.md` and `specs/003-auth-session-lifecycle/plan.md`

**Scope rule**: Implement only T001–T006. Do not execute Spec Kit commands, tasks from other features, or adjacent authentication functionality.

## Phase 1: Public contracts

- [ ] **T001** Add the exact refresh response DTO (`accessToken`, `refreshToken`) beside the existing validated `RefreshTokenDto`; replace the unimplemented refresh/logout methods with a Swagger-documented `AuthSessionController` at `/v1/auth`, preserve register/login unchanged, and register both controllers — `backend/src/modules/auth/application/dto/refresh-token.dto.ts`, `backend/src/modules/auth/presentation/auth.controller.ts`, `backend/src/modules/auth/auth.module.ts`

**Independent completion**: Swagger exposes versioned refresh/logout with 200/400/401 and 204/400 responses, old 501 placeholders are absent, and register/login routes are unchanged.

## Phase 2: Atomic session persistence

- [ ] **T002** Extend authenticated-user selection with current email and implement repository operations for atomic old-session revocation plus replacement-session creation and idempotent active-session revocation by refresh-token hash; use a conditional transaction predicate covering session ID, user ID, old hash, null revocation, and future expiration — `backend/src/modules/auth/infrastructure/usuario.repository.ts`, `backend/src/modules/auth/infrastructure/sesion.repository.ts`

**Independent completion**: Repository tests prove one matching rotation revokes/creates atomically, zero matches create nothing, replacement failure rejects the transaction, and logout never affects a different session.

## Phase 3: Session lifecycle application logic

- [ ] **T003** Implement refresh verification, generic unauthorized mapping, persisted session/claim/expiration validation, current active user and configured active tenant validation, new UUID/session token generation, hashed-token atomic rotation, and success response only after rotation commits — `backend/src/modules/auth/application/auth.service.ts`

- [ ] **T004** Implement idempotent single-session logout by hashing the submitted value and conditionally revoking its active matching session without JWT verification, session enumeration, or revoke-all behavior — `backend/src/modules/auth/application/auth.service.ts`

**Independent completion**: A valid token rotates once, every invalid/replayed/concurrent attempt produces the same 401 and no tokens, and logout always returns success for a syntactically valid body while revoking at most one session.

## Phase 4: Focused verification

- [ ] **T005** Add typed unit and HTTP contract tests for all service, repository, concurrency, transaction, validation, response-shape, route-versioning, Swagger, and secret-exposure requirements listed in `plan.md`; do not mock above the repository boundary when asserting rotation predicates — `backend/test/unit/auth/auth-session-lifecycle.service.spec.ts`, `backend/test/contract/auth/auth-session-lifecycle.controller.spec.ts`

- [ ] **T006** Run build, ESLint only for the eight planned production/test files, both focused Jest suites with open-handle detection, then the complete Jest regression suite. Report exact results and stop without starting another feature.

## Dependencies and Execution Order

- T001 and T002 may be implemented independently.
- T002 must complete before T003 and T004.
- T001, T002, T003, and T004 must complete before T005.
- T001–T005 must complete before T006.

## Definition of Done

- A valid refresh atomically revokes the old session, creates one new session, and returns one exact token pair with a new `sid`.
- Replayed, concurrent, invalid, expired, revoked, mismatched, inactive-user, and tenant-invalid refresh attempts return the same HTTP 401 and create no session.
- Logout is single-session, hash-based, idempotent, and returns an empty HTTP 204 response.
- Existing registration and login behavior remains unchanged.
- Swagger contains the exact versioned contracts and no 501 placeholder for refresh/logout.
- No raw token, token hash, password hash, JWT payload, secret, or session persistence data appears in responses or logs.
- No schema, migration, package, global routing, unrelated module, or more than eight planned production/test files are changed.
- Focused build/lint/tests and full regression suite pass without warnings or open handles.
- T001–T006 are checked only after implementation and validation are complete.

## Mandatory Stop Conditions

Stop and report without editing outside scope if implementation appears to require a schema/migration, dependency, register/login contract change, global route change, cookies/CSRF, logout-all, token-family infrastructure, another module, more than eight production/test files, or any token/secret logging.
