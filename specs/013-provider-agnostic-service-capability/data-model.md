# Data Model: Provider-Agnostic Fulfillment Foundation

## Existing entities retained

### MasterService

Stable platform-owned commercial identity. Retain curated title, description, category, social network, visibility, lifecycle, default prices, and nullable `provenanceRef`. `provenanceRef` is legacy compatibility only and never the new routing selector.

### ProviderService

Imported provider identity keyed by `(providerOrigin, externalId)`. Retain raw payload and technical metadata privately. Provider records are not customer catalog identities.

### TenantServiceOverride

Tenant-scoped enablement and selling-price override keyed by `(tenantId, masterServiceId)`. It remains independent from provider selection.

### Orden

Retain required `cantidad`, integer money snapshots, tenant/user/service relations, idempotency key/fingerprint, and lifecycle fields. Add one nullable private structured input snapshot if the final schema placement is clean.

### OrdenProveedor

Retain one-to-one relation to `Orden`, legacy `proveedor`, `idExterno`, request/response JSON, status and cost fields. Add nullable historical offering/provider-service/capability linkage and immutable contract snapshot fields.

## Proposed new entity

### MasterServiceProviderOffering

Private platform-level association between one `MasterService` and one `ProviderService`.

Fields:

- `id`: stable internal identifier.
- `masterServiceId`: required FK to `MasterService`.
- `providerServiceId`: required FK to `ProviderService`.
- `capabilityKey`: bounded value, initially `STANDARD` or `CUSTOM_COMMENTS`.
- `contractVersion`: required version string/integer.
- `contract`: private JSON containing logical required/optional fields, quantity mode, target kind, authoritative bounds, supported operations, source provider type, and validation status.
- `isEnabled`: administrative mapping state.
- `isAvailable`: normalized provider/import availability state.
- `isSelected`: explicit platform-global selector for new orders.
- `createdAt`, `updatedAt`.

Constraints and indexes:

- Unique `(masterServiceId, providerServiceId)` to prevent duplicate mappings.
- At most one offering per MasterService may have `isSelected = true`. Do not model this as `UNIQUE(masterServiceId, isSelected)`, because multiple non-selected offerings must be allowed. Use a MySQL/MariaDB-compatible database strategy if one is clean; otherwise enforce selection changes transactionally in the application/repository layer and cover the invariant with concurrency tests. Do not introduce a PostgreSQL-style partial unique index.
- Index `(masterServiceId, isEnabled, isAvailable, isSelected)` for new-order resolution.
- Index `(providerServiceId, isEnabled, isAvailable)` for sync/disappearance handling.
- Do not index comment text or arbitrary JSON fields.

## Historical linkage

Add nullable fields to `OrdenProveedor`:

- `offeringId` FK to `MasterServiceProviderOffering`.
- `providerServiceId` FK to `ProviderService` where direct historical lookup is useful.
- `capabilityKeySnapshot`.
- `capabilityContractVersionSnapshot`.
- `offeringSnapshot` JSON if immutable contract details cannot be safely reconstructed later.

Retain `proveedor`, `idExterno`, `solicitudOriginal`, and `respuestaOriginal` during compatibility. `OrdenProveedor.idExterno` is the external provider ORDER ID, not `ProviderService.externalId`. Add indexes for `(offeringId, estadoExterno)` and `(providerServiceId, idExterno)` as needed; preserve the existing `(proveedor, idExterno)` uniqueness until verified legacy migration.

Historical linkage may be backfilled only from independent, deterministic evidence of the provider service/offering originally used. Never infer it from titles, descriptions, prices, categories, or the external provider order ID. If that evidence is absent, leave new linkage nullable and resolve the order through the existing legacy provider fields.

## Private input snapshot

Preferred shape is a nullable JSON field on `Orden` or, if Prisma relation/query constraints require it, a single one-to-one private order-input record. It contains:

- schema/version;
- capability key;
- normalized target/link;
- optional direct quantity;
- effective quantity when deterministic;
- ordered normalized comments only when a verified capability permits them.

Do not store provider credentials, raw provider response, or unapproved provider request fields. Do not create separate tables per capability. Do not make `Orden.cantidad` nullable solely to represent hypothetical Custom Comments behavior. Preserve the existing fingerprint representation for current `STANDARD` orders; only capabilities that define dynamic inputs may use a versioned canonical input representation for idempotency.

## State and lifecycle rules

1. Offering is orderable only when enabled, available, selected, and capability contract is supported.
2. Unknown or malformed capability is unavailable, never Standard by default.
3. Provider disappearance disables the offering but does not delete MasterService or future Favorite references.
4. New orders bind the selected offering before external acceptance is recorded.
5. Existing orders resolve later provider operations from immutable historical binding; null new linkage uses legacy provider fields.
6. Tenant overrides affect commercial eligibility and price, never offering selection.
