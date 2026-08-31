# Implementation Plan: BulkFollows Order Status Refresh

**Branch**: `feature/006-provider-order-status`  
**Spec**: `specs/006-provider-order-status/spec.md`

## Implementation strategy

Implement one narrow vertical slice inside the existing orders module. No new
file is required in production and no persistence change is allowed.

### 1. Provider client

Extend `BulkFollowsOrderClient` with a typed status method. Reuse the current
configuration validation, form encoding, transport abstraction, abort signal,
and whole-response timeout.

The request contains exactly `key`, `action=status`, and `order`. Parse the body
as untrusted JSON and expose only a discriminated internal result:

```ts
type BulkFollowsStatusResult =
  | {
      kind: 'ok';
      externalStatus: string;
      startCount: number;
      remains: number;
    }
  | { kind: 'unavailable' };
```

Do not expose or retain `charge`, `currency`, raw bodies, errors, URL, or API
key. The new method performs exactly one request and never retries. Preserve
`submit()` behavior and existing tests.

### 2. Scoped repository flow

Add an internal lookup that selects only the data required to decide refresh:

- safe order view;
- local `EstadoOrden`;
- private `OrdenProveedor.idExterno`.

The lookup predicate includes local ID, authenticated tenant, and authenticated
user. The provider ID never leaves the application layer.

Add one transactional apply method that:

1. Re-reads the scoped current state.
2. Rejects stale/backward transitions.
3. Updates `conteoInicial`, `restante`, private external status, and
   `ultimaConsultaEn` for an accepted non-stale result.
4. Sets the appropriate terminal timestamp once.
5. Creates history only when the local state actually changes.
6. Returns the existing safe order view.

The state change and history insert are one transaction. A conditional update
or equivalent in-transaction current-state check must make concurrent identical
transitions exactly-once. Do not hold a database transaction open during the
network request.

Use this monotonic progression for comparisons:

```text
enviando/enviadaProveedor -> enProgreso -> completada
                                      \-> parcial
                                      \-> cancelada
```

`Pending` keeps an accepted order at `enviadaProveedor`; it must never regress
`enProgreso`. Terminal states never transition in this feature.

### 3. Application and HTTP route

Add `OrderService.refreshStatus(id, principal)`:

1. Perform scoped lookup.
2. Return uniform 404 for missing/foreign order.
3. Return terminal orders immediately with zero provider calls/writes.
4. Fail 409 when an active order has no provider ID.
5. Fail 503 when provider configuration is unavailable.
6. Invoke the status client once.
7. Map the trimmed case-insensitive provider status according to `spec.md`.
8. Fail sanitized 502 for unavailable/unknown/invalid results.
9. Apply the monotonic transactional update and return `OrderResponseDto`.

Add guarded `POST /v1/orders/:id/refresh-status` to `OrderController`. Reuse the
existing principal and response DTO; add no request DTO. Document Swagger 200,
401, 404, 409, 502, and 503.

### 4. Focused tests

Extend only the existing three order suites:

- `bulkfollows-order.client.spec.ts`: exact form fields, numeric/string counter
  parsing, explicit error, unknown/malformed status response, non-2xx,
  transport failure, body timeout, one attempt, and secret/raw-body exclusion.
- `order.service.spec.ts`: tenant/user scoped lookup; missing/foreign 404;
  terminal short-circuit; missing provider ID; configuration failure; complete
  mapping; counter persistence; same-state idempotency; concurrent/stale
  response protection; exactly-once history; terminal timestamps; zero wallet,
  movement, deposit, refund, and creation writes.
- `order.controller.spec.ts`: guard remains active; route/status codes and
  Swagger; recursive safe response; existing POST/list/detail behavior remains
  covered.

All tests use fake transports and mocks. No test may call BulkFollows.

## Allowed files

Production/test edits are limited to:

```text
backend/src/modules/orders/infrastructure/bulkfollows-order.client.ts
backend/src/modules/orders/infrastructure/order.repository.ts
backend/src/modules/orders/application/order.service.ts
backend/src/modules/orders/presentation/order.controller.ts
backend/test/contract/orders/bulkfollows-order.client.spec.ts
backend/test/unit/orders/order.service.spec.ts
backend/test/contract/orders/order.controller.spec.ts
specs/006-provider-order-status/tasks.md
```

The seven production/test files are the maximum expected scope. The mandatory
stop condition means no eighth production/test file may be modified.

## Validation

Run from `backend` after implementation:

```bash
npm run build

npx eslint \
  src/modules/orders/infrastructure/bulkfollows-order.client.ts \
  src/modules/orders/infrastructure/order.repository.ts \
  src/modules/orders/application/order.service.ts \
  src/modules/orders/presentation/order.controller.ts \
  test/contract/orders/bulkfollows-order.client.spec.ts \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/order.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/contract/orders/bulkfollows-order.client.spec.ts \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/order.controller.spec.ts

npm test -- --runInBand --detectOpenHandles
```

Then run from the repository root:

```bash
git diff --check
git status --short
git diff --stat
```

Only after every command succeeds may T001–T004 be marked complete.

## Stop conditions

Stop and report without expanding scope if any requirement needs a schema or
migration change, dependency, background scheduler, provider batch API, refund,
wallet write, auth modification, live API call, additional production/test
file, or a response contract inconsistent with the official BulkFollows docs.
