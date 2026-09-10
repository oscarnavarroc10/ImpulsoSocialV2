# Tasks: Exactly-Once Order Refunds

**Scope**: Implement only T001–T004. Do not execute Spec Kit commands or begin
wallet/deposit APIs, payments, refill, cancellation, polling, or another feature.

- [x] **T001 — Exact refund policy**: Add an integer/`BigInt` refund calculation
  and tenant/user-scoped refundable-order lookup; canceled returns the complete
  selling total, partial returns
  `floor(precioTotal * restante / cantidad)`, invalid basis fails closed, and a
  zero amount performs no write — `order.repository.ts`

- [x] **T002 — Atomic exactly-once credit**: Add one recoverable refund
  operation whose conditional `parcial|cancelada -> reembolsada` transition is
  the concurrency claim; atomically increment the matching wallet, create one
  exact `MovimientoSaldo.reembolso`, and create one `orders-refund` history row;
  losers/retries write nothing and reload safely — `order.repository.ts`

- [x] **T003 — Refresh orchestration and recovery**: Extend
  `OrderService.refreshStatus()` so persisted partial/canceled orders refund
  without contacting BulkFollows, fresh partial/canceled results refund after
  status persistence, invalid fresh partial remaining returns sanitized 502,
  invalid persisted basis returns sanitized 409, and every existing route,
  provider contract, terminal behavior, and safe response remains unchanged —
  `order.service.ts`

- [x] **T004 — Focused proof and validation**: Extend only the existing order
  service/repository spec with exact formulas, full/partial/zero/invalid cases,
  recovery, rollback, tenant/user isolation, sequential and concurrent
  exactly-once behavior, one movement/history, unchanged provider rejection,
  and zero private-field leakage; run every validation command in `plan.md`,
  mark T001–T004 `[x]`, report exact counts/files, and stop —
  `order.service.spec.ts`

## Definition of Done

- Canceled and positive partial outcomes restore the correct selling-price
  amount in the customer's matching wallet exactly once.
- Refund status, wallet balance, movement, and history commit atomically.
- Persisted partial/canceled orders recover without another provider request.
- Invalid/zero/foreign/non-refundable cases cannot create money.
- Existing order APIs and safe response shape remain unchanged.
- No schema, migration, package, new route, provider call, scheduler, or
  unrelated change exists.

## Mandatory Stop Conditions

Stop without editing if implementation requires schema/migration, dependency,
new route/DTO, controller/auth/provider-client change, floating-point money,
live BulkFollows request, response expansion, or more than the three approved
production/test files.
