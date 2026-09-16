# Feature Specification: Wallet Read and Manual Admin Credit

**Feature Branch**: `feature/008-wallet-management`  
**Created**: 2026-09-10  
**Status**: Approved — focused MVP funding slice

## Goal

Let an authenticated customer see their own tenant-currency wallet and ledger,
and let an authenticated administrator credit an active customer in the same
tenant exactly once. This enables real MVP order testing without pretending a
payment gateway or automatic deposit integration exists.

Reuse the existing `Billetera`, `MovimientoSaldo`, `Tienda`, `Usuario`, JWT,
session, and integer-minor-unit money model. Do not modify `Deposito`, Prisma
schema, migrations, orders, catalog, or authentication behavior.

## Public API

### Get the authenticated customer's wallet

```http
GET /v1/wallet
Authorization: Bearer <access-token>
```

HTTP 200:

```json
{
  "balance": {
    "amount": 100000,
    "currency": "MXN"
  }
}
```

The wallet is the one whose currency equals the authenticated tenant's current
configured currency.

### List the authenticated customer's movements

```http
GET /v1/wallet/movements?page=1&limit=20&type=compra
Authorization: Bearer <access-token>
```

HTTP 200:

```json
{
  "items": [
    {
      "id": "movement-id",
      "type": "compra",
      "amount": { "amount": 15000, "currency": "MXN" },
      "balanceAfter": { "amount": 85000, "currency": "MXN" },
      "description": null,
      "createdAt": "2026-09-10T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

`page` defaults to 1, `limit` defaults to 20 and cannot exceed 100. Optional
`type` accepts only `TipoMovimientoSaldo` values. Ordering is `creadoEn DESC`,
then `id DESC`.

### Credit a customer manually

```http
POST /v1/admin/wallet-credits
Authorization: Bearer <access-token>
Idempotency-Key: admin-credit-unique-key
Content-Type: application/json

{
  "userId": "target-user-id",
  "amount": 50000
}
```

Only current persisted roles `administradorTienda` and
`administradorPlataforma` may call this endpoint. Both roles remain restricted
to active users and the canonical wallet in their own authenticated tenant.

First success returns HTTP 201. Same-key/same-request replay returns HTTP 200:

```json
{
  "id": "manual-credit-movement-id",
  "userId": "target-user-id",
  "amount": { "amount": 50000, "currency": "MXN" },
  "balanceAfter": { "amount": 150000, "currency": "MXN" },
  "createdAt": "2026-09-10T12:00:00.000Z"
}
```

The request cannot select tenant, currency, role, movement type, previous/new
balance, creator, description, or status.

## Authentication and authorization

Create a wallets-local guard following the current orders guard behavior:

1. Require a Bearer access token.
2. Verify access-token signature, expiry, and `tipo='access'`.
3. Verify persisted session exists, belongs to `sub`, is unrevoked and unexpired.
4. Load the current persisted user; require `estado='activo'` and the same
   tenant as the token.
5. Require the persisted tenant to be active.
6. Attach only current persisted `{ userId, tenantId, role }` to the request.

Authentication failures return generic HTTP 401. Customer wallet reads require
no administrative role. Manual credit checks the current persisted role and
returns HTTP 403 before target lookup or any write when insufficient.

## Durable idempotency without a migration

The existing `MovimientoSaldo.id` primary key is the durable idempotency claim.

- Normalize and validate `Idempotency-Key` with the existing orders rule:
  `^[A-Za-z0-9._:-]{8,128}$`.
- Calculate `keyHash = SHA-256(JSON.stringify([tenantId, normalizedKey]))`.
- Use movement ID `manual-credit:<keyHash>`.
- Calculate `requestFingerprint =
  SHA-256(JSON.stringify([normalizedTargetUserId, amount]))`.
- Store only `manual-credit:<requestFingerprint>` in the internal movement
  `referencia`. Never store or return the raw idempotency key.

Before a new credit, look up the deterministic movement ID. Same fingerprint
returns replay without another wallet update; different fingerprint returns
HTTP 409. If concurrent creation reaches database primary-key conflict, reload
the winning movement and apply the same replay/conflict comparison.

This decision is intentionally limited to manual credit. Future external
payment deposits will receive their own provider-reference design.

## Atomic credit transaction

For a new authorized request:

1. Resolve the active target user, active tenant currency, and matching wallet
   using server-derived tenant scope.
2. Read the current integer balance and calculate the next balance with
   `BigInt`; reject values above signed MySQL `INT` maximum `2147483647`.
3. In one transaction, create the deterministic `MovimientoSaldo` with:
   `tipo=ajusteCredito`, positive `monto`, exact `saldoAnterior`, exact
   `saldoPosterior`, static `descripcion='Crédito manual'`, the fingerprint
   reference, and `creadoPorId` equal to the authenticated administrator.
4. Conditionally increment the exact wallet only if its persisted balance still
   equals the read balance and the tenant/user/currency/active predicates still
   match.
5. If the wallet changed concurrently, roll back the movement and return a
   sanitized HTTP 409 instructing a retry with the same key.

Any failure rolls back both the movement and balance. No separate prior read
alone authorizes a write.

## Functional requirements

- **FR-001**: Every route uses the wallets-local authentication guard and only
  server-derived tenant/user/role.
- **FR-002**: Wallet and movement reads include authenticated tenant, user, and
  tenant currency scope.
- **FR-003**: Missing canonical own wallet returns uniform HTTP 404.
- **FR-004**: Pagination/filter validation follows the exact contract above;
  invalid input returns HTTP 400.
- **FR-005**: Wallet responses expose only approved fields and never wallet ID,
  tenant ID, user ID, `saldoAnterior`, `referencia`, `creadoPorId`, provider
  data, tokens, or idempotency data.
- **FR-006**: Manual credit accepts only trimmed non-empty `userId` and integer
  minor-unit `amount` from 1 through 2147483647.
- **FR-007**: `cliente` receives HTTP 403 before target lookup or writes.
- **FR-008**: Administrators may credit only an active user and canonical wallet
  in their own active tenant; missing, inactive, or foreign targets return the
  same HTTP 404.
- **FR-009**: Currency always comes from the persisted tenant and is never
  client-selected.
- **FR-010**: First credit creates exactly one balance increment and one
  `ajusteCredito` movement atomically.
- **FR-011**: Sequential and concurrent same-key/same-request replays perform no
  additional write and return HTTP 200.
- **FR-012**: Same key with a different user or amount returns HTTP 409 with no
  write.
- **FR-013**: Balance overflow and concurrent different credits fail closed and
  roll back every write.
- **FR-014**: The admin receipt exposes only the approved response fields; it
  never exposes the raw key, hashes, fingerprint, wallet ID, tenant ID, admin
  ID, previous balance, or internal reference.
- **FR-015**: Existing auth, catalog, order, status, refund, and registration
  wallet-creation behavior remains unchanged.
- **FR-016**: Swagger documents bearer auth, query/body/header validation,
  response DTOs, and relevant 200/201/400/401/403/404/409/422 responses.

## Acceptance scenarios

1. A customer reads only their canonical wallet balance and movements.
2. Filters, pagination, and stable ordering work without writes.
3. A tenant administrator credits an active same-tenant customer; balance and
   movement commit once and exact audit balances are correct.
4. A platform administrator is subject to the same tenant boundary.
5. A customer, foreign target, inactive target, missing wallet, invalid amount,
   or overflow produces zero monetary side effects.
6. Sequential and simulated concurrent identical requests credit once; reuse
   with a different payload conflicts.
7. Recursive response checks find none of the forbidden fields.
8. Existing 255-test baseline and new focused suites pass without open handles.

## Out of scope

- Customer deposit request, bank transfer, card, cryptocurrency, webhook,
  payment provider, automatic deposit, withdrawal, debit adjustment, or admin
  balance replacement.
- Modifying or exposing `Deposito`.
- Cross-tenant platform-admin credit.
- Multi-currency wallet selection or currency conversion.
- New schema fields, indexes, migrations, dependencies, shared-auth refactor,
  frontend changes, notifications, rate limiting, or reporting.

## Mandatory stop conditions

Stop without editing if implementation requires Prisma schema/migration,
`Deposito`, new package, shared auth/orders/catalog refactor, cross-tenant
credit, client-selected currency/tenant/balance, non-integer money, live
external call, or more than nine production/test files. Report the blocker
instead of expanding scope.
