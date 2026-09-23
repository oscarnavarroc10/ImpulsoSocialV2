# Tasks: Provider-Agnostic Service Capability Foundation

**Input**: Design documents from `/specs/013-provider-agnostic-service-capability/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Scope**: Implementation tasks only for the approved Feature 013 design. `STANDARD` is the only executable BulkFollows capability in this feature. `CUSTOM_COMMENTS` is modeled only for normalization/rejection and remains non-orderable until its provider contract is verified.

## Phase 1: Setup

**Purpose**: Establish shared implementation seams without changing runtime behavior.

- [ ] T001 Add the Feature 013 provider-offering implementation boundaries to `backend/src/modules/catalog/` and `backend/src/modules/orders/` without adding provider-specific customer APIs.
- [ ] T002 [P] Add the provider-neutral capability and adapter type contracts described in `specs/013-provider-agnostic-service-capability/contracts/customer-catalog-capability.md` and `specs/013-provider-agnostic-service-capability/contracts/provider-order-adapter.md` to the owning backend modules.
- [ ] T003 [P] Add focused fake provider, catalog, and Prisma fixtures under `backend/test/fixtures/` or the nearest existing test fixture modules without reading provider credentials or performing network calls.
- [ ] T004 Run the existing backend catalog/order unit and contract suites before implementation changes and record the baseline in `specs/013-provider-agnostic-service-capability/quickstart.md`.

## Phase 2: Foundational Schema And Domain

**Purpose**: Add the additive data model and invariants required by every user story.

- [ ] T005 Add the `MasterServiceProviderOffering` Prisma model and relations to `backend/prisma/schema.prisma` with `masterServiceId`, `providerServiceId`, capability contract fields, availability fields, selection fields, timestamps, and a unique `(masterServiceId, providerServiceId)` constraint.
- [ ] T006 Add nullable historical offering/provider-service/capability linkage fields to `OrdenProveedor` in `backend/prisma/schema.prisma` while retaining `proveedor`, `idExterno`, request/response JSON, existing uniqueness, and existing indexes.
- [ ] T007 Add the private structured order-input snapshot field to `Orden` in `backend/prisma/schema.prisma` when the JSON-on-existing-persistence design is clean; otherwise document and implement the single private one-to-one order-input record selected during schema review, without capability-specific tables or nullable `Orden.cantidad`.
- [ ] T008 Add MySQL/MariaDB-compatible offering lookup indexes to `backend/prisma/schema.prisma`, including MasterService selection/availability and provider-service availability lookups; do not add a PostgreSQL-style partial unique index or index private comment text.
- [ ] T009 Implement transactional selection updates in the offering repository/service under `backend/src/modules/catalog/infrastructure/` and `backend/src/modules/catalog/application/`, enforcing that each MasterService has at most one `isSelected = true` offering while allowing multiple non-selected offerings.
- [ ] T010 [P] Add Prisma model/relation type fixtures and schema contract tests in `backend/test/integration/catalog/` covering duplicate mapping rejection, multiple non-selected offerings, and the selected-offering invariant.
- [ ] T011 Validate the additive schema with `backend/prisma/schema.prisma` and generated Prisma types in a disposable test database before proceeding to provider normalization; do not create production migrations or modify application behavior in this gate.

**Checkpoint**: The schema supports multiple offerings, one selected offering at most, nullable historical linkage, and private input snapshots without changing existing Standard behavior.

## Phase 3: User Story A - Standard Order (Priority: P1) MVP

**Goal**: Resolve an explicit platform-global Standard offering and preserve current wallet, pricing, idempotency, and provider-attempt behavior.

**Independent Test**: A fake-adapter Standard order uses the selected offering once, debits the wallet atomically, preserves the existing fingerprint, and returns the existing accepted/rejected/uncertain behavior.

### Tests for User Story A

- [ ] T012 [P] [US1] Extend `backend/test/unit/catalog/` capability-normalization tests to map verified BulkFollows `Default` metadata to `STANDARD` and reject malformed or unknown capability metadata.
- [ ] T013 [P] [US1] Extend `backend/test/unit/orders/order.service.spec.ts` with selected-offering Standard order cases covering valid bounds, absent selection, unavailable selection, ambiguous selection, and zero wallet/provider side effects on rejection.
- [ ] T014 [P] [US1] Extend `backend/test/unit/orders/order.service.spec.ts` with existing `STANDARD` fingerprint compatibility cases proving private snapshots and capability metadata do not alter the current `[serviceId, target, quantity]` representation.
- [ ] T015 [P] [US1] Extend `backend/test/contract/orders/` with safe Standard response assertions that exclude provider origin, provider service IDs, provider costs, raw payloads, credentials, routing state, and private input snapshots.

### Implementation for User Story A

- [ ] T016 Implement the normalized capability contract and validation types in `backend/src/modules/catalog/` so `STANDARD` is supported, unknown capabilities fail closed, and no title/description/category parsing determines capability.
- [ ] T017 Implement offering repository reads and tenant-aware candidate resolution in `backend/src/modules/catalog/infrastructure/` and `backend/src/modules/orders/infrastructure/order.repository.ts`, using platform-global selected offering plus `TenantServiceOverride` commercial filtering.
- [ ] T018 Replace new-order direct `provenanceRef` routing in `backend/src/modules/orders/infrastructure/order.repository.ts` with offering resolution while retaining a temporary unbackfilled Standard compatibility path through `provenanceRef` and the existing `readQuantityBounds` normalizer.
- [ ] T019 Preserve integer minor-unit pricing, per-1,000 calculations, wallet debit, insufficient-balance handling, and existing Standard quantity validation in `backend/src/modules/orders/application/order.service.ts` and `backend/src/modules/orders/infrastructure/order.repository.ts`.
- [ ] T020 Register the offering resolver and capability services in `backend/src/modules/catalog/catalog.module.ts` and `backend/src/modules/orders/orders.module.ts` without introducing a dynamic plugin framework.
- [ ] T021 Run the focused Standard order tests in `backend/test/unit/orders/`, existing wallet tests in `backend/test/unit/wallets/`, and existing BulkFollows order client tests in `backend/test/contract/orders/` as the first MVP gate before starting other user stories.

## Phase 4: User Story B - Custom Comments Fail-Closed (Priority: P1)

**Goal**: Represent `CUSTOM_COMMENTS` as a provider-neutral capability while refusing purchase until verified BulkFollows semantics exist.

**Independent Test**: A Custom Comments offering with unresolved contract or quantity semantics is rejected before order creation, wallet debit, or provider dispatch.

### Tests for User Story B

- [ ] T022 [P] [US2] Add `CUSTOM_COMMENTS` normalization fixtures under `backend/test/unit/catalog/` proving unresolved BulkFollows contract metadata becomes unsupported/non-orderable rather than `STANDARD`.
- [ ] T023 [P] [US2] Extend `backend/test/unit/orders/order.service.spec.ts` with empty-comments, unknown-quantity-semantics, and unsupported-Custom-Comments cases that assert no wallet/order writes and no adapter call.
- [ ] T024 [P] [US2] Add canonical-input unit cases under `backend/test/unit/orders/` for the versioned dynamic-input representation, but keep executable Custom Comments submission disabled until provider evidence is approved.

### Implementation for User Story B

- [ ] T025 Implement `CUSTOM_COMMENTS` capability metadata storage and validation in `backend/src/modules/catalog/` without inventing quantity, bounds, blank-line, trimming, duplicate, pricing, or provider-field semantics.
- [ ] T026 Add fail-closed unsupported-capability handling in `backend/src/modules/orders/application/order.service.ts` and `backend/src/modules/orders/infrastructure/order.repository.ts` before wallet/order side effects.
- [ ] T027 Keep `Orden.cantidad` required and preserve it as effective quantity only when a future verified capability contract makes quantity deterministic; document the guard in the order input snapshot mapper under `backend/src/modules/orders/`.
- [ ] T028 Run the Custom Comments rejection suite in `backend/test/unit/orders/` and verify no executable BulkFollows Custom Comments request path or live-provider test exists in `backend/src/modules/orders/` and `backend/test/`.

## Phase 5: User Story D - Provider Configuration Foundation (Priority: P2)

**Goal**: Persist explicit platform-level offering mappings and selection without building provider Admin UI.

**Independent Test**: Repository/application fixtures can create, enable, disable, and select offerings deterministically while preserving tenant commercial overrides.

### Tests for User Story D

- [ ] T029 [P] [US4] Add offering repository tests in `backend/test/unit/catalog/` for zero, one, and multiple mappings, disabled offerings, unavailable offerings, and at-most-one-selected concurrency behavior.
- [ ] T030 [P] [US4] Add tenant isolation tests in `backend/test/unit/catalog/public-catalog.service.spec.ts` and `backend/test/unit/orders/order.service.spec.ts` proving `TenantServiceOverride` controls enablement/price independently from platform-global routing.

### Implementation for User Story D

- [ ] T031 Implement offering mapping/selection repository methods in `backend/src/modules/catalog/infrastructure/` with transactional selection updates and MySQL/MariaDB-compatible locking or equivalent application invariant.
- [ ] T032 Integrate explicit offering creation/update during curated catalog workflows in `backend/src/modules/catalog/application/curation.service.ts` and `backend/src/modules/catalog/infrastructure/master-service.repository.ts` without overwriting or repurposing `MasterService.provenanceRef`.
- [ ] T033 Register offering data access in `backend/src/modules/catalog/catalog.module.ts` and preserve platform-admin authorization boundaries through existing catalog security modules.
- [ ] T034 Run the selection invariant tests in `backend/test/unit/catalog/` and tenant-commercial-isolation tests in `backend/test/unit/orders/` before provider backfill or order dispatch changes.

## Phase 6: User Story E - Provider Replacement (Priority: P2)

**Goal**: Change the selected offering for new orders while preserving the MasterService identity and tenant commercial layer.

**Independent Test**: Switching selected offering A to B changes only new-order resolution; MasterService identity, price override, and existing historical order routing remain stable.

### Tests for User Story E

- [ ] T035 [P] [US5] Add provider-replacement integration fixtures in `backend/test/integration/catalog/` proving explicit curated mappings do not merge by title, category, description, price, or similar text.
- [ ] T036 [P] [US5] Add order-resolution tests in `backend/test/unit/orders/order.repository.spec.ts` proving a selection switch affects only new orders and never silently substitutes an unavailable offering.

### Implementation for User Story E

- [ ] T037 Implement deterministic selected-offering resolution in `backend/src/modules/orders/infrastructure/order.repository.ts` and preserve `TenantServiceOverride` price/enablement resolution.
- [ ] T038 Update provider availability synchronization in `backend/src/modules/catalog/` to disable disappeared offerings while retaining MasterService and future Favorite compatibility; do not implement Favorites or Admin UI.
- [ ] T039 Run the replacement and no-silent-substitution tests in `backend/test/integration/catalog/` and `backend/test/unit/orders/` with fake provider records only.

## Phase 7: User Story F - Historical Order Binding (Priority: P1)

**Goal**: Keep existing and new orders permanently bound to the provider offering originally used.

**Independent Test**: After switching from provider A to B, an existing order still resolves status/reconciliation through A; ambiguous historical records remain on legacy fields.

### Tests for User Story F

- [ ] T040 [P] [US6] Add historical-binding unit tests in `backend/test/unit/orders/order.repository.spec.ts` proving new orders persist offering/provider-service/capability snapshots before provider acceptance.
- [ ] T041 [P] [US6] Add historical-routing integration tests in `backend/test/integration/catalog/` or `backend/test/contract/orders/` proving current selection changes do not alter existing order provider resolution.
- [ ] T042 [P] [US6] Add legacy-history fixtures in `backend/test/fixtures/legacy-order-history.ts` proving `OrdenProveedor.idExterno` is treated as external provider ORDER ID, never `ProviderService.externalId`, and records without independent deterministic evidence retain nullable new linkage and legacy resolution.

### Implementation for User Story F

- [ ] T043 Reuse `OrdenProveedor` in `backend/src/modules/orders/infrastructure/order.repository.ts` for immutable offering/provider-service/capability linkage while retaining legacy `proveedor`, `idExterno`, request, response, status, and cost fields.
- [ ] T044 Resolve status, refill, cancellation, and reconciliation from historical private binding in `backend/src/modules/orders/application/order.service.ts` and `backend/src/modules/orders/infrastructure/`, with legacy fallback only for rows whose new linkage is null.
- [ ] T045 Implement the deterministic historical-linkage predicate in the backfill/resolution module under `backend/src/modules/catalog/` or `backend/src/modules/orders/`; reject inference from external order ID, titles, descriptions, prices, categories, or text similarity.
- [ ] T046 Run the historical binding gate in `backend/test/unit/orders/` and verify existing `OrdenProveedor` rows remain readable when new nullable linkage is absent.

## Phase 8: User Story C - Provider Transparency (Priority: P1)

**Goal**: Keep provider infrastructure private while exposing only stable MasterService and approved normalized capability data.

**Independent Test**: Catalog/order responses and serialized errors containing provider fixtures expose no provider-private fields.

### Tests for User Story C

- [ ] T047 [P] [US3] Extend `backend/test/contract/catalog/public-catalog.controller.spec.ts` with recursive assertions excluding provider identity, external IDs, costs, raw payloads, credentials, offering IDs, routing state, and private input snapshots.
- [ ] T048 [P] [US3] Extend `backend/test/contract/orders/` with recursive safe-order-response and sanitized-error assertions using fake provider payloads.

### Implementation for User Story C

- [ ] T049 Add the optional normalized capability projection to `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` and `backend/src/modules/catalog/application/public-catalog.service.ts` only for valid selected offerings; preserve existing public fields.
- [ ] T050 Update `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts` to read normalized offering metadata first and retain raw BulkFollows bounds only as a compatibility fallback during migration.
- [ ] T051 Add Swagger metadata in `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` and customer-safe mapping tests in `backend/test/contract/catalog/` without exposing provider type codes, provider origins, external IDs, costs, raw payloads, credentials, offering IDs, routing configuration, or private snapshots.
- [ ] T052 Run public catalog suites in `backend/test/contract/catalog/`, order contract suites in `backend/test/contract/orders/`, and tenant isolation suites in `backend/test/` as the provider-transparency gate.

## Phase 9: User Story G - Provider Unavailable (Priority: P1)

**Goal**: Prevent orders through unavailable, unsupported, missing, or ambiguously selected offerings.

**Independent Test**: Every unavailable/unsupported condition fails closed before wallet/order writes or provider dispatch.

### Tests for User Story G

- [ ] T053 [P] [US7] Add failure-case tests in `backend/test/unit/orders/order.service.spec.ts` for missing offering, disabled offering, disappeared ProviderService, malformed capability, unsupported capability, missing credentials, and invalid provider configuration using fakes only.
- [ ] T054 [P] [US7] Add BulkFollows timeout/unknown-result regression tests in `backend/test/contract/orders/bulkfollows-order.client.spec.ts` proving one attempt, no second provider attempt, and preserved uncertain state.
- [ ] T055 [P] [US7] Add wallet/refund regression assertions in `backend/test/unit/orders/` and existing wallet test files proving fail-closed resolution does not debit and existing provider rejection/partial refund behavior is unchanged.

### Implementation for User Story G

- [ ] T056 Implement stable sanitized unavailable/unsupported errors in `backend/src/modules/orders/application/order.service.ts` and preserve current authorization, tenant, wallet, and idempotency boundaries.
- [ ] T057 Preserve timeout, accepted/rejected/unknown, status validation, and credential-sanitization behavior in `backend/src/modules/orders/infrastructure/bulkfollows-order.client.ts` while moving provider status mapping behind the provider-neutral adapter boundary.
- [ ] T058 Run the unavailable-offering, timeout/unknown-result, wallet, refund, and tenant-isolation gate before migration rollout.

## Phase 10: User Story H - Future Favorite Compatibility (Priority: P3)

**Goal**: Preserve the future ability to reference only `(userId, masterServiceId)` without implementing Favorites.

**Independent Test**: Data-model and replacement fixtures prove provider changes/disappearance do not require provider references in a future Favorite identity.

### Tests for User Story H

- [ ] T059 [P] [US8] Add a model-level compatibility test under `backend/test/integration/catalog/` proving the offering relation and provider disappearance do not delete or require a future `(userId, masterServiceId)` reference.

### Implementation for User Story H

- [ ] T060 Document the MasterService-only Favorite compatibility rule in the relevant catalog domain contract under `backend/src/modules/catalog/` without creating a Favorite entity, endpoint, UI, or persistence implementation.

## Phase 11: Deterministic Backfill And Migration Verification

**Purpose**: Migrate only proven existing BulkFollows Standard mappings and preserve ambiguous legacy history.

- [ ] T061 Add deterministic backfill query/report logic under `backend/src/modules/catalog/` that inventories active MasterServices with `provenanceRef`, verifies the referenced ProviderService, and classifies missing, malformed, unsupported, duplicate, and disappeared relationships.
- [ ] T062 Add backfill tests in `backend/test/integration/catalog/sync-idempotency.spec.ts` and a focused catalog backfill test proving only independently verified Standard mappings receive offerings.
- [ ] T063 Add historical backfill tests in `backend/test/integration/catalog/` proving `OrdenProveedor.idExterno` is never matched to `ProviderService.externalId`; ambiguous records remain nullable and resolve through legacy provider fields.
- [ ] T064 Add migration verification fixtures under `backend/test/integration/catalog/` covering existing Standard orders, tenant overrides, wallet movements, refunds, idempotency rows, and existing `OrdenProveedor` rows before and after additive linkage.
- [ ] T065 Execute the disposable-database Prisma validation/generation/migration dry-run described in `specs/013-provider-agnostic-service-capability/quickstart.md` and record the result before production rollout.
- [ ] T066 Run the complete backend regression suite from `backend/` covering catalog, orders, wallet, refunds, auth, deposits, tenant isolation, contracts, and integration fixtures with no live provider calls.

## Phase 12: Polish And Cross-Cutting Verification

- [ ] T067 [P] Update backend Swagger/contract documentation and implementation notes for the safe capability projection in `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` and `specs/013-provider-agnostic-service-capability/contracts/`.
- [ ] T068 [P] Add recursive security assertions for provider credentials, raw payloads, provider order IDs, provider costs, routing configuration, and private snapshots across `backend/test/contract/catalog/` and `backend/test/contract/orders/`.
- [ ] T069 Run `git diff --check`, the focused Feature 013 suites, the full backend suite, and the final quickstart validation without calling BulkFollows/SMMGEN or inspecting credentials.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: T001-T004; no Feature 013 runtime behavior should change before the baseline is captured.
- **Phase 2 Foundational**: T005-T011; blocks all user-story implementation and must pass the schema/invariant gate.
- **Phase 3 US1 Standard MVP**: T012-T021; depends on Phase 2 and is the first executable increment.
- **Phase 4 US2 Custom Comments**: T022-T028; depends on capability foundation, but remains rejection-only until provider evidence is approved.
- **Phase 5 US4 Configuration**: T029-T034; depends on Phase 2 and supports US1/US5/US7.
- **Phase 6 US5 Replacement**: T035-T039; depends on US4.
- **Phase 7 US6 Historical Binding**: T040-T046; depends on schema and the order resolver.
- **Phase 8 US3 Transparency**: T047-T052; depends on normalized offering reads and order binding.
- **Phase 9 US7 Unavailable**: T053-T058; depends on resolver, adapter boundary, and existing wallet protections.
- **Phase 10 US8 Future Favorite Compatibility**: T059-T060; depends on stable MasterService/offering relations and remains compatibility-only.
- **Phase 11 Backfill/Migration Verification**: T061-T066; depends on all read paths and historical binding rules being available.
- **Phase 12 Polish**: T067-T069; depends on completed implementation and all prior gates.

### Parallel Opportunities

- T002-T004 can run in parallel after the repository baseline is recorded.
- T010 can run in parallel with T005-T009 because it targets schema/invariant verification, but T011 gates progression.
- T012-T015 can run in parallel because they touch separate focused test surfaces.
- T022-T024 can run in parallel with T025-T026 only when test fixtures do not require final implementation types; otherwise tests precede implementation.
- T029-T030 can run in parallel; T031-T034 remain sequential because they share offering-selection behavior.
- T035-T036 can run in parallel; T037-T039 are sequential.
- T040-T042 can run in parallel; T043-T046 are sequential historical-binding work.
- T047-T048 can run in parallel; T049-T052 are sequential public-contract work.
- T053-T055 can run in parallel; T056-T058 are sequential fail-closed integration work.
- T061-T064 can run in parallel after historical schemas are available; T065-T066 are final gates.
- T067-T068 can run in parallel before T069.

## Migration And Backfill Gates

- **Schema gate**: T011 must prove additive Prisma shape, selected-offering invariant, multiple non-selected offerings, and preserved legacy rows.
- **Standard MVP gate**: T021 must prove current Standard fingerprints, wallet debit, pricing, refund basis, and accepted/rejected/unknown provider outcomes remain compatible.
- **Historical gate**: T046 must prove provider binding is immutable for new orders and nullable legacy linkage remains supported.
- **Backfill gate**: T063 must prove no `idExterno`-to-`externalId` inference and no text-based matching.
- **Migration gate**: T065 must pass on a disposable MySQL/MariaDB database before rollout.
- **Regression gate**: T066 and T069 must pass with fake transports and no live provider operations.

## Implementation Strategy

### MVP First

1. Complete T001-T011 for setup and schema foundation.
2. Complete T012-T021 for executable BulkFollows `STANDARD` ordering.
3. Stop and validate the Standard MVP independently before enabling any additional capability behavior.

### Incremental Delivery

1. Add fail-closed Custom Comments representation without executable submission.
2. Add explicit offering configuration and replacement behavior without Admin UI.
3. Add immutable historical binding and conservative backfill.
4. Add safe normalized catalog capability projection.
5. Complete regression, migration, security, and financial verification.

## Deferred Work Confirmed Absent From Tasks

- SMMGEN importer, adapter, status/refill/cancel/balance integration, and live calls.
- Provider credential administration or encrypted/admin-editable secret storage.
- Provider Admin UI or offering-selection UI.
- Favorites entity, endpoints, persistence, UI, or runtime implementation.
- Tenant-specific provider routing.
- Automatic failover, cheapest-provider routing, ranking, random routing, or cross-provider retry.
- Unsupported dynamic capabilities and executable BulkFollows `CUSTOM_COMMENTS` ordering.
- Angular dynamic form implementation and unrelated Feature 012 UI work.
- Live provider/order tests, real orders, balance, refill, cancel, or reconciliation calls.

## Remaining Evidence Dependency

- T022-T028 and any future executable Custom Comments work remain blocked until the exact BulkFollows Custom Comments request contract, quantity mode, bounds, blank-line/trimming/duplicate rules, pricing quantity, and provider field names are independently verified. This task list intentionally does not invent or implement those semantics.
