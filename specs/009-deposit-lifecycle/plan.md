# Implementation Plan: Manual Deposit Lifecycle

**Branch**: `feature/009-deposit-lifecycle`  
**Spec**: `specs/009-deposit-lifecycle/spec.md`

## Implementation strategy

Add one isolated `DepositsModule` and one additive unique index. Reuse the
existing auth/session repositories, `PrismaService`, `Deposito`, `Billetera`,
and `MovimientoSaldo`. Do not modify orders, catalog, existing wallets behavior,
global routing, or external integrations.

This is a larger feature, but it remains one cohesive transaction domain:
manual deposit request → review → exactly-once wallet credit.

## Constitution and architecture gates

- **Specification first**: request/response shapes, state transitions,
  idempotency, error mapping, and transaction ordering are fixed in `spec.md`.
- **Tenant isolation**: every lookup contains persisted tenant plus owner/role
  scope. Platform admin is not cross-tenant.
- **Money integrity**: integer minor units only; `BigInt` before conversion;
  approval and audit movement commit in one transaction.
- **Idempotency**: deterministic request ID plus unique payment evidence plus
  conditional state transition.
- **Fail closed**: missing audit invariant, unexpected Prisma error, or unknown
  state never triggers compensating guesses.
- **No pretend automation**: there are no payment-provider calls or claims that
  payment was externally verified.

## Persistence change

### Prisma schema

Add only this rule inside `model Deposito`:

```prisma
@@unique(
  [tiendaId, proveedorPago, referenciaExterna],
  map: "depositos_tienda_proveedor_referencia_key"
)
```

Keep every existing field, enum, relation, and index unchanged.

### Preflight duplicate check

Before creating/applying the migration, run against the configured development
database:

```sql
SELECT
  `tiendaId`,
  `proveedorPago`,
  `referenciaExterna`,
  COUNT(*) AS `duplicateCount`
FROM `depositos`
WHERE `proveedorPago` IS NOT NULL
  AND `referenciaExterna` IS NOT NULL
GROUP BY `tiendaId`, `proveedorPago`, `referenciaExterna`
HAVING COUNT(*) > 1;
```

Expected result: zero rows. If rows exist, stop and report; never mutate them
automatically.

### Migration

Create one directory following repository timestamp conventions, for example:

```text
backend/prisma/migrations/20260917120000_add_deposit_reference_uniqueness/
└── migration.sql
```

The migration contains only:

```sql
CREATE UNIQUE INDEX `depositos_tienda_proveedor_referencia_key`
ON `depositos`(`tiendaId`, `proveedorPago`, `referenciaExterna`);
```

No data update, delete, enum change, or table recreation is permitted.

## File layout and allowed files

```text
backend/prisma/schema.prisma
backend/prisma/migrations/<timestamp>_add_deposit_reference_uniqueness/migration.sql
backend/src/app.module.ts
backend/src/modules/deposits/deposits.module.ts
backend/src/modules/deposits/application/dto/deposit.dto.ts
backend/src/modules/deposits/application/deposit.service.ts
backend/src/modules/deposits/infrastructure/deposit.repository.ts
backend/src/modules/deposits/presentation/deposit.controller.ts
backend/src/modules/deposits/security/deposit-authentication.guard.ts
backend/test/unit/deposits/deposit.service.spec.ts
backend/test/unit/deposits/deposit.repository.spec.ts
backend/test/contract/deposits/deposit.controller.spec.ts
specs/009-deposit-lifecycle/tasks.md
```

Exactly twelve production/test/persistence files are allowed, plus
`tasks.md`. The migration directory name may use the current timestamp. No
other file may be modified.

## Module and authentication

Create `DepositsModule`:

- imports `AuthModule`;
- controllers: `DepositController`, `AdminDepositController`;
- providers: `PrismaService`, `DepositRepository`, `DepositService`,
  `DepositAuthenticationGuard`;
- no exports are required.

Add only `DepositsModule` to `AppModule`.

The deposits-local guard mirrors the wallets guard and attaches:

```ts
interface DepositPrincipal {
  userId: string;
  tenantId: string;
  role: string;
}
```

It must verify every persisted auth condition in `spec.md`. It must not import,
modify, or refactor the wallets/orders guards.

## DTO design

### Request DTOs

- `CreateDepositDto`
  - `amount`: `@Type(() => Number)`, `@IsInt`, `@Min(1)`,
    `@Max(2147483647)`.
  - `method`: dedicated public enum/validator accepting only
    `transferencia | criptomoneda`.
  - `paymentReference`: trim, `@IsString`, `@MinLength(3)`,
    `@MaxLength(128)`, non-empty.
  - `receiptUrl`: optional transform trim/empty-to-undefined, `@IsUrl` requiring
    HTTPS, `@MaxLength(2048)`.
- `DepositListQueryDto`
  - page/limit validation identical to wallet list;
  - optional exact status;
  - optional exact supported method.
- `AdminDepositListQueryDto extends DepositListQueryDto`
  - optional trimmed non-empty `userId`, maximum 128.
- `RejectDepositDto`
  - trimmed reason, 3–500 characters.

Do not accept DTO fields for any internal column.

### Response DTOs

Define explicit Swagger DTOs for:

- `DepositMoneyDto`;
- `DepositResponseDto`;
- `DepositCustomerDto`;
- `AdminDepositResponseDto`;
- customer/admin paginated responses;
- pagination metadata.

Map every response through explicit object construction. Use ISO serialization
through normal Nest/Express JSON handling; internal values remain `Date`.

## Internal repository shapes

Repository methods return narrow internal interfaces instead of raw Prisma
objects. Separate safe/public mapping remains in the service.

Minimum methods:

```text
findTenantCurrency(tenantId)
findCanonicalWallet(tenantId, userId, currency)
findCreationClaim(depositId, tenantId, userId)
findByEvidence(tenantId, provider, reference)
createPending(input)
countOwn(scope, filters)
listOwn(scope, filters, skip, take)
findOwnById(scope, depositId)
cancelOwnPending(scope, depositId)
countAdmin(tenantId, filters)
listAdmin(tenantId, filters, skip, take)
findAdminById(tenantId, depositId)
approve(input)
reject(input)
findApprovalInvariant(tenantId, depositId)
```

Equivalent names are acceptable only if responsibilities and predicates remain
identical.

Every deposit lookup joins/scopes through its wallet owner. Customer scope is:

```text
Deposito.tiendaId = principal.tenantId
Deposito.billetera.usuarioId = principal.userId
Deposito.billetera.tiendaId = principal.tenantId
Deposito.billetera.moneda = active tenant currency
```

Admin scope omits the owner equality but retains tenant and canonical wallet
consistency. Admin rows select only `customer.id/name/email` plus fields needed
for internal decisions.

## Create algorithm

In `DepositService.create(dto, key, principal)`:

1. Normalize/validate key. Invalid key throws `BadRequestException` before any
   repository call.
2. Normalize reference and optional receipt URL.
3. Map method to exact internal provider:
   - transferencia → `manual-transfer`
   - criptomoneda → `manual-crypto`
4. Resolve active tenant currency and own canonical wallet.
5. Compute deterministic `depositId` and fingerprint exactly as `spec.md`.
6. Pre-check `findCreationClaim`:
   - same valid internal kind/fingerprint → HTTP 200 replay;
   - different/malformed internal fingerprint → HTTP 409.
7. Pre-check unique evidence; any existing same tenant/provider/reference →
   HTTP 409.
8. Call `createPending`, which revalidates active tenant/user/canonical wallet
   inside a transaction or one authoritative nested create query.
9. Return HTTP 201.
10. On `P2002`, reload deterministic ID first, then evidence as specified.
11. Unknown error → generic HTTP 500.

Creation writes exactly one `Deposito` and zero wallet/movement rows.

## Read algorithms

For customer and admin lists:

1. Validate/default query in DTO.
2. Resolve tenant currency once.
3. Execute scoped count/list consistently.
4. Map safe items and pagination.
5. Empty valid list returns HTTP 200 with `items=[]` and `totalPages=0`.

Details use scoped repository queries and return uniform 404.

Repository ordering must be:

```ts
orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }]
```

## Cancellation algorithm

In a transaction or conditional repository method:

1. Load owned scoped deposit.
2. Missing → 404.
3. `cancelado` → HTTP 200 replay.
4. `aprobado|rechazado` → 409.
5. Conditionally update exact owned `pendiente` row to `cancelado`.
6. If count is zero, reload and apply steps 2–4.
7. Never touch wallet/movement.

## Approval algorithm

### Pre-check/replay

Service requires admin role before repository lookup.

- Missing/foreign → 404.
- `rechazado|cancelado` → 409.
- `aprobado` → load invariant and verify all of:
  - movement ID is `deposit-credit:<depositId>`;
  - movement wallet equals deposit wallet;
  - type is `deposito`;
  - amount equals deposit amount;
  - reference equals deposit ID;
  - movement resulting balance is a valid signed integer.
- Valid invariant → HTTP 200 replay.
- Missing/inconsistent invariant → generic HTTP 500, no writes.

### Approval transaction

Repository transaction order is fixed:

1. Resolve active tenant with expected currency.
2. Resolve deposit plus active owner and matching canonical wallet.
3. Require `estado=pendiente`.
4. Read current balance; calculate `nextBalance` with `BigInt` and validate
   `<= 2147483647n`.
5. Claim deposit using conditional `updateMany`; set `aprobado`, admin ID, and
   transaction timestamp; clear rejection fields.
6. Increment wallet using conditional `updateMany` including previous balance.
7. Create deterministic `MovimientoSaldo.deposit` with exact audit fields.
8. Re-read/return deposit safe internal shape.

Throw typed internal errors for not found, decision race, wallet race, overflow,
and invariant failure. Throwing from the callback must roll back every write.

Service error mapping:

```text
DepositNotFoundError      → 404
DepositStateConflictError → 409
DepositDecisionRaceError  → reload and replay/conflict
DepositWalletRaceError    → 409 retry/reload
DepositBalanceOverflow    → 422
Prisma P2034              → 409 retry/reload, no internal retry
unknown                   → 500 generic
```

## Rejection algorithm

1. Require admin role before lookup.
2. Normalize reason.
3. Missing/foreign → 404.
4. Existing `rechazado` with same reason → HTTP 200 replay.
5. Existing `rechazado` with different reason or approved/canceled → 409.
6. Conditional same-tenant update from pending to rejected with admin ID not
   required in `aprobadoPorId`; set only reason/rejected timestamp and keep
   approval fields null.
7. On zero-count race, reload and repeat state comparison.
8. No wallet/movement operation is allowed in the rejection method.

## Controllers and Swagger

Create two controller classes in one file.

### `DepositController` — `@Controller('v1/deposits')`

```text
POST   /
GET    /
GET    /:id
POST   /:id/cancel
```

### `AdminDepositController` — `@Controller('v1/admin/deposits')`

```text
GET    /
GET    /:id
POST   /:id/approve
POST   /:id/reject
```

Apply guard and `@ApiBearerAuth()` to both classes. Document exact response DTOs
and relevant 200/201/400/401/403/404/409/422/500 statuses. Create uses an
Express response only if needed to select 200 versus 201; other operations use
normal Nest return values.

No `main.ts` or global prefix change.

## Required test suites

Create exactly three suites:

```text
backend/test/unit/deposits/deposit.service.spec.ts
backend/test/unit/deposits/deposit.repository.spec.ts
backend/test/contract/deposits/deposit.controller.spec.ts
```

### Service/guard suite — mandatory named behaviors

At minimum prove separately:

1. persisted current role is used instead of JWT role;
2. missing/wrong bearer, invalid token, missing/mismatched/revoked/expired
   session, inactive/mismatched user, and inactive tenant each return 401;
3. customer is rejected from admin operations before repository access;
4. tenant admin and platform admin are allowed only in current tenant;
5. invalid key returns 400 before repository access;
6. method/reference/receipt normalization and deterministic hashes are exact;
7. raw key is absent from repository input and public response;
8. first create is 201 and performs no monetary operation;
9. same request replay is 200; every changed fingerprint component conflicts;
10. `P2002` same-key winner replays;
11. `P2002` fingerprint conflict returns 409;
12. `P2002` duplicate evidence returns 409;
13. own/admin pagination, filters, stable scope, and safe mapping;
14. foreign owner/tenant details return uniform 404;
15. cancel first/replay/conflict/race has no monetary call;
16. approve first/replay/terminal conflict/race maps exactly;
17. approved replay with missing/wrong movement fails 500;
18. reject first/same-reason replay/different-reason/terminal conflict;
19. `P2034`, overflow, wallet race, and unknown errors map exactly;
20. recursive response and public-error checks contain no forbidden key/detail.

### Repository suite — mandatory transaction proof

At minimum prove separately:

1. every own query contains tenant + owner + currency scope;
2. every admin query contains tenant + currency scope;
3. list filters and exact stable ordering reach Prisma;
4. creation writes exact pending/provider/reference/internal fingerprint fields;
5. approval revalidates active tenant and active same-tenant wallet owner;
6. `BigInt` overflow occurs before any update/create;
7. claim predicate contains deposit ID, tenant, wallet, and pending state;
8. wallet predicate contains wallet ID, tenant, user, currency, previous balance;
9. movement contains exact deterministic ID/type/amount/balances/reference/admin;
10. zero deposit claim, zero wallet update, or movement failure throws and
    rejects the transaction callback;
11. cancellation and rejection contain no wallet/movement invocation;
12. invariant query checks deterministic movement and all required fields.

### Contract suite — mandatory HTTP/Swagger proof

At minimum prove separately:

1. all eight routes and HTTP methods;
2. guard metadata on both controller classes;
3. bearer/header/body/query/param DTO validation;
4. amount boundaries, method allow-list, reference/reason lengths, HTTPS-only
   receipt, pagination limits, and exact enums;
5. create writes service-selected 201/200;
6. all controller methods delegate exact principal/input/query;
7. Swagger documents response schemas and required status codes;
8. recursive forbidden-field scan for customer and admin response examples.

The three suites must contain **at least 45 tests total**. A parameterized row
counts as one Jest test per row. The count is a floor, not a substitute for any
listed behavior.

## Validation commands

Run from repository root first:

```bash
git diff --check
git status --short
```

Run from `backend`:

```bash
npx prisma format
npx prisma validate
npx prisma generate

npm run build

npx eslint \
  src/app.module.ts \
  src/modules/deposits/deposits.module.ts \
  src/modules/deposits/application/dto/deposit.dto.ts \
  src/modules/deposits/application/deposit.service.ts \
  src/modules/deposits/infrastructure/deposit.repository.ts \
  src/modules/deposits/presentation/deposit.controller.ts \
  src/modules/deposits/security/deposit-authentication.guard.ts \
  test/unit/deposits/deposit.service.spec.ts \
  test/unit/deposits/deposit.repository.spec.ts \
  test/contract/deposits/deposit.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/deposits/deposit.service.spec.ts \
  test/unit/deposits/deposit.repository.spec.ts \
  test/contract/deposits/deposit.controller.spec.ts

npm test -- --runInBand --detectOpenHandles
```

Then from repository root:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-only
```

The pre-feature baseline is 21 suites / 283 tests. Final regression must be at
least 24 suites / 328 tests, with zero failures and no open-handle warning.

## Required final report

The implementation agent must report:

- exact changed/created files;
- preflight duplicate-query result;
- Prisma format/validate/generate results;
- build and focused ESLint results;
- focused suite/test count;
- complete suite/test count;
- `git diff --check` result;
- confirmation of zero external calls;
- confirmation that only T001–T009 were attempted.

Do not commit or push automatically.

## Mandatory stop conditions

Stop and report without editing outside scope if:

- the duplicate preflight query returns rows;
- the schema needs anything beyond the one specified unique constraint;
- a new dependency, external call, shared-auth refactor, or additional file is
  considered necessary;
- implementation would accept card/manual-balance/other methods;
- implementation would mutate historical duplicate data;
- tests cannot demonstrate the exact monetary transaction predicates;
- more than the twelve allowed production/test/persistence files are needed.
