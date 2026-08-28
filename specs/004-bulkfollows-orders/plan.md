# Implementation Plan: BulkFollows Order Placement

**Branch**: `feature/004-bulkfollows-orders` | **Date**: 2026-08-27 | **Spec**: `specs/004-bulkfollows-orders/spec.md`

**Input**: Feature specification from `specs/004-bulkfollows-orders/spec.md`

## Summary

Implement one authenticated, idempotent `POST /v1/orders` purchase command. The command resolves the current tenant's sellable Default service and per-1,000 price, validates imported provider bounds, atomically creates a local order and wallet debit, conditionally claims the provider submission, and sends one BulkFollows `action=add` request. Explicit provider rejection refunds exactly once; ambiguous external outcomes remain `enviando` without automatic retry or refund. A small additive migration supplies scoped idempotency and request-fingerprint persistence.

## Technical Context

**Language/Version**: Existing Node.js and TypeScript versions from `backend/package.json`.

**Primary Dependencies**: Existing NestJS, Prisma ORM, MySQL, `@nestjs/jwt`, `class-validator`, `@nestjs/swagger`, Node `crypto`, and global `fetch` only.

**Storage**: Existing `Orden`, `OrdenProveedor`, `HistorialOrden`, `Billetera`, `MovimientoSaldo`, `Tienda`, `Usuario`, `SesionUsuario`, `MasterService`, `TenantServiceOverride`, and `ProviderService` models. Add only `Orden.idempotencyKey`, `Orden.requestFingerprint`, and a scoped unique index.

**Testing**: Focused Jest unit, repository, provider-client contract, and HTTP contract tests with typed mocks/fakes. No automated test may call live BulkFollows or create a paid order.

**Public Route**:

- `POST /v1/orders`

**Constraints**:

- One local purchase currency; exact wallet/selling-price currency match; no FX.
- Selling and provider rates are per 1,000 units and stored/calculated in integer minor units.
- Default provider type only for this feature.
- One provider submission attempt; no automatic retry after the conditional claim.
- No credential, raw provider data, provider ID/cost, fingerprint, token, or balance snapshot in public responses/logs.
- Preserve all existing auth and catalog behavior.

## Constitution Check

- **Specification first**: API, money formula, state transitions, idempotency, external failure semantics, and transaction boundaries are explicit before code.
- **Multi-tenancy**: Tenant/user identity is derived from verified current authentication. Every wallet/order/catalog query is scoped by those persisted identities; callers cannot select a tenant.
- **Money integrity**: All amounts use integer minor units. Exact ceiling arithmetic uses `BigInt`; wallet decrement and audit movement are atomic and conditional.
- **External side effects**: The provider call occurs after a conditional local claim, is never inside the database transaction, and is never retried blindly.
- **Idempotency**: A database unique constraint and canonical fingerprint prevent duplicate local charges; a conditional order-state transition prevents duplicate provider submissions.
- **Failure safety**: Explicit rejection and ambiguous outcomes are intentionally different. Refund is atomic and conditional; ambiguity is retained for later reconciliation.
- **API versioning/security**: The new route is `/v1`, bearer-authenticated, Swagger documented, and safe-field selected.
- **Simplicity**: Existing order/wallet/provider audit models and dependencies are reused. One additive migration is required; no queue/outbox is introduced for the MVP.
- **Quality**: Prisma validation/generation, build, focused lint/tests, full regression tests, and open-handle detection are required.

**Gate Result**: PASSED with one reviewable additive migration. No ADR is required because the schema already models orders, provider orders, wallet movements, and order history; the migration only closes the existing idempotency gap.

## Design

### 1. Authenticated principal

Add an orders-local guard/service pair in one file. It imports the existing exported `AuthTokenService`, `SesionRepository`, and `UsuarioRepository` from `AuthModule` and performs:

1. Strict `Bearer` extraction.
2. Access-token signature, expiration, and `tipo='access'` verification.
3. Persisted session lookup by `sid`; require matching `sub`, null revocation, and future DB expiration.
4. Current user lookup; require active state and matching token/current-user tenant.
5. Attach `{ userId, tenantId, role }` to the request.

The order application repository subsequently requires the tenant itself to be active. Authentication errors are normalized to generic HTTP 401. No customer-supplied tenant/user value is accepted and no role restriction is added.

Do not refactor `CatalogAuthorizationService` in this feature. Shared-auth consolidation may happen later without risking catalog regressions now.

### 2. DTO and public response

`CreateOrderDto` contains exactly:

- `serviceId`: trimmed, non-empty string.
- `target`: trimmed, HTTP/HTTPS URL, maximum 2,048 characters.
- `quantity`: integer, at least 1.

Create a custom parameter decorator or controller helper for `Idempotency-Key`; validate the trimmed value against `^[A-Za-z0-9._:-]{8,128}$` and return HTTP 400 on absence/invalidity.

The safe response DTO contains only:

- `id`
- `serviceId`
- `target`
- `quantity`
- `totalPrice: { amount, currency }`
- `status`
- `createdAt`

The controller selects HTTP status from the application result: `201` for a newly finalized result, `202` for a newly created uncertain `enviando` result, and `200` for an idempotent replay.

### 3. Catalog and provider resolution

The order repository resolves one purchase candidate under authenticated `tenantId`:

- Active tenant.
- `MasterService.id=serviceId`, `status='active'`, and `isVisible=true`.
- No matching tenant override with `isEnabled=false`.
- Complete tenant price override wins; otherwise both default price fields are used.
- `provenanceRef` must resolve to `ProviderService.id`.
- `ProviderService.providerOrigin` must equal `bulkfollows`.

Validate imported values in application code:

- `externalId`: non-empty digit string.
- `rawPayload.service`: same numeric/string identifier as `externalId` when present.
- `rawPayload.type`: trimmed case-insensitive `Default`.
- `rawPayload.min` and `rawPayload.max`: positive whole numbers within safe integer range, `min <= max`.
- Requested quantity is within bounds.

The exact imported payload is never returned. A missing/ineligible master service maps to uniform HTTP 404. Unsupported type or malformed provider contract maps to HTTP 422 without writes.

### 4. Exact price and fingerprint

Resolve the effective selling rate and compute:

```text
total = (rate × quantity + 999) / 1000
```

using `BigInt` only. Apply the same formula to the private provider-cost snapshot. Reject non-positive rates, non-positive totals, or totals greater than signed 32-bit integer maximum before persistence.

Normalize `target` once. Compute a SHA-256 hex fingerprint over a stable length-delimited/canonical JSON serialization containing only `serviceId`, normalized target, and quantity. The fingerprint detects incompatible reuse; it is not an authentication secret.

### 5. Idempotent purchase transaction

Add nullable fields for compatibility with pre-existing rows:

```prisma
idempotencyKey   String?
requestFingerprint String? @db.Char(64)

@@unique([tiendaId, usuarioId, idempotencyKey])
```

New API orders always set both fields.

Repository purchase flow:

1. Look up the scoped idempotency key. If found, compare fingerprints: same returns replay; different throws conflict.
2. Begin one Prisma transaction.
3. Create `Orden` in `pendiente` with resolved price/currency and private provider-cost snapshot. Creating first lets a unique-key race abort the entire transaction before monetary writes persist.
4. Resolve the exact tenant/user/currency wallet and conditionally decrement with `saldoDisponible >= total`.
5. Read the resulting balance and create one positive-magnitude `MovimientoSaldo` of type `compra` with exact previous/posterior balances and `referencia=orderId`.
6. Create initial `HistorialOrden` state.
7. Commit and return `created=true`.

If create hits the scoped unique constraint, roll back, reload the existing row, compare fingerprint, and return replay/conflict. No separate prior-balance read can authorize the debit.

### 6. Single provider claim and pre-call record

After purchase commit, any same-request caller may attempt the claim:

1. Conditional `Orden.updateMany` scoped by order, tenant, user, and `estado='pendiente'` sets `estado='enviando'`.
2. Only `count=1` is allowed to proceed. Other callers reload and return the safe current order.
3. In the same claim transaction, create the one-to-one `OrdenProveedor` with `proveedor='bulkfollows'`, null external ID, an internal sending marker, and `solicitudOriginal` containing only `{ action, service, link, quantity }`.
4. Add order history for `pendiente → enviando`.

The API key must never enter `solicitudOriginal`, logs, exceptions, test snapshots, or responses.

### 7. BulkFollows order client

Create a dedicated `BulkFollowsOrderClient` rather than expanding the catalog-only interface. It reuses the established transport pattern:

- Config readiness check before monetary persistence.
- Injectable fake HTTP transport for tests.
- Form-encoded POST with the existing `BULKFOLLOWS_API_URL`, `BULKFOLLOWS_API_KEY`, and `BULKFOLLOWS_REQUEST_TIMEOUT_MS` semantics.
- Abort timeout covering request and full body read.
- Exactly one transport invocation.
- Sanitized error classes/results distinguishing:
  - accepted: parsed non-empty `order`;
  - rejected: parsed non-empty `error`;
  - unknown: timeout, transport, HTTP, body-read, JSON, or ambiguous shape.

No live provider request appears in automated validation.

### 8. Outcome persistence

**Accepted**: In one transaction, conditionally match the exact `enviando` order, update its private `OrdenProveedor.idExterno`/response, set order `enviadaProveedor` and `enviadaProveedorEn`, and add history. Return new status 201.

**Explicit rejection**: In one transaction, conditionally match the exact `enviando` order, restore `precioTotal` to the exact wallet, derive previous/posterior balances from the atomic update result, create one `reembolso` movement, set order `reembolsada` with sanitized internal message, update private provider response, and add history. The conditional state match makes repeated finalization a no-op. Return the safe order with status 201.

**Unknown**: Keep the pre-call provider-attempt record and `enviando` state. Persist only a sanitized internal outcome marker if safe; do not persist thrown transport details. Do not refund or call BulkFollows again. Return the safe order with status 202.

If local persistence fails after a possible accepted provider response, do not provider-retry or refund. Surface an internal error and retain the pre-call attempt for Feature 005 reconciliation.

## Planned File Changes

```text
specs/004-bulkfollows-orders/
├── spec.md
├── plan.md
└── tasks.md

backend/prisma/
├── schema.prisma
└── migrations/<timestamp>_add_order_idempotency/migration.sql

backend/src/
├── app.module.ts
├── main.ts
└── modules/orders/
    ├── application/
    │   ├── dto/order.dto.ts
    │   └── order.service.ts
    ├── infrastructure/
    │   ├── bulkfollows-order.client.ts
    │   └── order.repository.ts
    ├── presentation/order.controller.ts
    ├── security/order-authentication.guard.ts
    └── orders.module.ts

backend/test/
├── unit/orders/order.service.spec.ts
├── contract/orders/bulkfollows-order.client.spec.ts
└── contract/orders/order.controller.spec.ts
```

Maximum expected production/test files changed: 13 plus one generated migration SQL file. The three approved SDD files are documentation inputs and do not count toward implementation scope.

## Test Strategy

### Application/repository unit tests

Cover:

- Effective tenant override and default-price fallback.
- Default-only type, provider origin/provenance, exact external ID, min/max parsing, and quantity bounds.
- Per-1,000 ceiling calculations including 1, 999, 1,000, 1,001, non-round rates, and signed-Int overflow.
- Authentication principal/tenant scoping and active tenant requirement.
- Purchase transaction ordering, conditional sufficient-balance predicate, exact previous/posterior balance audit, and rollback paths.
- Scoped idempotency replay/conflict and simulated unique-constraint race.
- Conditional provider claim; only `count=1` caller invokes client.
- Accepted state transition and private provider ID persistence.
- Explicit rejection's one exact refund and repeated-finalization no-op.
- Unknown outcome retaining `enviando`, debit, and zero retry/refund.
- Typed mocks/fakes without `as any` and without new ESLint warnings.

Repository tests must exercise real repository methods against a typed mocked Prisma client/transaction rather than mocking above the repository boundary for transaction-predicate assertions.

### Provider-client contract tests

Cover:

- Exact form fields and single POST attempt.
- Successful numeric/string `order` parsing.
- Explicit `error` discrimination.
- Timeout during transport and during response body.
- Transport, HTTP, unreadable-body, invalid-JSON, and ambiguous-shape outcomes.
- Timeout-handle cleanup and `--detectOpenHandles`.
- API key and raw body absence from errors/logs.

### HTTP contract tests

Cover:

- Bearer and idempotency headers plus exact body validation.
- Missing/invalid auth returns 401; body/header failures return 400.
- First accepted/refunded result 201, uncertain result 202, replay 200.
- 404/409/422 mappings.
- Exact safe response fields and recursive forbidden-key scan.
- Swagger bearer security scheme, route security, request/response DTOs, and documented statuses.
- Existing auth/catalog routes still present and unchanged in focused wiring assertions.

Tests must not use live MySQL credentials, real JWT secrets, provider credentials, network calls, or timers left open.

## Validation Commands

Run from `backend/`:

```bash
npx prisma format
npx prisma validate
npx prisma generate

npm run build

npx eslint \
  src/app.module.ts \
  src/main.ts \
  src/modules/orders/application/dto/order.dto.ts \
  src/modules/orders/application/order.service.ts \
  src/modules/orders/infrastructure/bulkfollows-order.client.ts \
  src/modules/orders/infrastructure/order.repository.ts \
  src/modules/orders/presentation/order.controller.ts \
  src/modules/orders/security/order-authentication.guard.ts \
  src/modules/orders/orders.module.ts \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/bulkfollows-order.client.spec.ts \
  test/contract/orders/order.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/bulkfollows-order.client.spec.ts \
  test/contract/orders/order.controller.spec.ts
```

After focused validation passes:

```bash
npm test -- --runInBand --detectOpenHandles
```

From the repository root:

```bash
git diff --check
git status --short
git diff --stat
```

Do not run a live paid BulkFollows order as part of automated validation. Manual sandbox/minimum-quantity verification requires explicit operator approval after code review.

## Stop Conditions

Stop without expanding scope and report the reason if implementation appears to require:

- Any provider type beyond case-insensitive `Default`, or provider fields beyond `service`, `link`, and `quantity`.
- A BulkFollows contract different from the approved `action=add` request and `{order}`/`{error}` response; request the account-specific documentation instead of guessing.
- A schema change beyond the two nullable `Orden` fields and their scoped unique index.
- A new dependency, queue, cache, outbox, scheduler, alternate provider, payment gateway, or automatic external retry.
- Currency conversion, customer-supplied tenant/user identity, or a client-supplied price/cost.
- Changes to existing auth/catalog business behavior, registration/login/refresh/logout contracts, catalog outputs, or administrative authorization.
- More than the 13 planned production/test files plus one migration.
- Logging/returning any credential, token, raw provider request/response, provider order ID/cost, fingerprint, or wallet balance snapshot.
- A live provider call or paid test order without explicit operator approval.

## Complexity Tracking

| Decision | Reason | Simpler option rejected because |
|---|---|---|
| Add two nullable idempotency fields and one unique index | Durable replay/concurrency safety across processes requires database enforcement | In-memory locks or pre-read checks fail across instances and races |
| Keep ambiguous provider outcome as `enviando` | The provider may have accepted before timeout; exact result is unknowable locally | Blind retry/refund can duplicate provider spend or customer credit |
| Separate order client from catalog client | Catalog interface explicitly represents `action=services`; order placement has different response/failure semantics | Expanding the catalog abstraction would mix unrelated responsibilities and risk sync behavior |

