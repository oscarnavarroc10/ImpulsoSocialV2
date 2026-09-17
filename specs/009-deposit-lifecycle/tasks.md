# Tasks: Manual Deposit Lifecycle

**Scope**: Implement only T001–T009. This is the final manual-funding MVP slice.
Do not execute Spec Kit commands, start automatic payments, or modify another
feature.

## Non-negotiable execution rules

- Read `spec.md` and `plan.md` completely before editing.
- Inspect only the existing files directly required to mirror auth/module/DTO
  conventions and the exact files listed in `plan.md`.
- Do not mark a task `[x]` because code compiles; mark it only after its named
  tests exist and pass.
- Never replace a required test with a comment, broad aggregate assertion, or
  an assertion only against a hand-written safe fixture.
- Do not commit, push, call an external service, or run Spec Kit.
- Stop immediately on any Mandatory Stop Condition.

## Phase 1 — Persistence gate

- [x] **T001 — Unique payment-evidence migration**: Run the exact duplicate
  preflight query from `plan.md`; if it returns zero rows, add only the named
  `Deposito` unique constraint, generate one additive migration containing only
  the expected `CREATE UNIQUE INDEX`, and run Prisma format/validate/generate —
  `backend/prisma/schema.prisma`,
  `backend/prisma/migrations/<timestamp>_add_deposit_reference_uniqueness/migration.sql`

**T001 proof required**:

- Report preflight row count.
- `schema.prisma` contains exactly one intended rule change.
- Migration contains no `DROP`, `DELETE`, `UPDATE`, table recreation, or other
  index/column change.
- Prisma format, validate, and generate succeed.

## Phase 2 — Isolated module and current authentication

- [x] **T002 — Deposits module and guard**: Create the isolated module, add only
  `DepositsModule` to `AppModule`, and implement the deposits-local guard that
  validates bearer access token, persisted session/user/tenant, active states,
  tenant match, and current persisted role exactly as specified —
  `backend/src/app.module.ts`,
  `backend/src/modules/deposits/deposits.module.ts`,
  `backend/src/modules/deposits/security/deposit-authentication.guard.ts`

**T002 proof required**:

- Current persisted role is attached; JWT role is ignored.
- Missing/wrong bearer, invalid/expired token, missing/mismatched/revoked/
  expired session, missing/inactive/mismatched user, and inactive tenant each
  have a named 401 test.
- No existing guard/auth source file is changed.

## Phase 3 — Customer request and read lifecycle

- [x] **T003 — Exact DTOs and safe mappers**: Implement only the request/query/
  response DTOs defined in `plan.md`, including manual-method allow-list,
  integer bounds, trimmed reference/reason, HTTPS-only optional receipt,
  pagination, Swagger properties, and explicit public/admin response shapes —
  `backend/src/modules/deposits/application/dto/deposit.dto.ts`

- [x] **T004 — Idempotent creation and customer reads**: Implement deterministic
  deposit ID/fingerprint, active tenant/user/canonical-wallet resolution,
  first-create/replay/conflict behavior, duplicate-evidence protection,
  P2002 classification, safe own list/detail pagination, and zero monetary side
  effects during creation —
  `backend/src/modules/deposits/application/deposit.service.ts`,
  `backend/src/modules/deposits/infrastructure/deposit.repository.ts`

**T003–T004 proof required**:

- Invalid key returns 400 before any repository call.
- Exact hashes are asserted from canonical arrays.
- Repository input and serialized responses contain no raw idempotency key.
- Same-key replay and all changed fingerprint components are tested.
- Different keys with identical tenant/method/reference reach the unique
  evidence conflict path.
- Creation tests assert zero wallet update and zero movement create.
- Own list/detail repository predicates contain tenant, owner, and currency.
- List tests assert `creadoEn DESC, id DESC`, every filter, defaults, limit 100,
  and empty pagination.

## Phase 4 — State transitions and money

- [x] **T005 — Customer cancellation and admin rejection**: Implement owned
  pending cancellation plus same-tenant admin pending rejection, including
  idempotent same-result replay, different-reason/terminal-state conflicts,
  zero-count race reload, and zero wallet/movement effects —
  `backend/src/modules/deposits/application/deposit.service.ts`,
  `backend/src/modules/deposits/infrastructure/deposit.repository.ts`

- [x] **T006 — Exactly-once approval**: Implement admin-role-first authorization,
  approved invariant replay, and the exact one-transaction deposit claim +
  conditional wallet increment + deterministic deposit movement. Handle
  `P2034`, state/wallet races, overflow, missing/foreign resources, and unknown
  failures using the exact HTTP map —
  `backend/src/modules/deposits/application/deposit.service.ts`,
  `backend/src/modules/deposits/infrastructure/deposit.repository.ts`

**T005–T006 proof required**:

- Customer role is denied before admin repository lookup.
- Both admin roles are accepted but same-tenant scoped.
- Cancel/reject first attempt, valid replay, invalid replay, terminal conflict,
  and conditional race each have named tests.
- Cancellation/rejection tests assert no wallet/movement call.
- Approval repository test asserts every field of the deposit claim predicate,
  wallet predicate, and movement payload.
- Overflow occurs before any update/create.
- Each injected failure rejects the transaction callback.
- Sequential/concurrent approval simulations prove one credit/movement.
- Valid approved replay returns 200; every missing/mismatched invariant returns
  generic 500 with no write.
- P2034 returns sanitized 409; unknown Prisma/internal failure returns generic
  500; neither exposes its original message.

## Phase 5 — HTTP contract

- [x] **T007 — Customer/admin controllers and Swagger**: Add exactly the eight
  routes from `plan.md`, apply guard/bearer metadata to both controllers,
  require the idempotency header on create, select HTTP 201/200 from service,
  delegate exact queries/principals, and document exact schemas/statuses —
  `backend/src/modules/deposits/presentation/deposit.controller.ts`

**T007 proof required**:

- Route/method metadata checks cover all eight routes.
- Controller-class guard and bearer metadata are asserted.
- Missing/invalid header/body/query/param cases produce expected validation.
- Swagger schema/status metadata includes 200/201/400/401/403/404/409/422/500
  wherever relevant.
- Recursive checks against actual service-mapped customer/admin objects find no
  forbidden fields.

## Phase 6 — Mandatory focused proof

- [x] **T008 — Three complete focused suites**: Implement the exact three suites
  and every mandatory behavior listed in the testing section of `plan.md`.
  Keep production tests typed, use deterministic dates/hashes, and do not hide
  lint errors with file-wide `eslint-disable` additions beyond the existing
  repository convention —
  `backend/test/unit/deposits/deposit.service.spec.ts`,
  `backend/test/unit/deposits/deposit.repository.spec.ts`,
  `backend/test/contract/deposits/deposit.controller.spec.ts`

**T008 proof required**:

- At least 45 focused Jest tests across exactly three suites.
- Every numbered service, repository, and contract behavior in `plan.md` maps
  to a visible test name or parameterized row.
- Tests do not call a real bank, blockchain, payment gateway, email, storage,
  BulkFollows, or other network service.
- No test counts a hand-written response fixture alone as proof that production
  mapping excludes fields.

## Phase 7 — Validation and stop

- [x] **T009 — Full validation and final report**: Run every command from the
  Validation section of `plan.md`, confirm only the exact allowed files changed,
  confirm the 21-suite/283-test baseline plus at least 3 suites/45 tests passes,
  mark T001–T009 `[x]` only after success, report exact results, and stop —
  `specs/009-deposit-lifecycle/tasks.md`

## Definition of Done

- Customer can submit a unique transfer/crypto proof without changing money.
- Customer can list/read/cancel only their own deposit requests.
- Same-tenant admins can list/read/reject/approve safely.
- Approval credits the canonical wallet and writes audit movement exactly once.
- Duplicate proof, retry, concurrency, overflow, and invariant corruption fail
  closed with the exact statuses.
- No internal/provider/auth/wallet-audit data leaks through responses/errors.
- Existing auth/catalog/orders/refunds/wallet behavior and all 283 baseline
  tests remain intact.
- The backend can support a manual-review sales MVP without an automatic
  payment provider.

## Exact allowed files

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

No additional production/test/persistence file is permitted.

## Mandatory Stop Conditions

Stop without continuing or marking tasks complete if:

- duplicate preflight rows exist;
- another schema/index/field/table change appears necessary;
- an external dependency/API/provider/webhook/polling flow is proposed;
- any existing auth/catalog/order/wallet source or test must change;
- card, `saldoManual`, or `otro` is accepted;
- historical data would be modified/deleted;
- tenant/currency/wallet/status/balance/internal JSON comes from the client;
- a thirteenth production/test/persistence file is needed;
- focused suites have fewer than 45 tests or omit any named behavior;
- build, Prisma validation, ESLint, focused tests, full regression, or
  `git diff --check` fails.
