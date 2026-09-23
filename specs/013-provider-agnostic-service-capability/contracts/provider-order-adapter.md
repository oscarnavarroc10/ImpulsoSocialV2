# Provider Order Adapter Contract

## Purpose

Internal backend boundary between order orchestration and provider-specific HTTP clients. This is not a public API.

## Inputs

The adapter receives a resolved private offering and provider-neutral request:

```text
createOrder({
  providerServiceExternalId,
  capability,
  target,
  quantity?,
  comments?,
  idempotencyContext
}) -> accepted | rejected | uncertain
```

The adapter owns provider field names, numeric service types, serialization, credentials, TLS, timeouts, and response sanitization. The application layer owns tenant authorization, offering selection, pricing, wallet transaction, idempotency, and order state transitions.

## Results

- `accepted`: provider external order ID is validated and stored privately.
- `rejected`: sanitized rejection outcome; existing refund policy applies.
- `uncertain`: no retry or provider substitution; order remains in the existing uncertain/enviando path.
- `status`: normalized external status and validated counters, or unavailable.

## Historical routing

Status, refill, cancellation, and reconciliation select the adapter from the order's historical private binding. They never resolve the current selected offering.

## BulkFollows implementation

The existing `BulkFollowsOrderClient` is adapted first. Preserve its backend environment credentials, one attempt, timeout, accepted/rejected/unknown mapping, and status validation. No BulkFollows Custom Comments mapping is allowed until its contract is verified.

## Security

Credentials and raw request/response bodies remain infrastructure-only. Logs and public errors contain sanitized operational information only. Tests inject fake transports and never call a provider.
