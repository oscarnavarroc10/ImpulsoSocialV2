# Feature 014 Research

## Repository Baseline

Feature 013 has provider-neutral persistence and partial application seams, but not a complete multi-provider runtime path. `provider-catalog-client.ts` defines the catalog interface; `bulkfollows.client.ts` is its only registered implementation. `capability-normalizer.ts` currently exports only `normalizeBulkFollowsCapability`. `ImportOrchestrator` imports and stages provider data but hard-codes `bulkfollows` for lookup and disappearance reconciliation. `MasterServiceProviderOfferingRepository` already supports normalized upsert, explicit transactional selection, selected-available lookup, and offering availability.

For orders, `provider-order-adapter.ts` defines neutral request/result types and `orders.module.ts` binds `PROVIDER_ORDER_ADAPTER` to `BulkFollowsOrderAdapter`, but `OrderService.claimAndSubmit` still calls the concrete `BulkFollowsOrderClient`. `OrderRepository.findCandidate` validates the selected Standard contract and tenant price, while `findForRefresh` returns only provider order ID/origin and `OrderService.refreshStatus` still falls back to the concrete BulkFollows client. These are the controlling blockers for SMMGEN adapter resolution and historical routing.

## Decisions

### Decision: Add SMMGEN beside the existing provider implementations

**Rationale:** Reuse `ProviderCatalogClient`, the offering repository, `SyncService`/`ImportOrchestrator`, `ProviderOrderAdapter`, and existing order persistence. A dedicated SMMGEN client owns HTTP and a dedicated adapter owns SMMGEN field mapping. This preserves the local `MasterService` identity and avoids a parallel order pipeline.

**Alternatives considered:** Provider-specific controllers, a second order service, a dynamic plugin framework, or routing by provider name in the frontend. Rejected because they duplicate Feature 013 behavior and increase privacy and financial risk.

### Decision: Use backend-only environment configuration

Use `SMMGEN_API_URL` and `SMMGEN_API_KEY`, loaded only by the SMMGEN client. Validate URL configuration, keep TLS verification enabled, use the existing timeout/AbortController pattern, and never log request bodies, headers, API keys, raw responses, or provider identifiers in public errors.

**Alternatives considered:** Database credentials, tenant credentials, frontend configuration, or a credential-management redesign. Rejected by the specification and constitution.

### Decision: Normalize structured `type` only and fail closed

The structured service `type` field is authoritative. `Default` maps to `STANDARD`; `Custom Comments` maps to `CUSTOM_COMMENTS`; unknown, malformed, contradictory, or incomplete metadata becomes unsupported. Titles, descriptions, categories, rates, and similarity are never capability inference inputs.

`STANDARD` requires a complete supported contract with target and required positive integer quantity bounds. The provider request mapping is `link <- target` and `quantity <- quantity`. `CUSTOM_COMMENTS` is stored as normalized capability metadata but remains non-purchasable; quantity, comment-count, pricing, bounds, newline/blank-line/trimming/duplicate rules, limits, and exact provider fields remain deferred.

**Alternatives considered:** Defaulting unknown types to Standard, inferring from names, or partially executing Custom Comments. Rejected because malformed provider data could create invalid orders or incorrect charges.

### Decision: Preserve explicit curation and selection

SMMGEN services are imported into private `ProviderService` records and normalized offerings. Association to a `MasterService`, enablement, and selection remain explicit administrative operations through existing offering services/repositories. No automatic matching, merging, ranking, cost routing, failover, retry, or substitution is allowed. Multiple offerings may map to one MasterService, with at most one selected offering for new orders.

### Decision: Reconcile disappearance only after a complete successful snapshot

The SMMGEN synchronization path may mark missing offerings unavailable only after the client has returned a verified complete services snapshot and every item has passed validation/persistence criteria. HTTP failure, timeout, malformed top-level response, partial pagination, per-item parse failure, uncertain completion, or failed writes must not mass-disable existing offerings. A failed run remains an operational failure/partial result without destructive disappearance reconciliation.

### Decision: Use historical binding for all later operations

At acceptance, persist the selected offering/provider-service/capability/version and private offering snapshot through the existing `OrdenProveedor` fields and input snapshot. Status, reconciliation, and any compatibility operation resolve the original binding, never current selection. Existing legacy rows continue using their established fallback only when the new links are null; external IDs and text are never used to infer a binding.

### Decision: Preserve idempotency, pricing, tenant behavior, and one attempt

Retain the existing Standard fingerprint semantics `[serviceId, target, quantity]`, tenant-scoped `TenantServiceOverride` pricing, wallet atomicity, rejection/refund policy, uncertain state, and monotonic status progression. A provider operation makes at most one attempt. SMMGEN rate remains private provider-cost metadata and never replaces MasterService or tenant selling price.

### Decision: No schema or migration change

The live Prisma schema already has all required Feature 013 structures: `CapabilityKey`, `MasterServiceProviderOffering`, provider-origin uniqueness, offering indexes, `OrdenProveedor` historical linkage/snapshots, `Orden.datosEntradaPrivada`, and existing idempotency/order/wallet fields. No Feature 014 migration is justified. The Feature 013 migration remains untouched.

## Implementation Blockers To Resolve In Tasks

1. Generalize catalog client registration and `ImportOrchestrator` provider origin/completeness without weakening BulkFollows.
2. Replace concrete create/status calls in `OrderService` with an origin-aware adapter resolver while retaining wallet and idempotency boundaries.
3. Pass the historical `OrdenProveedor` binding to that resolver without a schema change; existing nullable links and snapshots are the available evidence.
4. Confirm the approved SMMGEN status vocabulary from sanitized recorded evidence; unknown values remain fail-safe.

## Verification Constraints

All validation uses fakes, mocks, sanitized fixtures, and recorded provider-shaped responses. Tests must run without SMMGEN credentials, network access, provider balance, real order creation, or production data. BulkFollows Standard behavior, Custom Comments rejection, wallet/refund behavior, idempotency, public privacy, tenant isolation, and historical routing remain regression gates.

## Deferred Decisions

Custom Comments execution is intentionally deferred, not guessed: its quantity/pricing contract, input normalization, bounds, provider fields, and purchasability require a future approved specification and provider evidence. Exact SMMGEN status vocabulary beyond verified mappings is also fail-safe: unknown statuses are unavailable/error and never completion.
