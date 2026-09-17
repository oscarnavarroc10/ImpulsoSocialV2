# Feature Specification: Manual Deposit Lifecycle

**Feature Branch**: `feature/009-deposit-lifecycle`  
**Created**: 2026-09-17  
**Status**: Approved — final manual-funding slice for the sellable MVP

## Goal

Complete the backend MVP with a safe manual funding workflow that uses the
existing `Deposito`, `Billetera`, and `MovimientoSaldo` models:

1. An authenticated customer records proof of a bank transfer or cryptocurrency
   payment.
2. The customer can list, inspect, and cancel their own pending requests.
3. A current same-tenant administrator can list, inspect, approve, or reject
   requests.
4. Approval credits the canonical wallet and creates the exact audit movement
   once, even under sequential retries or concurrent requests.
5. The same payment reference cannot be submitted twice for the same tenant and
   manual method.

This feature deliberately finishes a **manual-review MVP**. It does not pretend
to verify a bank transfer, blockchain transaction, card charge, or webhook
automatically. Automatic payment providers remain a later optional integration.

## Business outcome

After this feature, the complete sellable backend flow is:

```text
register/login
→ browse public catalog
→ submit transfer/crypto proof
→ admin approves deposit
→ wallet receives balance once
→ customer creates BulkFollows order
→ customer reads/refreshes order status
→ partial/canceled orders refund automatically once
```

## Actors and tenant boundary

- `cliente`: may create/read/cancel only deposits attached to their own
  canonical wallet in the authenticated active tenant.
- `administradorTienda`: may read/approve/reject deposits only inside the
  authenticated active tenant.
- `administradorPlataforma`: has the same tenant boundary in this feature; it
  is not a cross-tenant super-admin.
- Every user, tenant, role, wallet, and currency value comes from current
  persisted authentication and server-side database state.
- No request may select a tenant, wallet, currency, status, approving admin,
  balance, movement type, provider payload, or fingerprint.

## Supported manual methods

Customer creation accepts exactly:

- `transferencia` → internal `proveedorPago = "manual-transfer"`
- `criptomoneda` → internal `proveedorPago = "manual-crypto"`

The existing enum values `tarjeta`, `saldoManual`, and `otro` are rejected for
this endpoint. There is no card gateway, automatic blockchain verification, or
generic payment method in this feature.

## Public API

### Create a deposit request

```http
POST /v1/deposits
Authorization: Bearer <access-token>
Idempotency-Key: deposit-request-unique-key
Content-Type: application/json

{
  "amount": 50000,
  "method": "transferencia",
  "paymentReference": "SPEI-20260917-ABC123",
  "receiptUrl": "https://example.com/private-proof/receipt.jpg"
}
```

Validation:

- `amount`: integer minor units from 1 through 2,147,483,647.
- `method`: exactly `transferencia` or `criptomoneda`.
- `paymentReference`: trimmed, 3–128 visible characters; required.
- `receiptUrl`: optional, trimmed HTTPS URL, maximum 2,048 characters. Empty
  strings normalize to `null`.
- Unknown body fields are rejected by the existing global validation pipe.
- `Idempotency-Key`: trimmed and must match
  `^[A-Za-z0-9._:-]{8,128}$`.

First success returns HTTP 201. Same-key/same-request replay returns HTTP 200.
Same key with a different canonical request returns HTTP 409.

Customer response contains exactly:

```json
{
  "id": "deposit-request-id",
  "amount": { "amount": 50000, "currency": "MXN" },
  "method": "transferencia",
  "status": "pendiente",
  "paymentReference": "SPEI-20260917-ABC123",
  "receiptUrl": "https://example.com/private-proof/receipt.jpg",
  "rejectionReason": null,
  "approvedAt": null,
  "rejectedAt": null,
  "createdAt": "2026-09-17T12:00:00.000Z",
  "updatedAt": "2026-09-17T12:00:00.000Z"
}
```

### List own deposits

```http
GET /v1/deposits?page=1&limit=20&status=pendiente&method=transferencia
Authorization: Bearer <access-token>
```

- `page`: default 1, minimum 1.
- `limit`: default 20, range 1–100.
- `status`: optional exact `EstadoDeposito` value.
- `method`: optional exact supported manual method.
- Stable ordering: `creadoEn DESC`, then `id DESC`.
- Response: `{ items, pagination: { page, limit, total, totalPages } }`.

### Read one own deposit

```http
GET /v1/deposits/:id
Authorization: Bearer <access-token>
```

Missing, foreign-tenant, or another customer's ID returns the same HTTP 404.

### Cancel one own pending deposit

```http
POST /v1/deposits/:id/cancel
Authorization: Bearer <access-token>
```

- `pendiente → cancelado` returns HTTP 200.
- Repeating cancellation of the same owned `cancelado` deposit returns HTTP
  200 without another write.
- `aprobado` or `rechazado` returns HTTP 409.
- Cancellation never changes a wallet or creates a movement.

## Administrative API

Every administrative endpoint requires the current persisted role
`administradorTienda` or `administradorPlataforma`. Role rejection happens
before deposit lookup or writes.

### List same-tenant deposits

```http
GET /v1/admin/deposits?page=1&limit=20&status=pendiente&method=transferencia&userId=user-id
Authorization: Bearer <access-token>
```

Filters are optional and exact. `userId` is trimmed and non-empty when present.
Ordering and pagination match the customer list.

Each admin item contains the customer response fields plus exactly:

```json
{
  "customer": {
    "id": "user-id",
    "name": "Customer Name",
    "email": "customer@example.com"
  }
}
```

### Read one same-tenant deposit

```http
GET /v1/admin/deposits/:id
Authorization: Bearer <access-token>
```

Missing or foreign-tenant ID returns the same HTTP 404.

### Approve a pending deposit

```http
POST /v1/admin/deposits/:id/approve
Authorization: Bearer <access-token>
```

First approval returns HTTP 200 and atomically:

1. transitions `pendiente → aprobado`;
2. records `aprobadoPorId` and `aprobadoEn`;
3. increments the exact canonical tenant/user/currency wallet;
4. creates exactly one `MovimientoSaldo` of type `deposito`;
5. records exact `saldoAnterior` and `saldoPosterior`.

The movement uses:

```text
id          = deposit-credit:<depositId>
tipo        = deposito
monto       = Deposito.monto
referencia  = depositId
descripcion = Depósito aprobado
creadoPorId = authenticated administrator ID
```

Repeating approval after success returns HTTP 200 with the approved deposit and
performs no write. The replay is valid only if the deterministic movement
exists and matches deposit ID, wallet, type, amount, and reference. An approved
deposit with missing or inconsistent audit movement fails closed with generic
HTTP 500 and no corrective write.

`rechazado` or `cancelado` cannot be approved and returns HTTP 409.

### Reject a pending deposit

```http
POST /v1/admin/deposits/:id/reject
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "reason": "El comprobante no coincide con el monto solicitado"
}
```

- `reason`: trimmed, 3–500 characters.
- `pendiente → rechazado` records `motivoRechazo` and `rechazadoEn`.
- Same normalized reason replay returns HTTP 200 without another write.
- Different reason replay, `aprobado`, or `cancelado` returns HTTP 409.
- Rejection never changes a wallet or creates a movement.

## Deposit state machine

| Current state | Create | Customer cancel | Admin approve | Admin reject |
|---|---:|---:|---:|---:|
| nonexistent | `pendiente` | 404 | 404 | 404 |
| `pendiente` | — | `cancelado` | `aprobado` + credit | `rechazado` |
| `aprobado` | — | 409 | 200 replay after invariant check | 409 |
| `rechazado` | — | 409 | 409 | 200 only for same reason |
| `cancelado` | — | 200 replay | 409 | 409 |

No transition may reopen or mutate a terminal state.

## Authentication

Create a deposits-local guard following the proven wallets/orders guard:

1. Require `Bearer <token>`.
2. Verify signature, expiry, and `tipo='access'` through `AuthTokenService`.
3. Require the persisted session to exist, match `sub`, remain unrevoked, and
   remain unexpired.
4. Require the persisted user to be active and match the token tenant.
5. Require the persisted tenant to be active.
6. Attach only current persisted `{ userId, tenantId, role }`.

All authentication failures return generic HTTP 401. JWT role claims are never
used for authorization.

## Creation idempotency and duplicate-proof prevention

### Idempotency claim

Normalize the key and compute:

```text
keyHash = SHA-256(JSON.stringify([tenantId, userId, normalizedKey]))
depositId = deposit-request:<keyHash>
```

Canonical request fingerprint:

```text
SHA-256(JSON.stringify([
  amount,
  method,
  normalizedPaymentReference,
  normalizedReceiptUrlOrNull
]))
```

Store only this internal JSON in `datosProveedor`:

```json
{
  "kind": "manual-deposit-request",
  "requestFingerprint": "64-character-sha256"
}
```

Never store the raw idempotency key. The client cannot supply
`datosProveedor`.

### Unique payment evidence

Add exactly one additive Prisma uniqueness rule to `Deposito`:

```prisma
@@unique(
  [tiendaId, proveedorPago, referenciaExterna],
  map: "depositos_tienda_proveedor_referencia_key"
)
```

For every new request, `proveedorPago` and `referenciaExterna` are non-null.
This prevents two idempotency keys or users from submitting the same evidence
inside the same tenant and method, including concurrently.

Before generating the migration, check for existing non-null duplicates grouped
by `tiendaId`, `proveedorPago`, and `referenciaExterna`. If any exist, stop and
report them; do not delete, merge, or rewrite historical data automatically.

On Prisma `P2002` during creation:

1. Reload by deterministic `depositId` and apply replay/fingerprint conflict.
2. If absent, look up the same tenant/provider/reference and return HTTP 409
   `Payment reference already submitted`.
3. If neither row exists, return generic HTTP 500.

## Atomic approval and concurrency

Approval must use one database transaction:

1. Re-resolve the active tenant, deposit, active wallet owner, and canonical
   wallet currency inside the transaction.
2. Read the current integer balance and calculate the next balance using
   `BigInt`; reject above signed MySQL `INT` maximum `2147483647`.
3. Conditionally claim the exact deposit with `updateMany` matching
   `id + tenantId + billeteraId + estado=pendiente`.
4. Conditionally increment the exact wallet matching
   `id + tenantId + userId + currency + previous balance`.
5. Create the deterministic audit movement.
6. Return the freshly persisted approved deposit.

Any failed predicate or write throws and rolls back the state transition,
wallet increment, and movement together.

Concurrent approval behavior:

- one caller wins the conditional deposit claim and credits once;
- a loser reloads the deposit after rollback;
- if the winner committed a valid approved deposit/movement, loser returns the
  HTTP 200 replay;
- otherwise loser returns sanitized HTTP 409 or invariant HTTP 500;
- Prisma `P2034` maps to sanitized HTTP 409 and is never retried internally.

## Exact HTTP error map

| Scenario | HTTP | Public message requirement |
|---|---:|---|
| Missing/malformed/invalid/expired token or invalid persisted auth | 401 | Generic |
| Customer calls admin route | 403 | Generic; before lookup/write |
| Missing/invalid idempotency key, query, body, URL, method, amount, reason | 400 | Sanitized validation |
| Missing/foreign/not-owned deposit or missing canonical wallet | 404 | Uniform resource message |
| Same key/different request | 409 | Idempotency conflict |
| Duplicate tenant/method/payment reference | 409 | Reference already submitted |
| Invalid terminal-state transition or different rejection reason replay | 409 | State conflict |
| Conditional wallet/deposit race or Prisma `P2034` | 409 | Retry/reload message |
| Approval balance exceeds signed MySQL `INT` | 422 | Wallet balance overflow |
| Approved deposit audit invariant is missing/inconsistent | 500 | Generic invariant failure |
| Unknown Prisma/internal failure | 500 | Generic; no database detail |

No Prisma code, SQL, stack, token, fingerprint, balance snapshot, provider data,
or internal identifier may appear in public errors or logs.

## Safe response rules

Public/admin responses are constructed explicitly. Never spread Prisma rows.
Responses must never contain:

- `tiendaId`, `billeteraId`, wallet ID, tenant ID, or currency source;
- `proveedorPago`, `datosProveedor`, fingerprint, raw idempotency key, or hash;
- `aprobadoPorId`, admin ID, session ID, token, or password data;
- `saldoAnterior`, `saldoPosterior`, current wallet balance, or movement row;
- raw Prisma/database errors or unrelated user information.

The admin-only `customer` object is limited to same-tenant `id`, `name`, and
`email`.

## Functional requirements

- **FR-001**: Every route uses the deposits-local guard and current persisted
  principal.
- **FR-002**: Customer create/read/list/cancel is scoped by tenant, wallet owner,
  and tenant currency.
- **FR-003**: Admin routes reject non-admin roles before deposit lookup/write.
- **FR-004**: Both admin roles remain restricted to their authenticated tenant.
- **FR-005**: Only `transferencia` and `criptomoneda` are accepted.
- **FR-006**: Currency always comes from the active persisted tenant.
- **FR-007**: Creation requires the exact idempotency and validation rules.
- **FR-008**: Same-key/same-request returns one deposit; changed payload
  conflicts.
- **FR-009**: Same tenant/method/payment reference can create at most one
  deposit even with different keys or concurrent requests.
- **FR-010**: Creation never changes wallet balance or creates a movement.
- **FR-011**: Customer/admin lists validate filters and use stable pagination.
- **FR-012**: Customer details never reveal another customer or tenant.
- **FR-013**: Admin details never reveal another tenant.
- **FR-014**: Cancellation is owner-only, pending-only, idempotent, and has zero
  monetary side effects.
- **FR-015**: Rejection is same-tenant-admin-only, pending-only, same-reason
  idempotent, and has zero monetary side effects.
- **FR-016**: Approval state, wallet credit, and movement commit atomically.
- **FR-017**: Approval uses exact integer/`BigInt` bounds and audit balances.
- **FR-018**: Sequential/concurrent approval credits exactly once.
- **FR-019**: Approved replay validates the deterministic movement invariant.
- **FR-020**: `P2002`, `P2034`, predicate races, overflow, and unknown errors
  map exactly as specified.
- **FR-021**: DTO/response mappers expose only approved fields.
- **FR-022**: Swagger documents bearer auth, headers, bodies, queries, schemas,
  and every relevant status.
- **FR-023**: No external network/payment/provider call occurs.
- **FR-024**: Existing auth, catalog, order, refund, wallet, and registration
  behavior remains unchanged.

## Mandatory acceptance scenarios

1. Customer creates transfer request; row is pending and wallet is unchanged.
2. Customer creates crypto request with optional HTTPS receipt.
3. Sequential and simulated concurrent same-key replay create one row.
4. Same key with changed amount/method/reference/receipt returns 409.
5. Different keys with the same tenant/method/reference create at most one row.
6. Same reference in another tenant remains independent.
7. Customer lists/reads/cancels only owned same-tenant deposits.
8. Admin lists/reads only same-tenant deposits and receives limited customer
   identity.
9. Customer receives 403 on admin endpoints before any repository lookup.
10. Approval produces exact state, balance, movement, audit creator, and times.
11. Sequential and concurrent approval produce one wallet increment and one
    movement.
12. Approved replay with missing/mismatched movement fails closed.
13. Rejection/cancellation replays and conflicts follow the state table.
14. Overflow, `P2034`, conditional races, and unknown failures produce zero
    partial writes and exact sanitized statuses.
15. Recursive response/error checks find none of the forbidden fields.
16. Existing 283-test baseline plus all new suites pass without open handles.

## Out of scope

- Automatic bank verification, SPEI API, card gateway, Stripe, Mercado Pago,
  Conekta, PayPal, Binance Pay, TronGrid, blockchain polling, webhook, QR, or
  unique deposit address generation.
- Uploading files to object storage; the feature stores only an optional
  validated HTTPS proof URL supplied by the client.
- Deposit instructions, bank-account configuration, exchange rates, fees,
  minimums beyond one minor unit, promotions, bonuses, chargebacks,
  withdrawals, or accounting exports.
- Cross-tenant platform administration.
- Queue, cron, notification, email, frontend, or shared-auth refactor.
- Any schema change beyond the one unique deposit evidence constraint.

## Mandatory stop conditions

Stop without expanding scope if implementation requires:

- another schema field/index/table or destructive migration;
- changing `Billetera`, `MovimientoSaldo`, orders, catalog, auth, or wallet
  behavior;
- an external API/package/network call;
- client-selected tenant/currency/wallet/status/balance/admin/internal JSON;
- accepting unsupported methods;
- rewriting or deleting duplicate historical deposit data;
- more than the exact files allowed in `plan.md`.

Report the blocker instead of improvising.
