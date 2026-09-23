# Tasks: Provider-Agnostic Service Capability Foundation

**Input**: Design documents from `/specs/013-provider-agnostic-service-capability/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Scope**: Implementation tasks only for the approved Feature 013 design. `STANDARD` is the only executable BulkFollows capability in this feature. `CUSTOM_COMMENTS` is modeled only for normalization/rejection and remains non-orderable until its provider contract is verified.

## Phase 1: Setup

**Purpose**: Establish shared implementation seams without changing runtime behavior.

- [X] T001 Add the Feature 013 provider-offering implementation boundaries to `backend/src/modules/catalog/` and `backend/src/modules/orders/` without adding provider-specific customer APIs.
- [X] T002 [P] Add the provider-neutral capability and adapter type contracts described in `specs/013-provider-agnostic-service-capability/contracts/customer-catalog-capability.md` and `specs/013-provider-agnostic-service-capability/contracts/provider-order-adapter.md` to the owning backend modules.
- [X] T003 [P] Add focused fake provider, catalog, and Prisma fixtures under `backend/test/fixtures/` or the nearest existing test fixture modules without reading provider credentials or performing network calls.
- [X] T004 Run the existing backend catalog/order unit and contract suites before implementation changes and record the baseline in `specs/013-provider-agnostic-service-capability/quickstart.md`.

## Phase 2: Foundational Schema And Domain

**Purpose**: Add the additive data model and invariants required by every user story.

- [X] T005 Add the `MasterServiceProviderOffering` Prisma model and relations to `backend/prisma/schema.prisma` with `masterServiceId`, `providerServiceId`, capability contract fields, availability fields, selection fields, timestamps, and a unique `(masterServiceId, providerServiceId)` constraint.
- [X] T006 Add nullable historical offering/provider-service/capability linkage fields to `OrdenProveedor` in `backend/prisma/schema.prisma` while retaining `proveedor`, `idExterno`, request/response JSON, existing uniqueness, and existing indexes.
- [X] T007 Add the private structured order-input snapshot field to `Orden` in `backend/prisma/schema.prisma` when the JSON-on-existing-persistence design is clean; otherwise document and implement the single private one-to-one order-input record selected during schema review, without capability-specific tables or nullable `Orden.cantidad`.
- [X] T008 Add MySQL/MariaDB-compatible offering lookup indexes to `backend/prisma/schema.prisma`, including MasterService selection/availability and provider-service availability lookups; do not add a PostgreSQL-style partial unique index or index private comment text.
- [X] T009 Implement transactional selection updates in the offering repository/service under `backend/src/modules/catalog/infrastructure/` and `backend/src/modules/catalog/application/`, enforcing that each MasterService has at most one `isSelected = true` offering while allowing multiple non-selected offerings.
- [X] T010 [P] Add Prisma model/relation type fixtures and schema contract tests in `backend/test/integration/catalog/` covering duplicate mapping rejection, multiple non-selected offerings, and the selected-offering invariant.
- [X] T011 Validate the additive schema with `backend/prisma/schema.prisma` and generated Prisma types in a disposable test database before proceeding to provider normalization; do not create production migrations or modify application behavior in this gate.

**Checkpoint**: The schema supports multiple offerings, one selected offering at most, nullable historical linkage, and private input snapshots without changing existing Standard behavior.

## Phase 3: User Story A - Standard Order (Priority: P1) MVP

**Goal**: Resolve an explicit platform-global Standard offering and preserve current wallet, pricing, idempotency, and provider-attempt behavior.

**Independent Test**: A fake-adapter Standard order uses the selected offering once, debits the wallet atomically, preserves the existing fingerprint, and returns the existing accepted/rejected/uncertain behavior.

### Tests for User Story A

- [X] T029 [P] [US4] Add offering repository tests for zero, one, and multiple mappings, disabled/unavailable offerings, and at-most-one-selected concurrency behavior.
- [X] T030 [P] [US4] Add tenant isolation tests proving TenantServiceOverride controls enablement and price independently from platform-global routing.

- [X] T012 [P] [US1] Extend `backend/test/unit/catalog/` capability-normalization tests to map verified BulkFollows `Default` metadata to `STANDARD` and reject malformed or unknown capability metadata.

- [X] T031 Implement offering mapping and selection repository methods with transactional selection updates and a MySQL/MariaDB-compatible invariant.
- [X] T032 Integrate explicit offering creation/update during curated catalog workflows without overwriting MasterService.provenanceRef.
- [X] T033 Register offering data access and preserve existing catalog authorization boundaries.
- [X] T034 Run selection invariant and tenant-commercial-isolation tests before provider backfill or order dispatch changes.
- [X] T013 [P] [US1] Extend `backend/test/unit/orders/order.service.spec.ts` with selected-offering Standard order cases covering valid bounds, absent selection, unavailable selection, ambiguous selection, and zero wallet/provider side effects on rejection.
- [X] T014 [P] [US1] Extend `backend/test/unit/orders/order.service.spec.ts` with existing `STANDARD` fingerprint compatibility cases proving private snapshots and capability metadata do not alter the current `[serviceId, target, quantity]` representation.
- [X] T015 [P] [US1] Extend `backend/test/contract/orders/` with safe Standard response assertions that exclude provider origin, provider service IDs, provider costs, raw payloads, credentials, routing state, and private input snapshots.

### Implementation for User Story A

- [X] T060 Document the MasterService-only Favorite compatibility rule without creating a Favorite entity, endpoint, UI, or persistence implementation.

- [X] T016 Implement the normalized capability contract and validation types in `backend/src/modules/catalog/` so `STANDARD` is supported, unknown capabilities fail closed, and no title/description/category parsing determines capability.
- [X] T017 Implement offering repository reads and tenant-aware candidate resolution in `backend/src/modules/catalog/infrastructure/` and `backend/src/modules/orders/infrastructure/order.repository.ts`, using platform-global selected offering plus `TenantServiceOverride` commercial filtering.
- [X] T018 Replace new-order direct `provenanceRef` routing in `backend/src/modules/orders/infrastructure/order.repository.ts` with offering resolution while retaining a temporary unbackfilled Standard compatibility path through `provenanceRef` and the existing `readQuantityBounds` normalizer.
- [X] T019 Preserve integer minor-unit pricing, per-1,000 calculations, wallet debit, insufficient-balance handling, and existing Standard quantity validation in `backend/src/modules/orders/application/order.service.ts` and `backend/src/modules/orders/infrastructure/order.repository.ts`.
- [X] T020 Register the offering resolver and capability services in `backend/src/modules/catalog/catalog.module.ts` and `backend/src/modules/orders/orders.module.ts` without introducing a dynamic plugin framework.
- [X] T021 Run the focused Standard order tests in `backend/test/unit/orders/`, existing wallet tests in `backend/test/unit/wallets/`, and existing BulkFollows order client tests in `backend/test/contract/orders/` as the first MVP gate before starting other user stories.

## Phase 4: User Story B - Custom Comments Fail-Closed (Priority: P1)

**Goal**: Represent `CUSTOM_COMMENTS` as a provider-neutral capability while refusing purchase until verified BulkFollows semantics exist.

**Independent Test**: A Custom Comments offering with unresolved contract or quantity semantics is rejected before order creation, wallet debit, or provider dispatch.

### Tests for User Story B

- [X] T035 [P] [US5] Add provider-replacement integration fixtures proving explicit curated mappings do not merge by text or price similarity.
- [X] T036 [P] [US5] Add order-resolution tests proving a selection switch affects only new orders and never silently substitutes an unavailable offering.

- [X] T022 [P] [US2] Add `CUSTOM_COMMENTS` normalization fixtures under `backend/test/unit/catalog/` proving unresolved BulkFollows contract metadata becomes unsupported/non-orderable rather than `STANDARD`.

- [X] T037 Implement deterministic selected-offering resolution while preserving TenantServiceOverride price and enablement resolution.
- [X] T038 Update provider availability synchronization to disable disappeared offerings while retaining MasterService and Favorite compatibility.
- [X] T039 Run replacement and no-silent-substitution tests with fake provider records only.
- [X] T023 [P] [US2] Extend `backend/test/unit/orders/order.service.spec.ts` with empty-comments, unknown-quantity-semantics, and unsupported-Custom-Comments cases that assert no wallet/order writes and no adapter call.
- [X] T024 [P] [US2] Add canonical-input unit cases under `backend/test/unit/orders/` for the versioned dynamic-input representation, but keep executable Custom Comments submission disabled until provider evidence is approved.

### Implementation for User Story B

- [X] T025 Implement `CUSTOM_COMMENTS` capability metadata storage and validation in `backend/src/modules/catalog/` without inventing quantity, bounds, blank-line, trimming, duplicate, pricing, or provider-field semantics.
- [X] T026 Add fail-closed unsupported-capability handling in `backend/src/modules/orders/application/order.service.ts` and `backend/src/modules/orders/infrastructure/order.repository.ts` before wallet/order side effects.
- [X] T027 Keep `Orden.cantidad` required and preserve it as effective quantity only when a future verified capability contract makes quantity deterministic; document the guard in the order input snapshot mapper under `backend/src/modules/orders/`.
- [X] T028 Run the Custom Comments rejection suite in `backend/test/unit/orders/` and verify no executable BulkFollows Custom Comments request path or live-provider test exists in `backend/src/modules/orders/` and `backend/test/`.

## Phase 5: User Story D - Provider Configuration Foundation (Priority: P2)

**Goal**: Persist explicit platform-level offering mappings and selection without building provider Admin UI.

**Independent Test**: Repository/application fixtures can create, enable, disable, and select offerings deterministically while preserving tenant commercial overrides.

### Tests for User Story D


### Implementation for User Story D


## Phase 6: User Story E - Provider Replacement (Priority: P2)

**Goal**: Change the selected offering for new orders while preserving the MasterService identity and tenant commercial layer.

**Independent Test**: Switching selected offering A to B changes only new-order resolution; MasterService identity, price override, and existing historical order routing remain stable.

### Tests for User Story E


### Implementation for User Story E


## Phase 7: User Story F - Historical Order Binding (Priority: P1)

**Goal**: Keep existing and new orders permanently bound to the provider offering originally used.

**Independent Test**: After switching from provider A to B, an existing order still resolves status/reconciliation through A; ambiguous historical records remain on legacy fields.

### Tests for User Story F

- [X] T040 [P] [US6] Add historical-binding unit tests proving new orders persist offering/provider-service/capability snapshots before provider acceptance.
- [X] T041 [P] [US6] Add historical-routing integration tests proving current selection changes do not alter existing order provider resolution.
- [X] T042 [P] [US6] Add legacy-history fixtures proving OrdenProveedor.idExterno is never matched to ProviderService.externalId.


### Implementation for User Story F

- [X] T043 Reuse OrdenProveedor for immutable offering/provider-service/capability linkage while retaining legacy fields.
- [X] T044 Resolve provider operations from historical private binding, with legacy fallback only when new linkage is null.
- [X] T045 Implement the deterministic historical-linkage predicate and reject external-ID or text-based inference.
- [X] T046 Run the historical binding gate and verify legacy rows remain readable without new linkage.


## Phase 8: User Story C - Provider Transparency (Priority: P1)

**Goal**: Keep provider infrastructure private while exposing only stable MasterService and approved normalized capability data.

**Independent Test**: Catalog/order responses and serialized errors containing provider fixtures expose no provider-private fields.

### Tests for User Story C

- [X] T047 [P] [US3] Extend public catalog contract tests with recursive assertions excluding provider-private fields.
- [X] T048 [P] [US3] Extend order contract tests with recursive safe-response and sanitized-error assertions.


### Implementation for User Story C

- [X] T049 Add the optional normalized capability projection only for valid selected offerings while preserving public fields.
- [X] T050 Read normalized offering metadata first and retain raw BulkFollows bounds only as a migration fallback.
- [X] T051 Add Swagger metadata and customer-safe mapping tests without exposing provider-private fields.
- [X] T052 Run public catalog, order contract, and tenant-isolation suites as the transparency gate.


## Phase 9: User Story G - Provider Unavailable (Priority: P1)

**Goal**: Prevent orders through unavailable, unsupported, missing, or ambiguously selected offerings.

**Independent Test**: Every unavailable/unsupported condition fails closed before wallet/order writes or provider dispatch.

### Tests for User Story G

- [X] T053 [P] [US7] Add failure-case tests for missing, disabled, disappeared, malformed, unsupported, unconfigured, and invalid offerings using fakes.
- [X] T054 [P] [US7] Add BulkFollows timeout/unknown-result regression tests proving one attempt and preserved uncertain state.
- [X] T055 [P] [US7] Add wallet/refund regression assertions proving fail-closed resolution does not debit.


### Implementation for User Story G

- [X] T056 Implement stable sanitized unavailable/unsupported errors while preserving authorization, tenant, wallet, and idempotency boundaries.
- [X] T057 Preserve timeout, accepted/rejected/unknown, status validation, and credential-sanitization behavior behind the neutral adapter.
- [X] T058 Run unavailable-offering, timeout/unknown-result, wallet, refund, and tenant-isolation gates.


## Phase 10: User Story H - Future Favorite Compatibility (Priority: P3)

**Goal**: Preserve the future ability to reference only `(userId, masterServiceId)` without implementing Favorites.

**Independent Test**: Data-model and replacement fixtures prove provider changes/disappearance do not require provider references in a future Favorite identity.

### Tests for User Story H

- [X] T059 [P] [US8] Add a model-level compatibility test proving provider disappearance does not require provider references in a future Favorite identity.


### Implementation for User Story H


## Phase 11: Deterministic Backfill And Migration Verification

**Purpose**: Migrate only proven existing BulkFollows Standard mappings and preserve ambiguous legacy history.

- [X] T061 Add deterministic backfill query/report logic that verifies referenced ProviderService records and classifies relationship states.
- [X] T062 Add backfill tests proving only independently verified Standard mappings receive offerings.
- [X] T063 Add historical backfill tests proving OrdenProveedor.idExterno is never matched to ProviderService.externalId.
- [X] T064 Add migration verification fixtures covering existing orders, overrides, wallet movements, refunds, idempotency, and legacy provider rows.
- [X] T065 Execute the disposable-database Prisma validation/generation/migration dry-run before rollout.
- [X] T066 Run the complete backend regression suite with no live provider calls.


## Phase 12: Polish And Cross-Cutting Verification

- [X] T067 [P] Update Swagger/contract documentation and implementation notes for the safe capability projection.
- [X] T068 [P] Add recursive security assertions excluding credentials, raw payloads, provider order IDs, costs, routing state, and private snapshots.
- [X] T069 Run diff hygiene, focused Feature 013 suites, the full backend suite, and final quickstart validation without live provider calls.


## Dependencies & Execution Order

### Phase Dependencies


### Parallel Opportunities


## Migration And Backfill Gates


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
