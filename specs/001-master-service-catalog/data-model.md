# Data Model

This document captures the v1 data model for the Master Service Catalog feature. It is technology-agnostic; implementation will use Prisma models in Phase 2.

## Entities (v1)

### MasterService
- `id` (string, internal) — primary identifier (internal)
- `title` (string)
- `description` (string)
- `categoryId` (string) — single category for v1
- `socialNetwork` (enum) — single social network for v1; allowed values: `Instagram`, `Facebook`, `TikTok`
- `providerCost` (monetary object — integer minor units + currency)
- `defaultSellingPrice` (monetary object)
- `isVisible` (boolean) — master-level visibility flag
- `status` (enum: draft, active, deprecated)
- `provenanceRef` (reference to latest `ProviderService.id` import record)

### ProviderService
- `id` (string, internal) — internal record identifier for the provider import
- `providerOrigin` (string) — identifier for the provider origin (e.g., `bulkfollows`); used together with `externalId` for idempotency
- `externalId` (string) — the provider's identifier for the service
- `rawPayload` (json/blob) — raw provider payload stored securely for reconciliation (backend-only)
- `importTimestamp` (datetime)
- `metadata` (object) — provider-specific metadata allowed for technical reconciliation

Notes: `ProviderService.id` is the internal record (used to link provenance). `externalId` is the raw provider identifier. Synchronization must be idempotent by matching the composite unique key `(providerOrigin, externalId)` so repeated imports do not create duplicate `ProviderService` records.

### StagedService
- `id` (string)
- `providerServiceId` (reference to ProviderService.id)
- `ingestedAt` (datetime)
- `reviewStatus` (enum: pending, approved, rejected)
- `proposedTitle`, `proposedDescription`, `proposedCategoryId`, `proposedSocialNetwork` (fields proposed from provider ingestion)

### Category
- `id` (string)
- `name` (string)
- `description` (string)

### TenantServiceOverride
- `id` (string)
- `tenantId` (string)
- `masterServiceId` (string)
- `isEnabled` (boolean) — if `false`, tenant will not include this service
- `sellingPriceOverride` (monetary object, optional)

Uniqueness: `TenantServiceOverride` MUST be unique on `(tenantId, masterServiceId)`.

### MasterCatalogSnapshot
- `id` (string)
- `createdAt` (datetime)
- `createdBy` (actor id)
- `items` (list of `MasterCatalogSnapshotItem`)
- `status` (enum: draft, published)
- `publishedAt` (datetime, nullable)

Note: By business rule, when `status` == `published`, the snapshot is immutable.

### MasterCatalogSnapshotItem
- `id` (string)
- `masterServiceId` (string)
- `title` (string)
- `description` (string)
- `categoryId` (string)
- `categoryName` (string)
- `socialNetwork` (enum) — allowed values: `Instagram`, `Facebook`, `TikTok`
- `sellingPriceAmount` (integer minor units)
- `currency` (ISO 4217 string)
- `serviceStatus` (string)

Note: `MasterCatalogSnapshotItem` is a complete historical copy of the customer-facing data at the time of snapshot publication.

### SyncJob
- `id` (string)
- `startedAt` / `finishedAt`
- `status` (success/partial/failure)
- `summary` (counts imported/updated/skipped/errors)
- `source` (scheduled|on-demand)

### AuditLog
- `id` (string)
- `actorId` (string)
- `actorType` (admin/system)
- `action` (import/approve/edit/publish/export)
- `timestamp` (datetime)
- `details` (field deltas or notes)

## Notes on Monetary Values

- Store monetary values as integer minor units (e.g., cents) with an explicit ISO currency code.
- Use integer types for amounts and separate `currency` string.
- Do not use floating-point types for currency.

## Uniqueness Constraints (conceptual)

- `ProviderService` must enforce uniqueness on `(providerOrigin, externalId)`.
- `TenantServiceOverride` must enforce uniqueness on `(tenantId, masterServiceId)`.

## Idempotency and Provider Identity

- Match provider records by the composite key `(providerOrigin, externalId)` to find existing `ProviderService` records.
- On import, either create or update `ProviderService` and create or update corresponding `StagedService` entries. Do not create duplicate `ProviderService` records for the same composite key.

