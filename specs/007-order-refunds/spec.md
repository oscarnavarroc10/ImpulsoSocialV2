# Feature Specification: Exactly-Once Order Refunds

**Feature Branch**: `feature/007-order-refunds`  
**Created**: 2026-09-10  
**Status**: Approved — optimized MVP slice  
**Scope**: Refund customer selling-price funds after a provider `Partial` or
`Canceled` result is persisted by the existing manual status-refresh flow.

## Goal

Complete the paid-order lifecycle by crediting the authenticated customer's
existing wallet exactly once when BulkFollows reports an undelivered quantity.
Reuse `POST /v1/orders/:id/refresh-status`; do not add another endpoint,
provider call, schema field, migration, dependency, scheduler, or public field.

## Trigger and public behavior

The existing authenticated endpoint remains:

```http
POST /v1/orders/:id/refresh-status
Authorization: Bearer <access-token>
```

- A fresh provider `Partial` or `Canceled` result is first persisted using the
  Feature 006 monotonic status flow and is then refunded.
- A previously persisted local `parcial` or `cancelada` order attempts the same
  refund immediately without calling BulkFollows. This is the recovery path for
  a process interruption between status persistence and refund.
- A successful positive refund changes the local state to `reembolsada` and
  returns the existing safe `OrderResponseDto` with HTTP 200.
- `completada`, `fallida`, and `reembolsada` remain terminal no-ops.
- No refund amount, balance, provider field, movement, or history is added to
  the public response.

## Refund policy

All monetary values are integer minor units in `Orden.monedaVenta`.

| Provider outcome | Refund amount |
|---|---:|
| `Canceled` / `Cancelled` | `Orden.precioTotal` |
| `Partial` | `floor(precioTotal * restante / cantidad)` |

The partial calculation MUST use `BigInt`, never floating point. It is
equivalent to charging the customer the rounded-up proportional price for the
delivered quantity and therefore never credits more than the original charge.

Examples:

| Total | Quantity | Remaining | Refund |
|---:|---:|---:|---:|
| 15000 | 1000 | 157 | 2355 |
| 15001 | 1000 | 1 | 15 |
| 1 | 1000 | 1 | 0 |

For `Partial`, `restante` MUST be an integer from `0` through `cantidad`.
Values outside that range are invalid and must produce a sanitized conflict
without changing state, wallet, movements, or history. A calculated zero-unit
refund performs no monetary write and leaves the order `parcial`; inventing a
minimum refund would over-credit the customer.

## State and audit policy

```text
parcial   -> reembolsada
cancelada -> reembolsada
```

- The transition to `reembolsada`, wallet increment, `MovimientoSaldo`, and
  `HistorialOrden` insert MUST commit in one transaction.
- The conditional transition from exactly `parcial` or `cancelada` is the
  refund claim. Only its winner may touch the wallet or create audit rows.
- A repeated or concurrent loser reloads and returns the current safe order.
- A transaction failure rolls back the state claim and every monetary/audit
  write, so a later invocation can recover.
- The refund movement uses `tipo=reembolso`, a positive `monto`, exact
  `saldoAnterior`/`saldoPosterior`, and `referencia=Orden.id`.
- Refund history uses `origen='orders-refund'` and records the actual source
  state (`parcial` or `cancelada`) followed by `reembolsada`.
- Descriptions/comments, if used, must be static internal labels only. They
  cannot contain provider payloads, external IDs, credentials, wallet
  snapshots, or exception details.

## Functional requirements

- **FR-001**: Continue using `OrderAuthenticationGuard`; tenant and user remain
  server-derived.
- **FR-002**: Every refund lookup and conditional write MUST include order ID,
  authenticated tenant ID, and authenticated user ID.
- **FR-003**: Existing missing/foreign order behavior remains uniform HTTP 404
  with zero provider and monetary side effects.
- **FR-004**: A fresh `Partial` result with `restante > cantidad` returns a
  sanitized HTTP 502 before status persistence or refund.
- **FR-005**: A persisted refundable order with missing/invalid refund basis
  returns sanitized HTTP 409 and writes nothing.
- **FR-006**: Canceled orders receive the complete original selling total in
  the original selling currency.
- **FR-007**: Partial orders use the exact floor formula above and never refund
  more than the original selling total.
- **FR-008**: A positive refund is exactly once under sequential retries,
  concurrent retries, and recovery after status was already persisted.
- **FR-009**: The wallet credit, balance movement, status transition, and
  history transition are atomic.
- **FR-010**: Missing matching wallet or any unexpected persistence failure
  returns a sanitized server error and rolls the complete refund transaction
  back.
- **FR-011**: Provider rejection during order creation keeps the existing full
  refund behavior unchanged and must not receive a second refund.
- **FR-012**: Completed, failed, already refunded, pending, sending, and
  provider-accepted states cannot be refunded by the refund repository method.
- **FR-013**: Existing POST creation, GET list/detail, status provider contract,
  status mapping, authentication, and safe response contracts remain unchanged.

## Acceptance scenarios

1. `Partial`, total 15000, quantity 1000, remaining 157 credits 2355 once and
   returns `reembolsada`.
2. `Canceled` credits the complete original total once and returns
   `reembolsada`.
3. A local `parcial`/`cancelada` left by an interrupted earlier invocation is
   refunded without another BulkFollows call.
4. Two concurrent refund attempts create exactly one wallet increment, one
   refund movement, and one refund history row.
5. Repeating refresh after `reembolsada` performs no provider call or write.
6. Invalid remaining quantity, zero computed refund, missing wallet, and a
   foreign order follow their defined fail-closed behavior.
7. Existing provider rejection, successful completion, order creation, list,
   and detail tests remain unchanged.

## Out of scope

- New refund endpoint, customer-selected refund, administrator refund, or
  manual arbitrary credit.
- Refund of provider `charge`; refunds are based only on the customer selling
  price snapshot.
- Refill, provider cancellation request, dispute, chargeback, deposit, payment
  gateway, wallet read API, notifications, CRON, queue, or batch reconciliation.
- New schema fields, unique constraints, migrations, packages, response fields,
  or controller changes.

## Mandatory stop conditions

Stop without editing if the implementation appears to require a Prisma schema
change, migration, new dependency, new route/DTO, controller/auth/provider-client
change, live BulkFollows call, floating-point money, refund exceeding the
original total, public response expansion, or more than three production/test
files. Report the blocker instead of expanding scope.
