# Tasks: BulkFollows Order Status Refresh

**Scope**: Implement only T001–T004. Do not execute Spec Kit commands or begin
refunds, scheduled polling, refill, cancellation, or another feature.

- [x] **T001 — Safe status client**: Extend the existing BulkFollows order
  client with one fake-transport-testable `action=status` form POST using the
  private provider order ID; reuse the whole-response timeout; validate and
  sanitize the documented response; never retry or expose/persist secrets,
  provider errors, raw bodies, `charge`, or provider `currency` —
  `bulkfollows-order.client.ts`

- [x] **T002 — Scoped monotonic persistence**: Add tenant/user-scoped internal
  refresh lookup and an atomic apply method that persists valid counters,
  private external status, last-query time, terminal timestamps, and exactly
  one history row per actual state transition; prevent stale/backward updates
  and make repeated/concurrent identical results idempotent —
  `order.repository.ts`

- [x] **T003 — Authenticated manual refresh**: Add
  `OrderService.refreshStatus()` and guarded
  `POST /v1/orders/:id/refresh-status`; implement terminal short-circuit,
  uniform 404, missing-provider-ID 409, configuration 503, sanitized provider
  502, official status mapping, safe response reuse, and complete Swagger
  documentation — `order.service.ts`, `order.controller.ts`

- [x] **T004 — Focused proof and validation**: Extend only the three existing
  orders suites to prove exact provider contract, timeout and sanitization,
  tenant/user isolation, every status mapping, monotonic concurrency,
  exactly-once history, timestamps/counters, terminal no-op, zero money writes,
  recursive safe responses, Swagger, and unchanged existing routes; run the
  exact build/lint/focused/full validation in `plan.md`, mark T001–T004 `[x]`,
  report exact counts/files, and stop — existing three order spec files only

## Definition of Done

- One owner-scoped manual refresh uses the official BulkFollows status contract.
- Valid provider states update local order metadata monotonically.
- Repeated/concurrent results cannot regress state or duplicate history.
- Terminal/missing/foreign orders do not contact the provider.
- No provider/private or money data leaks through HTTP or logs.
- No wallet, movement, refund, schema, migration, dependency, CRON, batch,
  refill, cancellation, auth, catalog, or unrelated change exists.

## Mandatory Stop Conditions

Stop without editing if implementation requires a Prisma schema or migration,
dependency, auth refactor, money/refund write, live BulkFollows request, public
response expansion, more than seven production/test files, or a provider
contract different from `spec.md`.
