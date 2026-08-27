# Implementation Plan: Authentication Session Lifecycle

**Branch**: `feature/003-auth-session-lifecycle` | **Date**: 2026-08-27 | **Spec**: `specs/003-auth-session-lifecycle/spec.md`

**Input**: Feature specification from `specs/003-auth-session-lifecycle/spec.md`

## Summary

Complete the existing NestJS authentication module with secure refresh-token rotation and idempotent single-session logout. Refresh validates the JWT and persisted session, reloads current user/tenant state, creates a new token pair with a new `sid`, and atomically revokes the old session while creating its replacement. Logout hashes the supplied token and conditionally revokes only its active session, always returning 204 for a syntactically valid request.

## Technical Context

**Language/Version**: Existing Node.js and TypeScript versions from `backend/package.json`.

**Primary Dependencies**: Existing NestJS, Prisma ORM, MySQL, `@nestjs/jwt`, `class-validator`, and `@nestjs/swagger` packages only.

**Storage**: Existing `Usuario`, `Tienda`, and `SesionUsuario` models. No schema change or migration.

**Testing**: Focused Jest unit and HTTP contract tests with typed mocks/fakes. Repository tests must execute the real repository methods against a mocked Prisma client/transaction rather than mocking above the repository boundary.

**Public Routes**:

- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

**Constraints**:

- No new package, schema, migration, cookie, guard, cache, queue, external call, or global versioning change.
- Preserve existing `/auth/register` and `/auth/login` contracts exactly.
- Never log or return raw tokens, token hashes, password hashes, JWT payloads, or secrets.
- Keep the implementation inside the existing `AuthModule` and the eight planned production/test files.

## Constitution Check

- **Specification first**: Behavior, errors, concurrency, API contracts, and transaction semantics are defined before code changes.
- **Multi-tenancy**: Refresh compares JWT, current user, and configured active tenant identity; callers cannot select a tenant.
- **API versioning**: The two newly implemented public contracts are under `/v1`; existing unversioned register/login routes are preserved as existing compatibility debt.
- **Security**: Raw refresh tokens are never persisted, invalidity reasons are normalized, and old sessions are revoked on rotation.
- **Atomicity**: Conditional revocation and replacement-session creation occur in one Prisma transaction, preventing double refresh.
- **Simplicity**: Existing models, hash service, token service, DTO, and repositories are reused; no new infrastructure is introduced.
- **Quality**: Swagger, focused tests, full regression tests, build, lint, and open-handle detection are required.

**Gate Result**: PASSED. No ADR is required because this feature completes behavior already anticipated by the existing session schema and AuthModule responsibilities.

## Design

### Refresh flow

1. Validate `RefreshTokenDto` at the controller boundary.
2. Verify the submitted JWT through `AuthTokenService.verifyRefreshToken`; translate every verification failure into `UnauthorizedException('Sesión inválida')`.
3. Hash the raw token with `RefreshTokenHasher` and find the matching persisted session.
4. Validate session existence, JWT `sid`/`sub`, null `revocadaEn`, and future `expiraEn`.
5. Load the current user and configured tenant. Require active user, active tenant, and matching tenant identities.
6. Generate a new UUID session ID and token pair from current persisted user claims.
7. Verify the newly generated refresh token only to obtain its expiration, then hash it.
8. Ask `SesionRepository` to rotate atomically. The transaction conditionally revokes the exact active old session and creates the exact new session only when one old row was matched.
9. Return the token pair only after the transaction succeeds. A false/contended result becomes the same generic HTTP 401.

### Logout flow

1. Validate `RefreshTokenDto`.
2. Hash the submitted value without requiring JWT verification.
3. Execute an `updateMany` limited to the matching hash and `revocadaEn=null`.
4. Ignore whether zero or one row changed and return `void`; the controller responds with HTTP 204.

This deliberately makes logout idempotent and permits cleanup with an expired token while revealing no session-existence information.

### Persistence changes

Extend `SesionRepository` with:

- An atomic `rotate` operation using an interactive Prisma transaction.
- A conditional/idempotent revoke-by-hash operation using `updateMany`.

The rotation transaction must:

- Match old session `id`, `usuarioId`, `refreshTokenHash`, `revocadaEn=null`, and `expiraEn > now`.
- Set `revocadaEn` on exactly one old session.
- Return `false` and create nothing if the conditional update count is not one.
- Create the new session within the same transaction after a successful conditional update.
- Roll back revocation if replacement-session creation throws.

Extend the existing authenticated-user selection in `UsuarioRepository` with current `email` so refreshed JWT claims do not reuse stale token email data.

### HTTP controllers and Swagger

Keep register/login methods in the existing `AuthController` at `/auth`.

In the same `auth.controller.ts` file, export a second `AuthSessionController` with `@Controller('v1/auth')` for refresh/logout and register both controllers in `AuthModule`. Remove the obsolete unimplemented refresh/logout methods and `ApiNotImplementedResponse` documentation from `AuthController`.

Add a refresh response DTO beside `RefreshTokenDto` containing exactly `accessToken` and `refreshToken` with Swagger properties.

## Planned File Changes

```text
specs/003-auth-session-lifecycle/
├── spec.md
├── plan.md
└── tasks.md

backend/src/modules/auth/
├── application/
│   ├── auth.service.ts                                  # implement refresh/logout
│   └── dto/refresh-token.dto.ts                         # add response DTO
├── infrastructure/
│   ├── sesion.repository.ts                             # atomic rotate + idempotent revoke
│   └── usuario.repository.ts                            # current email selection
├── presentation/auth.controller.ts                      # versioned session controller + Swagger
└── auth.module.ts                                       # register session controller

backend/test/
├── unit/auth/auth-session-lifecycle.service.spec.ts      # new
└── contract/auth/auth-session-lifecycle.controller.spec.ts # new
```

Maximum expected production/test files changed: 8. The three approved SDD files are documentation inputs and are not implementation scope.

## Test Strategy

### Service and repository unit tests

The unit suite must cover:

- Valid JWT/session/user/tenant rotation and current claim mapping.
- New `sid` in both generated tokens and old/new hash handling.
- Malformed, expired, wrong-type, missing, revoked, database-expired, claim-mismatched, user-missing, user-inactive, tenant-inactive, and tenant-mismatched refresh rejection.
- Identical public `UnauthorizedException('Sesión inválida')` behavior for refresh failures.
- Conditional rotation returning false after a concurrent/replayed attempt.
- Transactional repository predicate, successful revoke/create ordering, no create when update count is zero, and thrown replacement creation causing transaction rejection.
- Logout hashes input, conditionally revokes one matching active session, never calls revoke-all, and succeeds for zero matches.
- Typed mocks without `as any` or ESLint warnings.

### HTTP contract tests

The contract suite must cover:

- `POST /v1/auth/refresh` works without Authorization header and returns exactly two token fields with HTTP 200.
- Invalid refresh service result maps to generic HTTP 401.
- `POST /v1/auth/logout` returns HTTP 204 with an empty body and works without Authorization header.
- Invalid/missing/non-string/empty request bodies return HTTP 400.
- Old `/auth/refresh` and `/auth/logout` routes are absent.
- Swagger documents 200/400/401 for refresh and 204/400 for logout and contains no obsolete 501 response.
- Recursive response assertions find no hash, password, secret, session-record, or internal JWT payload fields.

Tests must not use live JWT secrets, MySQL, external services, or timers that remain open.

## Validation Commands

Run from `backend/`:

```bash
npm run build

npx eslint \
  src/modules/auth/application/auth.service.ts \
  src/modules/auth/application/dto/refresh-token.dto.ts \
  src/modules/auth/infrastructure/sesion.repository.ts \
  src/modules/auth/infrastructure/usuario.repository.ts \
  src/modules/auth/presentation/auth.controller.ts \
  src/modules/auth/auth.module.ts \
  test/unit/auth/auth-session-lifecycle.service.spec.ts \
  test/contract/auth/auth-session-lifecycle.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/auth/auth-session-lifecycle.service.spec.ts \
  test/contract/auth/auth-session-lifecycle.controller.spec.ts
```

After focused validation passes, run the complete regression suite:

```bash
npm test -- --runInBand --detectOpenHandles
```

## Stop Conditions

Stop without expanding scope and report the reason if implementation appears to require:

- A Prisma schema change or migration.
- A new dependency or authentication technology.
- Changes to register/login behavior, catalog, orders, wallets, providers, `main.ts`, or global routing.
- Cookies, CSRF, logout-all, token families, caches, queues, or rate limiting.
- More than the eight planned production/test files.
- Logging a token, token hash, JWT payload, secret, or password hash.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.
