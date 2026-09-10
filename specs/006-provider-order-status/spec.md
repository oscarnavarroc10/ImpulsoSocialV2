# Feature Specification: BulkFollows Order Status Refresh

**Feature Branch**: `feature/006-provider-order-status`  
**Created**: 2026-08-31  
**Status**: Draft  
**Scope**: Manual, authenticated refresh of one customer order. No scheduler,
refund, cancellation, refill, balance adjustment, or schema change.

## Goal

Allow an authenticated customer to request the latest BulkFollows status for
one of their own orders and persist a safe, monotonic local transition. Reuse
the existing `Orden`, `OrdenProveedor`, `HistorialOrden`, authentication guard,
and public `OrderResponseDto`.

## Official provider contract

BulkFollows documents one form-encoded `POST` to the configured API URL:

```text
key=<configured key>
action=status
order=<OrdenProveedor.idExterno>
```

Documented response shape:

```json
{
  "charge": "0.27819",
  "start_count": "3572",
  "status": "Partial",
  "remains": "157",
  "currency": "USD"
}
```

Source: `https://bulkfollows.com/api`, section **Action: Order status**.

`charge` and `currency` are deliberately ignored in this feature. They cannot
change the order price, provider cost, wallet, or any movement.

## Public API

```http
POST /v1/orders/:id/refresh-status
Authorization: Bearer <access-token>
```

Success returns HTTP 200 using the existing safe `OrderResponseDto` only:

```json
{
  "id": "local-order-id",
  "serviceId": "master-service-id",
  "target": "https://www.instagram.com/example/",
  "quantity": 1000,
  "totalPrice": { "amount": 15000, "currency": "MXN" },
  "status": "enProgreso",
  "createdAt": "2026-08-31T00:00:00.000Z"
}
```

The response MUST NOT include provider IDs, provider cost, raw response,
credentials, `charge`, `currency`, `start_count`, `remains`, tenant ID, user ID,
request fingerprint, or wallet data.

## Status mapping

Provider status comparison is trimmed and case-insensitive.

| BulkFollows status | Local `EstadoOrden` |
|---|---|
| `Pending` | `enviadaProveedor` |
| `Processing` | `enProgreso` |
| `In progress` | `enProgreso` |
| `Completed` | `completada` |
| `Partial` | `parcial` |
| `Canceled` or `Cancelled` | `cancelada` |

Any other status is an unusable provider response: return a sanitized HTTP 502
and do not mutate order, provider metadata, history, or money.

## Functional requirements

- **FR-001**: The endpoint MUST use the existing `OrderAuthenticationGuard`.
- **FR-002**: Lookup MUST include the authenticated `tenantId`, `userId`, and
  local order `id` in the database predicate. Missing and foreign orders return
  the same HTTP 404 response and MUST NOT call BulkFollows.
- **FR-003**: `completada`, `parcial`, `cancelada`, `fallida`, and
  `reembolsada` are terminal for this feature. Refreshing one returns its
  current safe representation with HTTP 200 and performs no provider call or
  write.
- **FR-004**: A non-terminal order without a non-empty private provider order
  ID returns sanitized HTTP 409 and performs no provider call or write.
- **FR-005**: Missing/invalid provider configuration returns sanitized HTTP 503
  before any request.
- **FR-006**: Exactly one form-encoded status request is made per eligible
  endpoint invocation. There is no retry.
- **FR-007**: The request MUST reuse the existing configurable whole-response
  timeout, including response body reading.
- **FR-008**: Transport failure, timeout, non-2xx response, explicit provider
  `{ "error": ... }`, invalid JSON, invalid shape, unknown status, or invalid
  counters returns sanitized HTTP 502. No provider detail or credential may be
  logged, persisted in public fields, or returned.
- **FR-009**: `start_count` and `remains` accept only non-negative safe integers
  represented as JSON numbers or decimal digit strings. They map to
  `Orden.conteoInicial` and `Orden.restante`.
- **FR-010**: A valid response updates `OrdenProveedor.estadoExterno` and
  `OrdenProveedor.ultimaConsultaEn`. Raw provider bodies are not persisted.
- **FR-011**: `completadaEn` is set only on the first transition to
  `completada`; `canceladaEn` is set only on the first transition to
  `cancelada`.
- **FR-012**: Local state MUST never move backward. A stale concurrent response
  cannot overwrite a more advanced or terminal state.
- **FR-013**: A local state change and its `HistorialOrden` record MUST be
  committed atomically. Repeated or concurrent identical refreshes create at
  most one history row for that transition.
- **FR-014**: A valid response that maps to the current local state may update
  counters and last-query metadata but MUST NOT add duplicate history.
- **FR-015**: History uses `origen='bulkfollows-status'`, the actual previous
  and new local states, no raw payload, and no provider ID.
- **FR-016**: The existing `POST /v1/orders`, `GET /v1/orders`, and
  `GET /v1/orders/:id` contracts and behavior MUST remain unchanged.
- **FR-017**: Refresh MUST NOT create or alter `Billetera`, `MovimientoSaldo`,
  `Deposito`, provider cost, selling price, or refund data.
- **FR-018**: Swagger MUST document bearer auth and HTTP 200, 401, 404, 409,
  502, and 503 for the new route.

## Acceptance scenarios

1. An authenticated owner refreshes an `enviadaProveedor` order and
   BulkFollows returns `In progress`; the order becomes `enProgreso`, counters
   and last-query metadata are stored, one history row is added, and the safe
   order is returned.
2. BulkFollows returns `Completed`; the order becomes `completada` and
   `completadaEn` is set exactly once.
3. BulkFollows returns `Partial` or `Canceled`; the corresponding terminal local
   state is persisted without issuing any refund.
4. Repeating the same response does not duplicate history or change money.
5. Two concurrent refreshes cannot regress state or create duplicate transition
   history.
6. A foreign/missing order returns 404 without revealing whether it exists and
   without contacting BulkFollows.
7. A terminal order returns its current response without contacting
   BulkFollows.
8. A missing provider ID returns 409; provider errors/malformed responses return
   502; missing configuration returns 503. Every error is sanitized.

## Out of scope

- Scheduled/background polling or batch status calls.
- Partial, canceled, failed, or other automatic refunds.
- Provider balance, refill, cancellation, or multi-order status endpoints.
- Recovery of an ambiguous `enviando` order that has no provider order ID.
- New database fields, migrations, dependencies, queues, locks, or CRON jobs.
- Frontend changes or administrative recovery tools.

## Mandatory stop conditions

Stop without editing if implementation would require a Prisma schema change,
migration, dependency, auth refactor, public response expansion, money movement,
live provider request, more than seven production/test files, or any provider
contract different from the official form and response documented above.
