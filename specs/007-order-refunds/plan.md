# Implementation Plan: Exactly-Once Order Refunds

**Branch**: `feature/007-order-refunds`  
**Spec**: `specs/007-order-refunds/spec.md`

## Strategy

Extend the existing Feature 006 refresh flow with one recoverable, atomic
refund operation. No controller, DTO, provider client, schema, or module wiring
change is required.

### 1. Repository refund operation

Add a tenant/user-scoped repository operation for refundable terminal outcomes.
It must:

1. Read only the local order fields needed for refund calculation:
   `estado`, `cantidad`, `precioTotal`, `monedaVenta`, and `restante`.
2. Return without writes when the state is not `parcial` or `cancelada`.
3. For `parcial`, validate `0 <= restante <= cantidad` and calculate
   `floor(precioTotal * restante / cantidad)` with `BigInt`.
4. For `cancelada`, use the complete `precioTotal`.
5. Return a no-money result when the exact partial amount is zero.
6. In one transaction, conditionally claim the exact source state by changing
   it to `reembolsada`, increment the matching tenant/user/currency wallet,
   read the resulting balance, create one `MovimientoSaldo.reembolso`, and
   create one `HistorialOrden` transition with `origen='orders-refund'`.
7. Roll back everything if the matching wallet is absent or any write fails.
8. If the conditional claim loses, perform no money/audit write and reload the
   safe order after the transaction.

The pre-transaction calculation is safe because order quantity, selling-price
snapshot, currency, and persisted terminal `restante` are immutable in the
current flow. The conditional state update is the exactly-once claim.

Use an internal discriminated result or a dedicated internal error so the
service can distinguish:

- refunded/current safe order;
- zero refund;
- invalid refund basis;
- missing scoped order;
- missing wallet/unexpected invariant failure.

Do not add a database uniqueness constraint: the conditional status claim
already prevents duplicate financial effects.

### 2. Application orchestration

Adjust `OrderService.refreshStatus()` in this order:

1. Keep the existing scoped lookup and uniform 404.
2. If the stored status is `parcial` or `cancelada`, invoke the refund operation
   immediately without a provider call. This is recovery.
3. Keep `completada`, `fallida`, and `reembolsada` as terminal no-ops.
4. Preserve all existing configuration, provider request, mapping, and error
   behavior for non-terminal orders.
5. Before persisting a fresh `Partial`, reject `remains > quantity` as the same
   sanitized 502 provider-contract failure used by status refresh.
6. Persist the valid provider result through existing `applyRefresh()`.
7. If the resulting stored state is `parcial` or `cancelada`, invoke the refund
   operation and return its safe result; otherwise return the existing result.
8. Map invalid persisted refund basis to sanitized HTTP 409 and unexpected
   refund invariants to a sanitized HTTP 500 without exposing internals.

Do not change the route or public DTO. Do not move the network request inside a
database transaction.

### 3. Focused tests

Extend only `backend/test/unit/orders/order.service.spec.ts`, which already
contains both service and repository transaction tests.

Required proof:

- exact canceled full refund;
- partial `BigInt` floor examples, including non-divisible and near-boundary
  values;
- partial refund never exceeds total;
- zero calculated refund causes no wallet/movement/history write;
- invalid/missing/excess remaining causes no write and produces the specified
  sanitized error;
- fresh Partial/Canceled status persists then refunds;
- already persisted Partial/Canceled recovers without provider call;
- conditional winner writes one wallet credit, one movement, one history row;
- sequential retry and simulated concurrent loser write zero additional money
  or audit rows and return the current safe order;
- missing wallet rolls back/fails closed;
- foreign/missing and all non-refundable states write nothing;
- existing explicit creation rejection remains exactly-once;
- public order response remains unchanged and recursively private-field-free.

All tests use mocks/fake Prisma transactions. No live provider call.

## Allowed files

```text
backend/src/modules/orders/infrastructure/order.repository.ts
backend/src/modules/orders/application/order.service.ts
backend/test/unit/orders/order.service.spec.ts
specs/007-order-refunds/tasks.md
```

Only three production/test files may change. `tasks.md` is documentation and
does not count against that limit.

## Validation

Run from `backend`:

```bash
npm run build

npx eslint \
  src/modules/orders/infrastructure/order.repository.ts \
  src/modules/orders/application/order.service.ts \
  test/unit/orders/order.service.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/orders/order.service.spec.ts

npm test -- --runInBand --detectOpenHandles
```

Then from repository root:

```bash
git diff --check
git status --short
git diff --stat
```

Only after every command succeeds may T001–T004 be marked complete.

## Stop conditions

Stop and report without expanding scope if implementation needs schema,
migration, dependency, new endpoint/DTO, controller, provider client, auth,
catalog, deposit, payment, scheduler, live network request, or a fourth
production/test file.
