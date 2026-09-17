# Implementation Plan: Wallet Read and Manual Admin Credit

**Branch**: `feature/008-wallet-management`  
**Spec**: `specs/008-wallet-management/spec.md`

## Strategy

Add one isolated `WalletsModule`. Reuse exported auth services/repositories but
do not modify authentication, orders, catalog, Prisma schema, or deposits.

### 1. Module and wallets-local authentication

Create:

```text
backend/src/modules/wallets/
├── application/
│   ├── dto/wallet.dto.ts
│   └── wallet.service.ts
├── infrastructure/wallet.repository.ts
├── presentation/wallet.controller.ts
├── security/wallet-authentication.guard.ts
└── wallets.module.ts
```

`WalletsModule` imports `AuthModule`, provides its own `PrismaService`, guard,
repository and service, and registers both controller classes from the single
controller file. Add only `WalletsModule` to `AppModule`.

The guard mirrors the current `OrderAuthenticationGuard` validation and uses
`AuthTokenService`, `SesionRepository`, `UsuarioRepository`, and
`PrismaService`. It must use the current persisted role rather than trusting
the JWT role claim.

### 2. DTO and safe mapping

Define validated/documented DTOs for:

- wallet balance;
- movement item and paginated response;
- movement query (`page`, `limit`, optional `type`);
- admin credit request (`userId`, `amount`);
- admin credit receipt.

All money is `{ amount: integerMinorUnits, currency: string }`. Public mappers
use explicit object construction; never spread Prisma rows.

Movement responses contain exactly:

```text
id, type, amount, balanceAfter, description, createdAt
```

The admin receipt contains exactly:

```text
id, userId, amount, balanceAfter, createdAt
```

### 3. Repository reads

Implement scoped methods to:

1. Resolve the active tenant currency.
2. Resolve the authenticated user's canonical wallet.
3. Count/list that wallet's movements with optional exact enum filter and
   `creadoEn DESC, id DESC` ordering.
4. Resolve an active same-tenant target user's canonical wallet.
5. Load an existing deterministic manual-credit movement with its wallet's
   tenant/user/currency and private fingerprint reference for replay checks.

Every lookup must contain enough persisted scope to prevent cross-tenant or
cross-user access. Return explicit safe internal shapes.

### 4. Durable manual credit

In `WalletService.credit()`:

1. Reject roles other than `administradorTienda` and
   `administradorPlataforma` before repository target lookup.
2. Normalize/validate the idempotency key with
   `^[A-Za-z0-9._:-]{8,128}$`; the controller separately requires the header.
3. Trim target user ID; calculate deterministic movement ID/key hash and
   canonical request fingerprint exactly as `spec.md`.
4. Pre-check by movement ID: same request returns `{ statusCode: 200 }`;
   different request returns HTTP 409.
5. Resolve the active same-tenant target/canonical wallet; missing/inactive/
   foreign returns uniform HTTP 404.
6. Execute the repository credit transaction and return HTTP 201.
7. On `P2002`, reload the winner and apply the same replay/conflict rule.
8. Map integer overflow to HTTP 422 and conditional concurrent-wallet change to
   sanitized HTTP 409. Propagate no database/internal detail.

The repository transaction reads the scoped current balance, validates the
next balance with `BigInt`, creates the deterministic movement as the durable
claim, and conditionally increments the unchanged active scoped wallet. Either
both persist or both roll back.

Do not retry internally. A client may replay the same key safely.

### 5. Controllers and Swagger

Create two controller classes in `wallet.controller.ts`:

- `WalletController` under `v1/wallet` for GET balance and GET movements.
- `AdminWalletCreditController` under `v1/admin/wallet-credits` for POST.

Apply the same wallets-local guard and bearer Swagger declaration. The POST
controller requires `Idempotency-Key`, delegates role enforcement to the
service, and writes service-selected HTTP 200/201 status exactly like the
existing order creation controller.

No global prefix or `main.ts` change is required; the paths include `v1`.

### 6. Focused tests

Create only:

```text
backend/test/unit/wallets/wallet.service.spec.ts
backend/test/contract/wallets/wallet.controller.spec.ts
```

The unit suite covers repository/service/guard behavior with typed fakes:

- canonical wallet and tenant/user scoping;
- balance and movement safe mapping;
- pagination, filter and stable order;
- persisted current role and every auth rejection;
- customer 403 before repository access;
- deterministic ID/fingerprint without raw-key persistence;
- first credit exact balances/audit creator/type;
- replay, conflict and simulated P2002 race;
- target tenant/status boundary and missing wallet;
- conditional wallet race rollback and integer overflow;
- no `Deposito`, order, provider, or external calls.

The contract suite covers DTO validation, headers, HTTP statuses, route/guard
metadata, Swagger schemas, service delegation, pagination and recursive
forbidden-key checks.

## Allowed files

```text
backend/src/app.module.ts
backend/src/modules/wallets/wallets.module.ts
backend/src/modules/wallets/application/dto/wallet.dto.ts
backend/src/modules/wallets/application/wallet.service.ts
backend/src/modules/wallets/infrastructure/wallet.repository.ts
backend/src/modules/wallets/presentation/wallet.controller.ts
backend/src/modules/wallets/security/wallet-authentication.guard.ts
backend/test/unit/wallets/wallet.service.spec.ts
backend/test/contract/wallets/wallet.controller.spec.ts
specs/008-wallet-management/tasks.md
```

Nine production/test files are the maximum. `tasks.md` is documentation and is
not counted.

## Validation

Run from `backend`:

```bash
npm run build

npx eslint \
  src/app.module.ts \
  src/modules/wallets/wallets.module.ts \
  src/modules/wallets/application/dto/wallet.dto.ts \
  src/modules/wallets/application/wallet.service.ts \
  src/modules/wallets/infrastructure/wallet.repository.ts \
  src/modules/wallets/presentation/wallet.controller.ts \
  src/modules/wallets/security/wallet-authentication.guard.ts \
  test/unit/wallets/wallet.service.spec.ts \
  test/contract/wallets/wallet.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/wallets/wallet.service.spec.ts \
  test/contract/wallets/wallet.controller.spec.ts

npm test -- --runInBand --detectOpenHandles
```

Then from repository root:

```bash
git diff --check
git status --short
git diff --stat
```

Only after every command succeeds may T001–T006 be marked complete.

## Stop conditions

Stop and report without expanding scope if implementation needs schema,
migration, `Deposito`, dependency, shared-auth refactor, orders/catalog change,
cross-tenant credit, new external integration, or a tenth production/test file.
