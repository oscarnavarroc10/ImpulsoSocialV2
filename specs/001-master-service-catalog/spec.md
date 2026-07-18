# Feature Specification: Master Service Catalog

**Feature Branch**: `###-master-service-catalog`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Build the master service catalog for the SMM platform. As a platform administrator, I want to synchronize services from the BulkFollows provider, curate them into an internal master catalog, and manage categories, social networks, visibility, and pricing rules independently from the provider. The system must never expose the provider catalog directly. The master catalog will become the source used by future tenant catalogs in the White Label architecture."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import & Curate Provider Services (Priority: P1)

As a platform administrator, I can import and synchronize services from the BulkFollows provider into a staging area, review and curate them, and approve selected services into the internal master catalog.

**Why this priority**: This establishes the master catalog as the canonical, curated source of truth and prevents direct exposure of provider data.

**Independent Test**: Trigger a sync job; verify new provider services appear in staging; perform curation actions (approve/reject/edit); approved services appear in master catalog and are available for tenant catalog generation.

**Acceptance Scenarios**:

1. **Given** BulkFollows credentials and a scheduled sync job, **When** sync runs, **Then** provider services are imported into a staging area with provenance metadata (provider id, import timestamp).
2. **Given** services in staging, **When** an admin approves a service, **Then** an entry is created/updated in the master catalog with independent internal identifiers and curated fields.
3. **Given** a service rejected in curation, **When** a tenant catalog is generated, **Then** the rejected service is not included.
4. **Given** an import, curation, or publish action, **When** an audit is requested, **Then** the audit trail contains an entry with actor, timestamp, action type, and field-level deltas or notes.
5. **Given** a published master snapshot, **When** an export is requested, **Then** a versioned snapshot is produced that contains master service entries and excludes raw provider payloads and provider identifiers.

---

### User Story 2 - Manage Categories, Social Networks, Visibility (Priority: P2)

As a platform administrator, I can create and maintain categories, map services to social networks, and configure visibility rules (global, market, or tenant-specific) independent of the provider.

**Why this priority**: Categorization and visibility determine how services are surfaced to tenants and end customers; these must be managed centrally.

**Independent Test**: Create categories, assign services, set visibility rules; verify service appears/disappears in generated tenant catalogs according to rules.

**Acceptance Scenarios**:

1. **Given** a service in the master catalog, **When** an admin assigns it to `Category: Growth` and `SocialNetwork: Instagram`, **Then** the service metadata includes both relationships and is queryable by category and network.
2. **Given** a visibility rule set to `market: LATAM`, **When** tenant catalog for a LATAM tenant is generated, **Then** service is included; otherwise excluded.

---

### User Story 3 - Pricing Rules & Tenant Catalog Source (Priority: P3)

As a platform administrator, I can author pricing rules (flat, tiered, markup/discount) and apply them to master services; tenant catalogs derive pricing from the master catalog and may add tenant-level overrides.

**Why this priority**: Pricing is business-critical and must be controlled centrally for consistent white-labeling.

**Independent Test**: Create pricing rules, apply to services, and generate a tenant catalog verifying resulting prices and override behavior.

**Acceptance Scenarios**:

1. **Given** a service with base cost and a markup rule +20%, **When** tenant catalog is generated, **Then** final price reflects the markup.
2. **Given** a tenant-level override exists, **When** publishing the tenant catalog, **Then** the tenant override takes precedence for that tenant only.

---

### Edge Cases

- Provider service identifiers may change across imports — the system must map by stable attributes or keep provider provenance to reconcile differences.
- Provider service deleted/unavailable — curation must mark master service as deprecated rather than deleting it to preserve historical records.
- Conflicting updates between curated fields and subsequent provider syncs must be resolved according to admin-configurable policies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to the BulkFollows provider and run scheduled or on-demand syncs.
- **FR-002**: System MUST import provider services into a staging area and store provenance metadata (provider id, raw provider payload, import timestamp).
 - **FR-003**: System MUST provide administrative interfaces to review, edit, approve, or reject staged provider services.
 - **FR-004**: System MUST create internal `MasterService` entries with independent identifiers and curated fields; provider identifiers MUST NOT be exposed in tenant-facing catalogs or exports.
- **FR-005**: System MUST support creation and management of categories and social-network mappings, and associate master services with those categories/networks.
- **FR-006**: System MUST store both `Provider Cost` (the provider's cost) and `Default Selling Price` for each MasterService. Tenant catalogs MUST inherit the `Default Selling Price` and may optionally override it with a `Tenant Selling Price`. Tiered pricing is out of scope for v1.
- **FR-007**: System MUST support visibility rules (global, market, tenant-scoped) and apply them when generating tenant catalogs. Visibility follows a simple inheritance model: Master Catalog → Tenant Catalog. A service visible in the Master Catalog is inherited by tenants unless explicitly disabled for that tenant.
- **FR-008**: System MUST ensure provider synchronization never overwrites curated business fields. Provider updates are limited to technical metadata only. Business fields (Name, Description, Category, Visibility, Selling Price) remain under administrator control. When provider changes conflict with curated data, the system MUST retain curated values and record provider differences for administrator review.
- **FR-009**: System MUST log all import, curation, and publishing actions in an audit trail.
 - **FR-010**: System MUST provide export and versioning capabilities for the master catalog (for tenant-generation pipelines) and to publish snapshots used by White Label tenant catalogs.
- **FR-011**: System MUST enforce access control so only platform admins can manage the master catalog and provider sync credentials.
 - **FR-012**: System MUST never expose raw provider catalog payloads to tenants or public-facing endpoints.

### Key Entities *(include if feature involves data)*

- **ProviderService**: Raw record imported from BulkFollows; attributes: provider_id, raw_payload, import_timestamp, source_metadata.
- **StagedService**: ProviderService after initial ingestion, visible to admins for curation.
- **MasterService**: Curated service used by tenant catalogs; attributes: master_id, title, description, category_ids, social_networks, base_cost, pricing_rule_refs, visibility_rules, status (active/deprecated).
- **Category**: Logical grouping for services.
- **SocialNetwork**: Enum/list of supported networks (Instagram, TikTok, YouTube, etc.).
- **PricingRule**: Defines how final price is derived (type, parameters, effective dates).
- **VisibilityRule**: Scopes where the service is visible (global, market, tenant list).
- **TenantCatalogSnapshot**: Versioned snapshot derived from master catalog for a tenant/market.
- **SyncJob**: Record of import runs, result summary, and errors.
- **AuditLog**: Immutable record of admin and system actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 99% of provider services successfully imported into staging with provenance metadata for each sync run.
- **SC-002**: Admins can curate and publish a new service into the master catalog within 5 minutes of review on average.
 - **SC-003**: No tenant-facing catalogs or exports contain raw provider identifiers or raw provider payloads (0 occurrences in automated scans).
- **SC-004**: Tenant catalogs generated from a published master snapshot match expected visibility and pricing rules in 100% of automated test cases for sample tenants.
- **SC-005**: Sync runs complete within operational windows (e.g., full import < 30 minutes for expected provider size) — measure and adapt.

## Assumptions

- BulkFollows provides an API or data feed and credentials will be available to the platform.
- Initial provider catalog size is moderate (thousands of services), not millions; performance targets may be revisited later.
- Tenant catalogs are generated from versioned snapshots of the master catalog and not from live staged provider payloads.
- Platform already has an admin role and authentication system that can be reused for access control.
- Data retention, GDPR, and other compliance rules will be applied at the platform level and are out of scope for this spec except where noted.

## Questions / Clarifications (answered)

### Q1: Pricing model granularity — Custom

For v1, each MasterService stores `Provider Cost` and `Default Selling Price`. Tenant catalogs inherit the `Default Selling Price` and may optionally override it with a `Tenant Selling Price`. Tiered pricing is out of scope for v1.

### Q2: Visibility inheritance — A (Inheritance)

Visibility follows a simple inheritance model: Master Catalog → Tenant Catalog. A service visible in the Master Catalog is inherited by tenants unless explicitly disabled for that tenant. No deny lists or complex visibility rules are required in v1.

### Q3: Default conflict resolution for syncs — Custom

Provider synchronization must never overwrite curated business fields. Provider updates are limited to technical metadata only. Business information such as Name, Description, Category, Visibility, and Selling Price must always remain under administrator control. If a provider change conflicts with curated data, the system must keep the curated values and record the difference for administrator review.
