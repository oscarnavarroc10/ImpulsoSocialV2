# Implementation Plan: Customer Order Read API

**Branch**: `feature/005-order-status`  
**Spec**: `specs/005-order-status/spec.md`

## Design

Extend the existing Feature 004 orders module instead of creating another
module:

1. Add validated list-query and pagination response DTOs beside the existing
   order DTOs. Expand the documented order-status enum to all existing
   `EstadoOrden` values.
2. Add repository methods that select only the existing safe order fields and
   always scope by tenant and user. Use one count and one page query, stable
   descending sort, and an optional exact status predicate.
3. Add `list` and `getById` application methods to `OrderService` and `GET`
   handlers to the existing guarded `OrderController`.
4. Add focused tests to the existing two order spec files. Do not introduce a
   second guard, controller, module, repository, schema change, or dependency.

## Planned Files

Modify only:

```text
backend/src/modules/orders/application/dto/order.dto.ts
backend/src/modules/orders/application/order.service.ts
backend/src/modules/orders/infrastructure/order.repository.ts
backend/src/modules/orders/presentation/order.controller.ts
backend/test/unit/orders/order.service.spec.ts
backend/test/contract/orders/order.controller.spec.ts
specs/005-order-status/tasks.md
```

If more production/test files are required, stop and report before editing.

## Test Strategy

- Repository predicates prove tenant/user scoping, exact status filtering,
  stable sort, `skip`/`take`, and safe `select`.
- Service tests prove pagination metadata and uniform 404.
- Controller tests prove 200 responses, validation/Swagger contracts, exact
  safe fields, and unchanged POST wiring.
- No test may use MySQL, live credentials, network calls, provider transport,
  fake paid orders, or pending timer handles.

## Validation

Run from `backend`:

```bash
npm run build

npx eslint \
  src/modules/orders/application/dto/order.dto.ts \
  src/modules/orders/application/order.service.ts \
  src/modules/orders/infrastructure/order.repository.ts \
  src/modules/orders/presentation/order.controller.ts \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/order.controller.spec.ts

npm test -- --runInBand --detectOpenHandles \
  test/unit/orders/order.service.spec.ts \
  test/contract/orders/order.controller.spec.ts \
  test/contract/orders/bulkfollows-order.client.spec.ts
```

Do not run the complete suite until the focused commands pass.

## Mandatory Stop Conditions

Stop without expanding scope if the work appears to require a migration,
dependency, provider request, monetary write, status transition, auth refactor,
new module, more than the six planned production/test files, or modification to
Feature 004 POST behavior.

