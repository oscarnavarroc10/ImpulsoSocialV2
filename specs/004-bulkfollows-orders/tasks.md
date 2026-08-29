# Tasks: BulkFollows Order Placement

**Input**: `specs/004-bulkfollows-orders/spec.md` and `specs/004-bulkfollows-orders/plan.md`

**Scope rule**: Implement only T001–T006. Do not execute Spec Kit commands, tasks from another feature, provider types other than `Default`, or adjacent order/status/wallet functionality.

## Phase 1: Additive idempotency persistence

- [x] **T001** Add nullable `idempotencyKey` and 64-character `requestFingerprint` fields to `Orden`, add the tenant/user/key unique constraint, and generate one reviewable additive migration without modifying any other model/enum; run Prisma format, validate, and generate — `backend/prisma/schema.prisma`, `backend/prisma/migrations/<timestamp>_add_order_idempotency/migration.sql`

**Independent completion**: Existing orders remain valid with null fields, new compound uniqueness is database-enforced, Prisma Client generates, and the migration contains no destructive/unrelated SQL.

## Phase 2: Authenticated public contract

- [x] **T002** Add the exact validated order request/response DTOs, an orders-local access-token/session/user guard with server-derived tenant/user principal, the Swagger-documented `POST /v1/orders` controller, bearer Swagger scheme, and module/application wiring; preserve all existing routes and behavior — `backend/src/modules/orders/application/dto/order.dto.ts`, `backend/src/modules/orders/security/order-authentication.guard.ts`, `backend/src/modules/orders/presentation/order.controller.ts`, `backend/src/modules/orders/orders.module.ts`, `backend/src/app.module.ts`, `backend/src/main.ts`

**Independent completion**: Swagger accepts bearer access tokens, the route rejects missing/invalid authentication and invalid `Idempotency-Key`/body values, request DTOs cannot select tenant/user/price, and the response schema contains only approved safe fields.

## Phase 3: Atomic purchase and idempotency

- [x] **T003** Implement tenant-scoped eligible service/provenance resolution, strict Default provider constraint parsing, exact per-1,000 `BigInt` price calculation, SHA-256 canonical request fingerprint, scoped replay/conflict handling, and the one-transaction order creation + conditional wallet debit + purchase movement + initial history flow; implement conditional provider claim and exact accepted/rejected/unknown persistence operations — `backend/src/modules/orders/infrastructure/order.repository.ts`, `backend/src/modules/orders/application/order.service.ts`

**Independent completion**: Same-key/same-request returns one order, different payload conflicts, concurrent purchase fixtures debit once, insufficient balance and all validation failures write nothing, only one caller can claim submission, and a rejection can credit exactly once.

## Phase 4: One-attempt provider submission

- [x] **T004** Implement the dedicated fake-transport-testable BulkFollows order client and connect it to `OrderService`: readiness before debit; one form POST with `key`, `action=add`, `service`, `link`, `quantity`; whole-response timeout; accepted `{order}`, explicit `{error}`, and ambiguous outcome discrimination; no credential/raw-body logging; no automatic retry — `backend/src/modules/orders/infrastructure/bulkfollows-order.client.ts`, `backend/src/modules/orders/application/order.service.ts`, `backend/src/modules/orders/orders.module.ts`

**Independent completion**: Accepted response stores the provider ID privately and returns `enviadaProveedor`; explicit rejection refunds once and returns `reembolsada`; timeout/transport/HTTP/body/JSON/shape ambiguity returns `enviando` with HTTP 202, keeps the debit, and invokes the transport once.

## Phase 5: Focused verification

- [x] **T005** Add typed focused tests covering every money formula, constraint, tenant/auth boundary, wallet transaction predicate, idempotency race/replay/conflict, provider claim, accepted/rejected/ambiguous outcome, provider timeout/secret-sanitization, HTTP status/validation/Swagger contract, and recursive safe-response requirement listed in `plan.md` — `backend/test/unit/orders/order.service.spec.ts`, `backend/test/contract/orders/bulkfollows-order.client.spec.ts`, `backend/test/contract/orders/order.controller.spec.ts`

- [x] **T006** Run the exact Prisma, build, focused ESLint, three focused Jest suites, full Jest regression, and root diff checks from `plan.md`; report exact suite/test counts, warnings, migration name, modified files, and stop without manual provider submission or starting Feature 005.

## Dependencies and Execution Order

- T001 must complete before code depending on the generated Prisma fields.
- T002 and the provider-client portion of T004 may proceed after T001 and independently of T003.
- T003 must complete before connecting provider outcomes in T004.
- T001–T004 must complete before T005.
- T001–T005 must complete before T006.

## Definition of Done

- `POST /v1/orders` is bearer-authenticated and tenant/user identity is exclusively server-derived.
- The request requires one validated idempotency key and exactly `serviceId`, `target`, and `quantity`.
- Only eligible active/visible/tenant-enabled BulkFollows Default services can be ordered.
- Quantity respects strictly parsed provider min/max and the exact total uses ceiling per-1,000 integer arithmetic.
- One transaction creates the order, conditionally debits sufficient matching-currency balance, and creates exact audit movement/history.
- Same-key replays never double charge or double submit; conflicting reuse returns 409.
- Only one `pendiente → enviando` claimant can call BulkFollows and the client makes one attempt.
- Accepted, explicitly rejected, and uncertain outcomes follow their approved distinct state/refund policies.
- Public responses/logs expose no provider-private, credential, fingerprint, token, or wallet-audit fields.
- The migration is additive and limited to the approved two fields/one unique constraint.
- Prisma validation/generation, build, focused lint/tests, and full regression pass without open handles.
- T001–T006 are checked only after implementation and validation are complete.

## Mandatory Stop Conditions

Stop and report without editing outside scope if implementation appears to require:

- Any provider type other than case-insensitive `Default`, including comments, mentions, packages, subscriptions, drip-feed, runs/intervals, usernames, or keywords.
- Guessing a provider request/response that differs from `action=add` with `service`, `link`, `quantity` and `{order}`/`{error}`; request the authenticated BulkFollows API documentation instead.
- A schema/migration change beyond nullable `Orden.idempotencyKey`, nullable 64-character `Orden.requestFingerprint`, and `@@unique([tiendaId, usuarioId, idempotencyKey])`.
- A new package, queue, cache, outbox, scheduler, payment integration, alternate provider, currency conversion, or automatic provider retry.
- Client-selected tenant/user/price/cost or a role/behavior change in existing authentication/catalog endpoints.
- More than the 13 planned production/test files plus one migration SQL file.
- Logging, returning, or snapshotting access/refresh tokens, BulkFollows key, raw provider request/response, provider external ID/cost, request fingerprint, or wallet balance snapshots.
- A live network/provider request or paid order during automated or manual validation without explicit operator approval.

