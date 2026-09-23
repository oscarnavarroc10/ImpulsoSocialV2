# Research: Provider-Agnostic Fulfillment Foundation

## Repository findings

- `MasterService.provenanceRef` is the current single-provider resolution path in `backend/src/modules/orders/infrastructure/order.repository.ts` and `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts`.
- `ProviderService` already has a stable `(providerOrigin, externalId)` uniqueness constraint and private `rawPayload`/`metadata` JSON in `backend/prisma/schema.prisma`.
- `OrdenProveedor` is one-to-one with `Orden`, stores provider origin as a string, and already stores private request/response JSON. Reusing it is smaller than introducing a second historical order table.
- `OrderService` computes SHA-256 idempotency from `[serviceId, target, quantity]`, while `OrderRepository` atomically creates the order, wallet movement, and history before the provider attempt. This current `STANDARD` fingerprint representation must remain unchanged; dynamic inputs require a separate versioned canonical representation only for capabilities that define them.
- BulkFollows adapter calls are backend-only, one-attempt, timeout-bounded, and represent accepted/rejected/unknown outcomes. Unknown outcomes must remain uncertain and must not trigger cross-provider retry.
- Public catalog DTOs are protected by contract tests that reject provider origin, external IDs, raw payload, metadata, provider cost, and provenance fields.

## Decisions

### Decision: Explicit offering relation

**Rationale**: A MasterService can map to multiple ProviderServices, while `provenanceRef` can represent only one legacy relationship. An explicit relation is the smallest clean representation that supports selection, availability, normalized capability, and historical binding.

**Alternatives considered**: Repurposing `provenanceRef` was rejected because it loses multi-provider capability. A provider registry or generic plugin framework is deferred unless adapter lookup cannot use the existing provider-origin key.

### Decision: Platform-global manual selection

**Rationale**: Provider routing is infrastructure, while `TenantServiceOverride` already owns tenant enablement and selling price. Global selection avoids duplicating routing state per tenant and preserves current commercial boundaries.

**Alternatives considered**: Tenant-specific selection, cheapest routing, ranking, failover, and automatic substitution are out of scope and unsafe for ambiguous external submissions.

### Decision: At-most-one selected offering invariant

**Rationale**: Each MasterService needs at most one platform-global selected offering while allowing any number of non-selected alternatives. `UNIQUE(masterServiceId, isSelected)` is invalid because it would permit only one non-selected row. Use a MySQL/MariaDB-compatible database strategy when clean; otherwise serialize selection changes transactionally in the application/repository layer and test concurrent updates.

**Alternatives considered**: A PostgreSQL-style partial unique index is not portable to the repository's MySQL/MariaDB target and is explicitly excluded.

### Decision: Reuse `OrdenProveedor` and private JSON input snapshot

**Rationale**: Existing order history already has a one-to-one provider record and JSON persistence. Add nullable linkage and a private structured input snapshot without creating capability-specific tables. Preserve legacy request/response fields for reconciliation.

**Alternatives considered**: A new provider-order history aggregate or separate table per capability would increase migration and query complexity. Exact snapshot placement remains a planning gate.

Historical backfill is intentionally conservative: `OrdenProveedor.idExterno` identifies the external provider order, not the provider catalog service. New offering/provider-service linkage is populated only from independent deterministic evidence of the original service used; otherwise legacy fields remain authoritative.

### Decision: Normalize at the provider boundary

**Rationale**: New domain/order code must consume a bounded capability contract instead of provider raw payloads. Existing `readQuantityBounds` remains only as a migration compatibility reader for verified BulkFollows Standard data.

**Alternatives considered**: Parsing titles/descriptions or continuing to read raw payloads from order orchestration was rejected by the specification and constitution.

### Decision: Fail closed for Custom Comments

**Rationale**: Repository evidence contains no verified BulkFollows Custom Comments request fixture or semantics. Treating comments as quantity, deriving bounds, or inventing field names could change pricing and wallet behavior.

**Alternatives considered**: Deriving quantity from comment count or requiring an independent quantity are both deferred until provider evidence is verified.

## Implementation best practices

- Use additive nullable Prisma changes and staged backfill before switching reads.
- Keep provider-neutral adapter interfaces in the orders application boundary and provider-specific serialization/status mapping in infrastructure.
- Version the normalized capability/input contract so future changes do not reinterpret historical orders.
- Canonicalize dynamic order inputs before hashing; never hash raw provider request text or secrets.
- Use fakes for all adapter tests and require no live provider calls in CI.
