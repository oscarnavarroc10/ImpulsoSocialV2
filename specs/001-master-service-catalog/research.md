# Research: Master Service Catalog (Phase 0)

## Purpose

Resolve open questions from the specification and record design decisions and rationale to drive Phase 1 design.

## Decisions

### Pricing model granularity

Decision: Custom (v1 supports `Provider Cost` and `Default Selling Price` per MasterService). Tenant catalogs inherit `Default Selling Price` and may supply a `Tenant Selling Price` override. Tiered pricing is out of scope for v1.

Rationale: Reduces implementation complexity for v1 while supporting business needs for centralized pricing and tenant overrides.

Alternatives considered:
- Tiered pricing (more expressive) — rejected for v1 due to complexity in rules engine and testing.
- Hybrid (flat + tiers) — deferred to future iterations.

### Visibility model

Decision: Inheritance (Master Catalog → Tenant Catalog). A service visible in the Master Catalog is inherited by tenants unless explicitly disabled for a tenant.

Rationale: Simpler admin mental model and easier enforcement of White Label defaults.

Alternatives considered:
- Independent rules evaluated together — more flexible but increases admin complexity.

### Sync conflict resolution

Decision: Provider synchronization MUST NOT overwrite curated business fields. Provider updates limited to technical metadata; differences are recorded for admin review.

Rationale: Preserve administrator control and prevent accidental overwrites of curated business information (names, descriptions, categories, visibility, selling price).

Alternatives considered:
- Auto-merge non-curated fields — still acceptable as an enhancement for future releases.

## Security & Architecture Constraints

- Provider integrations must be backend-only; credentials stored in secure backend config.
- Provider raw payloads and provider identifiers must never be included in tenant-facing exports.
- Multi-tenant isolation and auditing are required by constitution.

## Operational Notes

- Initial provider catalog sizing assumption: thousands of services. Plan for pagination and incremental syncs.
- Import provenance: keep raw payloads in secured storage for reconciliation and admin review, but strip them from any tenant exports.

## Additional Decisions & Rationale (explicit)

### Scheduled and On-demand Synchronization

Decision: v1 will provide two synchronization triggers:

- A scheduled in-process NestJS job (CRON) that runs at configured intervals to keep the staging area reasonably fresh.
- An on-demand administrative trigger (protected administrative interface) to run the same synchronization logic immediately.

Rationale: Scheduled jobs automate regular updates; on-demand support allows admins to react to provider changes or troubleshoot. Implementing both in-process avoids introducing external queueing systems for v1 and keeps the architecture simple and auditable.

Operational notes:

- The scheduled job will be configured with reasonable rate limits and pagination to avoid provider throttling.
- Each run produces a `SyncJob` record for auditing and operational visibility.

### Idempotency and Provider Identity

Decision: Synchronization must be idempotent. Match provider records by `externalId` (provider identifier) and provider origin. If a provider service with the same `externalId` and origin already exists, update the existing `ProviderService` internal record; otherwise create a new internal `ProviderService` record.

Rationale: Idempotent imports prevent duplicate records and make repeated syncs safe. Matching on `externalId` + origin supports scenarios where multiple providers exist or IDs may collide across providers.

Implementation notes:

- Use `externalId` and provider origin as a composite key to detect existing provider records.
- On update, only synchronize technical provider metadata into `ProviderService.rawPayload`/`metadata` and `StagedService.proposed*` fields; do not overwrite curated `MasterService` business fields.

### Immutable Snapshot Publication

Decision: Published master snapshots (represented by `MasterCatalogSnapshot`) are immutable. Publishing creates a new snapshot record containing `MasterCatalogSnapshotItem` entries derived from current curated `MasterService` records.

Rationale: Immutable snapshots provide reproducible tenant catalogs, support rollbacks, and preserve historical state for audits and troubleshooting.

Operational notes:

- Snapshots are versioned; once published, they cannot be modified. To change a published snapshot, create a new one.
- Tenant catalog generation consumes a published snapshot; the tenant-generation pipeline is out of scope for this feature.

### Monetary Storage and Currency Handling

Decision: Store all monetary values as integer minor units (e.g., cents) together with an ISO 4217 currency code. Use integer types (e.g., BIGINT) in the DB and domain objects that enforce currency consistency.

Rationale: Prevents rounding/precision issues from floating-point arithmetic and simplifies aggregation and comparisons.

Operational notes:

- Ensure currency consistency when applying tenant overrides; conversions are out of scope for v1 unless required by a tenant.
- Validate currency codes against ISO lists on input.

### Raw Provider Payload Retention and Protection

Decision: Retain raw provider payloads in secured backend storage associated with `ProviderService`. Raw payloads are accessible only to authorized administrative/system processes for reconciliation and debugging and are never exported to tenant-facing snapshots or APIs.

Rationale: Raw payload retention is necessary for reconciliation, debugging, and dispute resolution with providers, but must be protected to avoid leaking provider-sensitive data or credentials.

Operational notes:

- Store raw payloads encrypted-at-rest where possible and restrict read access via RBAC.
- Logs must never contain full raw payloads. Only store hashes or truncated fingerprints in logs when needed for correlation.
- Access to raw payloads requires an audit trail entry.

