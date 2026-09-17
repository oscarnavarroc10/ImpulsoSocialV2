# Tasks: Wallet Read and Manual Admin Credit

**Scope**: Implement only T001–T006. Do not execute Spec Kit commands or begin
deposits, payment gateways, withdrawals, frontend, or another feature.

- [x] **T001 — Isolated module and authentication**: Create `WalletsModule`,
  register it in `AppModule`, and add a wallets-local bearer guard that verifies
  access JWT, active persisted session/user/tenant, matching tenant, and current
  persisted role exactly as defined in `plan.md` — `wallets.module.ts`,
  `wallet-authentication.guard.ts`, `app.module.ts`

- [x] **T002 — Safe customer wallet reads**: Add explicit DTOs plus scoped
  repository/service/controller flows for `GET /v1/wallet` and
  `GET /v1/wallet/movements`; resolve only the tenant-currency wallet, validate
  pagination/type filter, use stable ordering, and expose only approved fields —
  `wallet.dto.ts`, `wallet.repository.ts`, `wallet.service.ts`,
  `wallet.controller.ts`

- [x] **T003 — Durable idempotent manual credit**: Implement same-tenant admin
  credit using the deterministic `MovimientoSaldo.id`, private canonical
  fingerprint, current persisted role, active target/canonical wallet, exact
  `BigInt` balance bounds, and one atomic conditional wallet increment plus
  `ajusteCredito` movement; handle replay, payload conflict, `P2002`, wallet
  race, and overflow exactly as specified — `wallet.repository.ts`,
  `wallet.service.ts`

- [x] **T004 — Admin HTTP contract**: Add guarded
  `POST /v1/admin/wallet-credits` with required validated `Idempotency-Key`,
  exact body/response DTOs, service-selected HTTP 201/200, role/tenant boundary,
  recursive private-field exclusion, and complete Swagger responses without
  changing global routing — `wallet.dto.ts`, `wallet.controller.ts`

- [x] **T005 — Focused proof**: Add exactly two focused suites proving guard
  failures/current-role use, customer reads, validation, tenant isolation,
  deterministic idempotency, first credit, replay/conflict/P2002 race, exact
  balances and audit movement, overflow/rollback, safe HTTP/Swagger shapes, and
  zero deposit/order/provider side effects — `wallet.service.spec.ts`,
  `wallet.controller.spec.ts`

- [x] **T006 — Validation and stop**: Run every build/lint/focused/full/root
  command in `plan.md`; confirm the existing 255-test baseline still passes,
  mark T001–T006 `[x]`, report exact counts and changed files, and stop without
  starting deposits/payments or another feature.

## Definition of Done

- Customers can read only their own canonical wallet and movements.
- Same-tenant administrators can credit an active customer exactly once.
- Replays cannot duplicate money and conflicting key reuse cannot alter money.
- Currency, tenant, balances, audit creator/type and fingerprint are
  server-controlled.
- Responses contain no private/auth/provider/idempotency fields.
- Existing auth/catalog/order/refund behavior remains unchanged.
- No schema, migration, `Deposito`, dependency, external call, or unrelated
  change exists.

## Mandatory Stop Conditions

Stop without editing if implementation requires schema/migration, `Deposito`,
dependency, shared-auth/orders/catalog refactor, client-selected currency or
tenant, cross-tenant credit, non-integer money, external call, or more than the
nine approved production/test files.
