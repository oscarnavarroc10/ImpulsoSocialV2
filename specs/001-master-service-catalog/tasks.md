# Tasks: Master Service Catalog

## Phase 1: Setup

- [x] T001 [P] Create the required `CatalogModule` structure and NestJS module files without empty README, index, or placeholder files — `backend/src/modules/catalog/catalog.module.ts`
- [x] T002 [P] Add and review the approved Prisma models for `ProviderService`, `StagedService`, `MasterService`, `Category`, `TenantServiceOverride`, `MasterCatalogSnapshot`, `MasterCatalogSnapshotItem`, `SyncJob`, and `AuditLog` — `backend/prisma/schema.prisma`
- [x] T003 Generate the Prisma client and validate the completed Prisma schema — `backend/prisma/schema.prisma`
- [x] T004 Generate and validate the initial Prisma migration using the standard Prisma development workflow; document forward-fix recovery and restrict `prisma migrate reset` to local development — `backend/prisma/migrations/`
- [x] T005 [P] Add an environment template containing only `DATABASE_URL` and application variables already explicitly approved; do not invent BulkFollows-specific configuration — `backend/.env.example`

## Phase 2: Foundational Prerequisites

- [x] T006 Implement a minimal catalog authorization contract that integrates with the project’s existing authenticated-user and role mechanism; if authentication does not yet exist, expose it as an external prerequisite instead of building a new authentication system — `backend/src/modules/catalog/security/catalog-authorization.guard.ts`
- [x] T007 [P] Define a provider-agnostic catalog provider client interface for fetching provider services — `backend/src/modules/catalog/infrastructure/provider-catalog-client.ts`
- [x] T008 Implement the concrete `BulkFollowsClient` using only the authentication, endpoint, request, response, timeout, retry, and pagination behavior confirmed by the actual BulkFollows API contract — `backend/src/modules/catalog/infrastructure/bulkfollows.client.ts`
- [x] T009 Add deterministic BulkFollows contract and response-mapping tests using fixtures or a fake HTTP transport; never call the live provider API — `backend/test/contract/catalog/bulkfollows-client.spec.ts`
- [x] T010 Implement the Prisma-backed `ProviderServiceRepository`, including idempotent lookup and upsert behavior based on `providerOrigin` and `externalId` — `backend/src/modules/catalog/infrastructure/provider-service.repository.ts`
- [x] T011 Implement the Prisma-backed `StagedServiceRepository` used by the provider import and administrative review flow — `backend/src/modules/catalog/infrastructure/staged-service.repository.ts`
- [x] T012 Implement the Prisma-backed `MasterServiceRepository`, preserving curated business fields separately from provider-controlled technical metadata — `backend/src/modules/catalog/infrastructure/master-service.repository.ts`
- [x] T013 [P] Implement reusable `AuditService` operations for import, curation, deprecation, snapshot publication, and export actions — `backend/src/modules/catalog/infrastructure/audit.service.ts`
- [x] T014 Implement `SyncService` using the approved in-process NestJS scheduler and an on-demand trigger; persist `SyncJob` status and summaries without introducing an event bus or external queue — `backend/src/modules/catalog/sync/sync.service.ts`
- [x] T015 [P] Implement DTOs and validation for the on-demand synchronization request — `backend/src/modules/catalog/application/dto/sync.dto.ts`
- [x] T016 [P] Implement DTOs and validation for staged-service approval and rejection with curated field edits — `backend/src/modules/catalog/application/dto/staged-curation.dto.ts`
- [x] T017 [P] Implement DTOs and validation for category creation and updates — `backend/src/modules/catalog/application/dto/category.dto.ts`
- [x] T018 [P] Implement DTOs and validation for tenant service overrides — `backend/src/modules/catalog/application/dto/tenant-service-override.dto.ts`
- [x] T019 [P] Implement DTOs and validation for snapshot publication — `backend/src/modules/catalog/application/dto/snapshot.dto.ts`

## Phase 3: User Story 1 — Import and Curate Provider Services

**Priority:** P1

**Independent completion:** Provider services can be synchronized, staged, reviewed, approved or rejected, deprecated through administrative review, and tracked through accurate `SyncJob` records. Repeated imports do not create duplicates or overwrite curated business fields.

- [X] T020 [US1] Implement provider import orchestration using `ProviderCatalogClient`: fetch provider services, map responses, upsert `ProviderService`, create or update staging records, and persist the final `SyncJob` summary — `backend/src/modules/catalog/sync/import-orchestrator.ts`
- [x] T021 [US1] Implement partial-failure handling so provider request or mapping failures produce accurate `SyncJob` status, failure counts, and error summaries without falsely reporting success — `backend/src/modules/catalog/sync/import-orchestrator.ts`
- [x] T022 [US1] Implement the curation application service for staged-service listing, approval, rejection, curated field edits, internal identifier generation, and provenance assignment — `backend/src/modules/catalog/application/curation.service.ts`
- [x] T023 [US1] Implement the provider-service deprecation review flow; services missing from the provider response must require administrative confirmation before the related master service becomes deprecated — `backend/src/modules/catalog/application/deprecation.service.ts`
- [x] T024 [US1] Implement the protected administrative endpoint for triggering an on-demand provider synchronization — `backend/src/modules/catalog/presentation/sync.controller.ts`
- [x] T025 [US1] Implement protected administrative endpoints for listing staged services and approving or rejecting them with curated edits — `backend/src/modules/catalog/presentation/staged-service.controller.ts`
- [x] T026 [US1] Implement protected administrative endpoints for reviewing and confirming provider-service deprecations — `backend/src/modules/catalog/presentation/deprecation.controller.ts`
- [x] T027 [US1] Add integration tests for synchronization idempotency, repeated imports without duplicates, and provider updates not overwriting curated business fields — `backend/test/integration/catalog/sync-idempotency.spec.ts`
- [x] T028 [US1] Add unit tests for staged-service approval, rejection, validation, curated field mapping, and audit creation — `backend/test/unit/catalog/curation.service.spec.ts`
- [x] T029 [US1] Add unit tests for the provider-service deprecation review and confirmation flow — `backend/test/unit/catalog/deprecation.service.spec.ts`
- [x] T030 [US1] Add integration tests for scheduled and on-demand synchronization, including successful, failed, and partially failed `SyncJob` records — `backend/test/integration/catalog/sync-job.spec.ts`

## Phase 4: User Story 2 — Manage Categories and Visibility

**Priority:** P2

**Independent completion:** Platform administrators can manage categories, control master-service visibility, and resolve optional tenant enable or disable overrides without implementing the complete tenant catalog generation pipeline.

- [x] T031 [US2] Implement the `Category` domain model and category business invariants — `backend/src/modules/catalog/domain/category.entity.ts`
- [x] T032 [US2] Implement the Prisma-backed `CategoryRepository` — `backend/src/modules/catalog/infrastructure/category.repository.ts`
- [x] T033 [US2] Implement `CategoryService` for category creation, updates, listing, and allowed deletion or deactivation behavior — `backend/src/modules/catalog/application/category.service.ts`
- [x] T034 [US2] Implement protected administrative category CRUD endpoints — `backend/src/modules/catalog/presentation/category.controller.ts`
- [ ] T035 [US2] Implement master-service visibility management using `MasterService.isVisible` — `backend/src/modules/catalog/application/master-service-visibility.service.ts`
- [ ] T036 [US2] Implement visibility resolution that combines master-level visibility with an optional tenant enable or disable override for future tenant-catalog consumers — `backend/src/modules/catalog/application/visibility-resolution.service.ts`
- [ ] T037 [US2] Implement protected administrative endpoints for updating master-service visibility — `backend/src/modules/catalog/presentation/master-service-visibility.controller.ts`
- [x] T038 [US2] Add unit tests for category business logic and CRUD behavior — `backend/test/unit/catalog/category.service.spec.ts`
- [ ] T039 [US2] Add unit tests for master visibility and tenant override resolution behavior — `backend/test/unit/catalog/visibility-resolution.service.spec.ts`

## Phase 5: User Story 3 — Pricing, Tenant Overrides, Snapshots, and Export

**Priority:** P3

**Independent completion:** Tenant-level service overrides can be stored and managed, approved monetary rules are validated, immutable master catalog snapshots can be published, and exported JSON matches the approved public contract without leaking provider data.

- [ ] T040 [US3] Implement the Prisma-backed `TenantServiceOverrideRepository` with the unique database constraint on `tenantId` and `masterServiceId` — `backend/src/modules/catalog/infrastructure/tenant-service-override.repository.ts`
- [ ] T041 [US3] Implement `TenantServiceOverrideService` for creating, updating, reading, and removing tenant enable or disable and selling-price overrides — `backend/src/modules/catalog/application/tenant-service-override.service.ts`
- [ ] T042 [US3] Implement protected administrative endpoints for managing tenant service overrides — `backend/src/modules/catalog/presentation/tenant-service-override.controller.ts`
- [ ] T043 [US3] Implement monetary validation using integer minor units, non-negative values, approved ISO currency representation, and currency consistency when monetary values are compared; do not add markup, margin, tier, commission, or automatic pricing rules — `backend/src/modules/catalog/application/pricing.validation.ts`
- [ ] T044 [US3] Implement `SnapshotService` to create draft snapshots from curated master services and categories only, publish them with `publishedAt`, and prevent modification after publication — `backend/src/modules/catalog/snapshot/snapshot.service.ts`
- [ ] T045 [US3] Implement the protected administrative endpoint for creating and publishing master catalog snapshots — `backend/src/modules/catalog/presentation/snapshot.controller.ts`
- [ ] T046 [US3] Implement the export service for published snapshots using only approved public fields; exclude `providerOrigin`, `externalId`, `rawPayload`, credentials, and internal provider metadata — `backend/src/modules/catalog/snapshot/export.service.ts`
- [ ] T047 [US3] Implement the protected administrative endpoint for exporting a published master catalog snapshot — `backend/src/modules/catalog/presentation/snapshot-export.controller.ts`
- [ ] T048 [US3] Add integration tests for tenant override uniqueness, enable or disable behavior, optional selling-price override behavior, and pricing validation — `backend/test/integration/catalog/tenant-service-override.spec.ts`
- [ ] T049 [US3] Add integration tests for draft snapshot creation, publication, `publishedAt`, and immutability after publication — `backend/test/integration/catalog/snapshot-publication.spec.ts`
- [ ] T050 [US3] Add contract tests confirming exported snapshot JSON matches the approved export contract and never exposes provider identifiers, payloads, credentials, or internal provider metadata — `backend/test/contract/catalog/master-catalog-export.spec.ts`

## Phase 6: Polish and Cross-Cutting Concerns

- [ ] T051 Add an end-to-end integration test covering fake provider synchronization, staging, approval, snapshot publication, and export without calling the live BulkFollows API — `backend/test/integration/catalog/master-catalog.e2e-spec.ts`
- [ ] T052 Add security tests verifying that unauthorized users cannot trigger synchronization, curate services, confirm deprecations, manage categories, change visibility, manage tenant overrides, publish snapshots, export snapshots, or access raw provider payloads — `backend/test/security/catalog-authorization.spec.ts`
- [ ] T053 Add structured NestJS logging for synchronization and snapshot publication using the project’s existing logging facilities; do not add a new observability platform or dependency — `backend/src/modules/catalog/infrastructure/catalog-logger.service.ts`
- [ ] T054 Update the feature quickstart with actual setup, migration, synchronization, curation, publication, and export instructions — `specs/001-master-service-catalog/quickstart.md`
- [ ] T055 Add a minimal CI workflow that installs dependencies, generates the Prisma client, validates the Prisma schema, and runs catalog unit, integration, security, and contract tests — `.github/workflows/catalog-ci.yml`

## Dependencies and Execution Order

- T002 must complete before T003 and T004.
- T003 must complete before repositories that depend on the generated Prisma client.
- T006 must complete before protected controllers.
- T007 must complete before T008, T009, and T020.
- T008 must complete before T020.
- T010 and T011 must complete before T020 and T022.
- T012 must complete before T022, T023, T035, and T044.
- T013 must complete before application flows that require audit records.
- T014 and T015 must complete before T024.
- T016 must complete before T022 and T025.
- T017 must complete before T033 and T034.
- T018 must complete before T041 and T042.
- T019 must complete before T044 and T045.
- T031 and T032 must complete before T033.
- T033 must complete before T034.
- T035 must complete before T037.
- T040 must complete before T041.
- T041 must complete before T042.
- T043 must complete before pricing-sensitive tenant override and snapshot validation.
- T044 depends on curated `MasterService` and `Category` persistence, not on tenant overrides.
- T044 must complete before T045, T046, T047, T049, and T050.
- T046 must complete before T047 and T050.
- T051 must run only after the three user stories are functionally complete.

## Parallel Opportunities

- T001, T002, and T005 may be implemented in parallel.
- T007 and T006 may be implemented in parallel.
- T009 may be implemented alongside repository work after T007 is complete.
- T010, T011, T012, and T013 may be implemented in parallel after the Prisma client is generated.
- T015 through T019 may be implemented in parallel.
- Tests for an application service may be written alongside that service after its direct dependencies are available.
- T031 and T032 may be implemented in parallel.
- T035 and T036 may be implemented in parallel after the required repositories exist.
- T040 and T043 may be implemented in parallel.
- T053 and T054 may proceed once the related application behavior is stable.

## Implementation Strategy

- Deliver User Story 1 first as the MVP.
- Use one provider implementation: BulkFollows.
- Use fixtures, fakes, or mocked HTTP transport in automated tests.
- Never use live provider credentials in automated tests.
- Use in-process NestJS scheduling.
- Do not add Redis, RabbitMQ, an external queue, or an event bus.
- Do not implement a pricing engine.
- Do not implement the complete tenant catalog generation pipeline in this feature.
- Do not add unrelated infrastructure or redesign the approved data model during implementation.

## Acceptance and Done Criteria

A task may be marked complete only when:

- Its implementation matches the approved specification, plan, data model, and contracts.
- Required validation, compilation, formatting, or automated tests pass.
- Automated tests are included where feasible and valuable.
- A Prisma migration is included only when the database schema changes.
- Documentation is updated when setup or externally observable behavior changes.
- No live provider credentials or secrets are committed.
- No provider-specific assumptions are invented without confirming the actual provider contract.
- Failed validation or tests are reported honestly and the related task remains incomplete.
- Published snapshots remain immutable after publication.
- Exported snapshots contain no provider raw identifiers, raw payloads, credentials, or private provider metadata.

## Independent Completion Points

### User Story 1

Complete when T020 through T030 pass and the system supports:

- Scheduled and on-demand provider synchronization.
- Accurate `SyncJob` tracking.
- Staged-service listing.
- Approval and rejection with curated edits.
- Administrative deprecation review.
- Idempotent repeated imports.
- Protection of curated business fields from provider updates.
- Protected administrative endpoints.

### User Story 2

Complete when T031 through T039 pass and the system supports:

- Category management.
- Master-level service visibility.
- Optional tenant enable or disable overrides.
- Deterministic visibility resolution.
- Protected administrative endpoints.
- Category and visibility automated tests.

### User Story 3

Complete when T040 through T050 pass and the system supports:

- Tenant service override persistence and management.
- Approved monetary validation.
- Draft and published master catalog snapshots.
- Snapshot immutability.
- Protected snapshot publish and export endpoints.
- Contract-compliant export.
- Verification that provider-private information is never exposed.