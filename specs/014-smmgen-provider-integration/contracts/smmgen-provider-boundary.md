# SMMGEN Provider Boundary

This is a private backend contract. It is implemented beside `provider-catalog-client.ts`, `bulkfollows.client.ts`, `provider-order-adapter.ts`, and `bulkfollows-order.client.ts`; it must not be imported by frontend code or public DTOs.

## Catalog Client

The SMMGEN client implements the existing `ProviderCatalogClient` seam and exposes sanitized provider-service payloads plus a verified complete-snapshot result to the synchronization orchestrator. It owns:

- `SMMGEN_API_URL` and `SMMGEN_API_KEY` configuration.
- One HTTP `POST` `services` request per synchronization attempt, with TLS verification and a bounded timeout.
- Top-level completeness/shape validation, structured `type` extraction, safe numeric validation, and sanitized failure categories.
- Mapping the SMMGEN external service identifier to `ProviderService.externalId` without exposing it.

The client must make no automatic retry. Missing configuration, HTTP failure, timeout, invalid JSON, incomplete/partial response, or malformed required data is an unsuccessful synchronization input. No raw request, key, response, comments, or error body may be logged or returned.

## Capability Mapping

| Structured SMMGEN `type`                              | Normalized capability | Purchase behavior                                            |
| ----------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| `Default`                                             | `STANDARD`            | Supported when verified bounds and contract fields are valid |
| `Custom Comments`                                     | `CUSTOM_COMMENTS`     | Normalized metadata only; fail closed and non-purchasable    |
| Any other, missing, malformed, or contradictory value | unsupported           | Reject/skip safely; never default to Standard                |

For Standard order creation, the adapter receives provider-neutral input and maps `link <- target`, `quantity <- quantity`. No title/category/rate similarity is used for mapping.

## Order Adapter

The SMMGEN implementation of `ProviderOrderAdapter` accepts a resolved historical or currently selected offering and returns only:

```text
accepted  { kind: accepted, externalOrderId: sanitized string }
rejected  { kind: rejected, message: sanitized stable category }
uncertain { kind: uncertain, message: sanitized stable category }
```

It implements Standard create and verified status operations only. Standard create maps `link <- target` and `quantity <- quantity`. Custom Comments and unknown status values are unavailable/rejected safely. One operation has at most one provider attempt; no retry, failover, ranking, substitution, or silent provider switch occurs.

## Historical Status

Status requests resolve the adapter from the original private `OrdenProveedor` offering/provider binding. Current offering selection is never consulted for an accepted order. A known status is mapped into the existing monotonic provider-neutral lifecycle; an unknown, incomplete, or contradictory response is unavailable and never treated as completion. Reconciliation may mark disappeared offerings unavailable only after the complete-success gate; it never rewrites historical bindings.
