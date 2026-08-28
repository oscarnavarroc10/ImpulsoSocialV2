# Feature Specification: BulkFollows Order Placement

**Feature Branch**: `feature/004-bulkfollows-orders`

**Created**: 2026-08-27

**Status**: Approved for MVP implementation

**Input**: Allow an authenticated customer to buy one eligible public catalog service with wallet balance and submit it exactly once to BulkFollows. Reuse the existing `Orden`, `OrdenProveedor`, `HistorialOrden`, `Billetera`, `MovimientoSaldo`, catalog provenance, JWT/session infrastructure, and integer-minor-unit money model. Add only the persistence needed for client-request idempotency.

## Clarifications

### Session 2026-08-27

- The MVP exposes one authenticated command: `POST /v1/orders`.
- Tenant and user identity come only from the verified access JWT plus current session/user persistence. The request cannot select a tenant or user.
- The request requires `Authorization: Bearer <access-token>` and an `Idempotency-Key` header. A UUID is the recommended client value.
- The request body contains exactly `serviceId`, `target`, and `quantity`.
- Selling prices are rates per 1,000 units. The exact total is `ceil(resolvedSellingPriceAmount × quantity / 1000)` in integer minor units, calculated with integer/`BigInt` arithmetic and no floating point.
- The resolved selling price uses the same eligibility and tenant-override rules as the public tenant catalog: active, visible, not disabled for the authenticated tenant, complete override or default fallback.
- The customer's wallet currency must exactly equal the resolved selling-price currency. Currency conversion is not performed.
- Quantity is validated against the selected provider service's imported `min` and `max` values.
- This MVP places only BulkFollows services whose imported `rawPayload.type` is `Default` (case-insensitive) and whose order contract is `service + link + quantity`. Other provider types remain for `004B-provider-order-types`; they are not silently coerced into the Default contract.
- The provider request uses the existing configured BulkFollows endpoint and credentials with form fields `key`, `action=add`, `service`, `link`, and `quantity`. The key is never persisted, returned, or logged.
- A successful provider response is exactly a JSON object with a non-empty `order` identifier. A JSON object with a non-empty `error` is an explicit provider rejection.
- An explicit provider rejection causes one atomic wallet refund and leaves the local order in `reembolsada`.
- A timeout, transport failure, non-2xx response, unreadable body, malformed JSON, or ambiguous response may have created a provider order. The local order remains `enviando`, the balance remains debited, and the system performs no automatic retry or refund.
- Provider submission is claimed with a conditional `pendiente → enviando` transition before the external call. Replays and concurrent requests never submit the provider call twice.
- A replay with the same idempotency key and the same canonical request returns the existing local order without another debit or provider call. Reusing the key with a different request returns HTTP 409.
- The first finalized local result returns HTTP 201. An outcome that remains uncertain in `enviando` returns HTTP 202. An idempotent replay returns HTTP 200.
- Public responses never expose provider identity, provider order ID, provider cost, provider payload/response, wallet internals, balance snapshots, API credentials, or request fingerprints.

## User Scenarios & Testing

### User Story 1 - Place a funded customer order (Priority: P1)

As an authenticated customer with sufficient balance, I can select an eligible service, target, and quantity so the platform charges the resolved selling price and submits one provider order.

**Why this priority**: This is the first backend flow that converts catalog inventory into a real sale.

**Independent Test**: Seed an active tenant, active customer session, eligible Default service with provider provenance, and funded matching-currency wallet; call `POST /v1/orders`; verify one order, one debit movement, one provider request, one provider-order record, and an `enviadaProveedor` response.

**Acceptance Scenarios**:

1. **Given** valid authentication, an eligible service, quantity within imported bounds, matching currency, and sufficient balance, **When** the order is submitted, **Then** the platform atomically creates the local order and purchase movement, debits the wallet once, submits one sanitized BulkFollows `add` request, stores the provider order ID privately, and returns the safe local order.
2. **Given** a complete tenant price override, **When** the order total is calculated, **Then** the override rate is used; otherwise the default selling rate is used.
3. **Given** a rate of 15,000 minor units per 1,000 and quantity 1,501, **When** the total is calculated, **Then** the charged total is 22,515 minor units.
4. **Given** insufficient balance, a missing matching-currency wallet, or a currency mismatch, **When** purchase is attempted, **Then** no order, movement, debit, or provider call persists.
5. **Given** a hidden, disabled, draft, deprecated, missing, malformed-provenance, non-BulkFollows, or unsupported-type service, **When** purchase is attempted, **Then** it is not submitted to the provider and no balance changes.
6. **Given** quantity below provider minimum or above provider maximum, **When** purchase is attempted, **Then** HTTP 422 is returned with no writes or provider call.

---

### User Story 2 - Retry safely without duplicate charges or orders (Priority: P1)

As a customer using an unreliable network, I can retry the same request without being charged twice or creating a duplicate provider order.

**Why this priority**: Order creation crosses a money boundary and an external side-effect boundary; retries are expected and must be safe.

**Independent Test**: Send the same request and idempotency key concurrently and sequentially; verify one local order, one purchase movement, one wallet debit, and at most one provider call.

**Acceptance Scenarios**:

1. **Given** the same authenticated tenant/user, idempotency key, and canonical request, **When** it is replayed after success, **Then** HTTP 200 returns the existing safe order and performs no writes or provider call.
2. **Given** two concurrent matching requests, **When** both attempt creation/submission, **Then** the unique persistence constraint and conditional provider claim allow exactly one debit and at most one provider request.
3. **Given** an existing key, **When** it is reused with a different service, normalized target, or quantity, **Then** HTTP 409 is returned and the existing order is not exposed beyond its ordinary safe response contract.
4. **Given** an order still in `enviando`, **When** the request is replayed, **Then** the current safe order is returned and BulkFollows is not called again.
5. **Given** the first process committed a `pendiente` order but stopped before claiming submission, **When** the same request is retried, **Then** one caller may conditionally claim it; all other callers observe the claimed state and do not call the provider.

---

### User Story 3 - Handle provider outcomes without losing money (Priority: P1)

As the platform operator, I need explicit rejection and uncertain delivery to follow different policies so the system neither keeps a charge for a known rejection nor creates duplicate provider orders after an ambiguous failure.

**Why this priority**: Treating every failure as equivalent can either overcharge customers or pay the provider twice.

**Independent Test**: Simulate accepted, explicit-error, timeout, transport, HTTP, malformed-body, and database-persistence outcomes using a fake transport; assert exact local states, movement counts, and provider call counts.

**Acceptance Scenarios**:

1. **Given** BulkFollows returns `{ "order": "123" }`, **When** the response is persisted, **Then** the private provider record receives that ID and the local order becomes `enviadaProveedor`.
2. **Given** BulkFollows returns `{ "error": "..." }`, **When** rejection is finalized, **Then** a transaction conditionally changes the order from `enviando` to `reembolsada`, restores the exact charged amount, creates one refund movement, and records history once.
3. **Given** a timeout, transport error, non-2xx response, unreadable/malformed body, or response without a definitive `order`/`error`, **When** submission completes, **Then** the local order stays `enviando`, no refund occurs, no automatic provider retry occurs, and HTTP 202 returns the safe order.
4. **Given** persistence fails after a provider request may have been accepted, **When** the failure is surfaced, **Then** the system does not retry or refund automatically; the pre-call provider-attempt record remains available for later reconciliation.
5. **Given** provider configuration is absent or the request cannot be constructed, **When** readiness is checked before the purchase transaction, **Then** no order is created and no balance is debited.

## Edge Cases

- Leading and trailing whitespace is removed from `target` before validation, fingerprinting, persistence, and provider submission.
- `Idempotency-Key` is trimmed, must be 8–128 visible characters from `[A-Za-z0-9._:-]`, and is scoped by tenant and user.
- The canonical request fingerprint is SHA-256 over an unambiguous serialization of `serviceId`, normalized target, and quantity. The raw access token and idempotency key are never part of the fingerprint input.
- Price multiplication and ceiling division must reject totals outside Prisma/MySQL signed `Int` range before any write.
- Provider `min`, `max`, `service`, and `type` are treated as untrusted imported JSON and are validated without permissive numeric coercion.
- A stale catalog price cannot be supplied by the caller. Price and provider cost snapshots are derived again inside the server-side purchase flow.
- The conditional wallet decrement must include `saldoDisponible >= total`; a prior read alone is insufficient under concurrency.
- The purchase `MovimientoSaldo.monto` and refund `monto` are positive magnitudes; `tipo`, `saldoAnterior`, and `saldoPosterior` define direction and audit state.
- A transaction rollback must remove the order, balance update, movement, and history together.
- Reimbursement must conditionally match `estado='enviando'` so repeated finalization cannot credit twice.
- `OrdenProveedor.solicitudOriginal` may contain only the sanitized provider action fields and never `key`.
- Authentication failures use a generic HTTP 401 and do not distinguish token, session, user, or tenant failure.
- The provider transport makes one attempt only and its timeout covers both the request and complete response-body read.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose authenticated `POST /v1/orders` and MUST document bearer access-token authentication in Swagger.
- **FR-002**: The endpoint MUST require a validated `Idempotency-Key` header and a body containing exactly `serviceId`, `target`, and positive integer `quantity`.
- **FR-003**: Authentication MUST verify an access JWT, active unexpired persisted session, active current user, matching JWT/current-user tenant, and active tenant; it MUST attach server-derived `userId` and `tenantId` and MUST NOT require an administrative role.
- **FR-004**: The service MUST resolve eligibility and selling price for the authenticated tenant using active/visible master state, tenant disable override, and complete-override/default fallback semantics equivalent to the public catalog.
- **FR-005**: The service MUST resolve `MasterService.provenanceRef` to one BulkFollows `ProviderService` and validate `externalId`, `rawPayload.type`, `min`, and `max` as untrusted input.
- **FR-006**: This feature MUST accept only provider type `Default` (case-insensitive). Other types MUST fail with HTTP 422 before monetary writes.
- **FR-007**: The total selling price MUST be ceiling-divided from the per-1,000 rate using integer/`BigInt` arithmetic and MUST fit the database signed-`Int` range.
- **FR-008**: The system MUST require a wallet belonging to the authenticated tenant/user whose currency exactly matches the selling currency. It MUST NOT perform conversion or auto-create a wallet during purchase.
- **FR-009**: Creating the order, conditionally decrementing sufficient wallet balance, writing one `compra` movement, and writing initial order history MUST occur in one transaction.
- **FR-010**: The schema MUST add nullable `idempotencyKey` and `requestFingerprint` fields to `Orden` for backward compatibility and a unique constraint scoped to `[tiendaId, usuarioId, idempotencyKey]`. New API-created orders MUST always populate both.
- **FR-011**: Same-key/same-fingerprint replays MUST return the existing order without another debit, movement, provider-attempt record, or provider call. Same-key/different-fingerprint requests MUST return HTTP 409.
- **FR-012**: Provider submission MUST be claimed by a conditional `pendiente → enviando` transition. Only the caller that changes exactly one row may invoke BulkFollows.
- **FR-013**: The pre-call transition MUST create the one-per-order `OrdenProveedor` record with provider name and sanitized request fields but no credential.
- **FR-014**: BulkFollows submission MUST use one form-encoded POST attempt with `key`, `action=add`, `service`, `link`, and `quantity` and the existing configurable timeout behavior.
- **FR-015**: A definitive non-empty provider `order` value MUST be persisted privately and MUST transition the order to `enviadaProveedor` with `enviadaProveedorEn` and history.
- **FR-016**: A definitive provider `error` object MUST atomically transition the exact `enviando` order to `reembolsada`, restore exactly `precioTotal`, create one `reembolso` movement, and write history.
- **FR-017**: Ambiguous external outcomes MUST leave the order `enviando`, retain the debit, perform no retry/refund, and return HTTP 202 with the safe local order.
- **FR-018**: First definitive local outcomes MUST return HTTP 201; idempotent replays MUST return HTTP 200. All success-shaped responses MUST contain only `id`, `serviceId`, `target`, `quantity`, `totalPrice`, `status`, and `createdAt`.
- **FR-019**: Provider cost may be snapshotted privately from the curated master service using the same per-1,000 calculation, but provider identity, cost, external ID, raw request/response, error detail, fingerprints, and wallet audit fields MUST NOT appear in the public response.
- **FR-020**: Logs and public errors MUST NOT contain BulkFollows credentials, authorization tokens, provider request bodies, raw provider responses, provider order IDs, request fingerprints, or wallet balance snapshots.
- **FR-021**: Existing auth, catalog, synchronization, snapshot, refresh/logout, registration/login, and administrative routes MUST remain behaviorally unchanged.
- **FR-022**: The implementation MUST use existing dependencies and Node's built-in crypto/fetch facilities. No queue, cache, scheduler, payment gateway, automatic provider retry, or new package may be added.

### API Contract

#### Create order

```http
POST /v1/orders
Authorization: Bearer eyJ...
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

```json
{
  "serviceId": "cms6ae2pk0000qvic8e8fl1g7",
  "target": "https://www.instagram.com/example/",
  "quantity": 1000
}
```

Accepted by provider — HTTP 201:

```json
{
  "id": "cm...",
  "serviceId": "cms6ae2pk0000qvic8e8fl1g7",
  "target": "https://www.instagram.com/example/",
  "quantity": 1000,
  "totalPrice": {
    "amount": 15000,
    "currency": "MXN"
  },
  "status": "enviadaProveedor",
  "createdAt": "2026-08-27T12:00:00.000Z"
}
```

Provider outcome uncertain — HTTP 202 with the same shape and `status: "enviando"`.

Explicit provider rejection and completed refund — HTTP 201 with the same shape and `status: "reembolsada"`.

Same-key/same-request replay — HTTP 200 with the existing order's current safe state.

Business conflicts include HTTP 409 for insufficient balance, missing/mismatched wallet, or idempotency-key payload conflict. Ineligible service returns HTTP 404. Unsupported type, invalid imported provider constraints, out-of-range quantity, or unrepresentable total returns HTTP 422. DTO/header validation failures return HTTP 400. Authentication failures return HTTP 401.

## Success Criteria

- **SC-001**: Focused tests prove one accepted request creates exactly one order, one purchase movement, one debit, one provider-attempt record, and one provider request.
- **SC-002**: Sequential and simulated concurrent replays produce one local order, one debit, and at most one provider call in 100% of tested schedules.
- **SC-003**: Price fixtures, including non-multiple-of-1,000 quantities and near-boundary values, produce exact ceiling totals without floating-point operations.
- **SC-004**: Every insufficient-balance, currency, eligibility, constraint, and unsupported-type fixture produces zero monetary/provider side effects.
- **SC-005**: Every explicit provider rejection fixture restores the exact charged amount once; every ambiguous fixture restores zero and retries zero times.
- **SC-006**: Recursive response/log assertions find zero provider credentials, external provider IDs, raw provider data, costs, fingerprints, tokens, or wallet audit snapshots.
- **SC-007**: Prisma schema validation/generation, backend build, focused lint, focused tests, and the complete Jest suite pass without open handles.

## Assumptions

- BulkFollows prices and curated selling prices are rates per 1,000 units. BulkFollows publicly describes its displayed service price this way.
- The configured authenticated BulkFollows API uses the conventional SMM `action=add` form contract and returns either `{ "order": ... }` or `{ "error": ... }`. Implementation must stop if the account's API documentation contradicts this contract; it must not place a live paid test order automatically.
- Current registered users already receive one wallet in the tenant currency; successful manual testing may fund it directly in local development until deposit management is implemented.
- Existing `enviando` is intentionally used for an external outcome that is in-flight or uncertain. Feature 005 will reconcile it by provider status/manual recovery.
- Existing orders pre-dating this migration remain valid with null idempotency fields.

## Out of Scope

- Provider service types other than `Default`, including comments, mentions, packages, subscriptions, drip-feed/runs, keywords, usernames, or type-specific fields. These belong to `004B-provider-order-types` after exact imported types are inventoried.
- Order list/detail/history endpoints, automatic status polling, reconciliation, cancellation, refill, partial-order credit, or completed-order processing.
- Customer-visible wallet balance/history, deposits, payment gateways, admin balance adjustments, or multi-currency conversion.
- Automatic retry of provider order creation, queues, workers, scheduled jobs, outbox infrastructure, or alternate providers.
- Frontend changes, notifications, analytics, rate limiting, fraud controls, terms acceptance, or moderation.
- Refactors of catalog/admin authorization or global API versioning.
