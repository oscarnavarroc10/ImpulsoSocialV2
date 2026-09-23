---
description: "Executable task list for the SMMGEN provider integration"
---

# Tasks: SMMGEN Provider Integration

**Input**: Design documents from `specs/014-smmgen-provider-integration/`

**Scope**: Backend-only SMMGEN integration behind the Feature 013 provider-neutral catalog and order boundaries. Feature 013 implementation and migration, Feature 012, frontend source, and unrelated files remain unchanged.

**Safety boundary**: All implementation and validation uses sanitized fixtures, mocks, fakes, and recorded provider-shaped responses. No task may use credentials, make a live SMMGEN request, create a provider order, mutate provider or production data, or create/modify a migration. No Prisma schema change or migration task is included; a discovered persistence gap requires a separately approved additive decision.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish fixture-only implementation and verification surfaces without changing runtime behavior.

- [X] T001 Confirm the Feature 013 catalog, order, wallet, pricing, authorization, and Prisma bindings listed in `specs/014-smmgen-provider-integration/plan.md` are the implementation baseline, and record any missing extension point in the task notes without editing `backend/prisma/schema.prisma` or migrations.
- [X] T002 [P] Create sanitized SMMGEN fixture directories and fixture naming conventions under `backend/test/fixtures/smmgen/`, covering services, Standard requests, accepted/rejected/uncertain/malformed outcomes, known/unknown statuses, complete/partial/failed snapshots, and privacy-sensitive payload fields without credentials or real identifiers.
- [X] T003 [P] Add fixture-only fake catalog and order transport seams in the established backend test support location, ensuring tests fail if the default network transport or a live SMMGEN URL is reached.
- [X] T004 [P] Document the fixture-only commands, required environment absence, and five-minute Standard catalog-to-order review path in `specs/014-smmgen-provider-integration/quickstart.md` only if the approved quickstart needs implementation test-path updates; do not add credentials or live commands.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generalize shared provider boundaries while preserving BulkFollows and reusing existing persistence. No story work starts until these prerequisites are complete.

- [X] T005 [P] Define the origin-aware catalog client registration contract in `backend/src/modules/catalog/infrastructure/provider-catalog-client.ts`, `backend/src/modules/catalog/infrastructure/bulkfollows.client.ts`, and `backend/src/modules/catalog/catalog.module.ts`, so SMMGEN and BulkFollows resolve through the same boundary without exposing provider details publicly.
- [X] T006 [P] Define the origin-aware order adapter resolution contract in `backend/src/modules/orders/application/provider-order-adapter.ts` and `backend/src/modules/orders/orders.module.ts`, preserving the existing BulkFollows registration and allowing historical or selected offering resolution.
- [X] T007 Generalize catalog synchronization inputs in `backend/src/modules/catalog/sync/import-orchestrator.ts` and `backend/src/modules/catalog/application/sync.service.ts` to carry provider origin and complete-snapshot evidence, while retaining BulkFollows behavior and making disappearance changes conditional on complete successful snapshots.
- [X] T008 Generalize historical order-provider resolution in `backend/src/modules/orders/infrastructure/order.repository.ts` and `backend/src/modules/orders/application/order.service.ts` so accepted orders use their existing `OrdenProveedor` binding for later operations and legacy null bindings retain their established fallback.
- [X] T009 [P] Add focused regression tests for origin-aware catalog registration and complete-snapshot gating in `backend/test/unit/catalog/import-orchestrator.spec.ts` and `backend/test/unit/catalog/sync.service.spec.ts`, proving BulkFollows behavior remains unchanged and failed/partial snapshots cannot mass-disable offerings.
- [X] T010 [P] Add focused regression tests for origin-aware adapter resolution and historical binding in `backend/test/unit/orders/order.service.spec.ts` and `backend/test/unit/orders/historical-binding.spec.ts`, proving current selection cannot replace an accepted order's provider and legacy fallback remains compatible.
- [X] T011 Verify the existing Feature 013 Prisma bindings used by `ProviderService`, `MasterServiceProviderOffering`, `OrdenProveedor`, private order snapshots, idempotency, wallet, history, and `SyncJob` in `backend/prisma/schema.prisma` are sufficient; document a blocker rather than adding any schema or migration task if they are not.

**Checkpoint**: Shared provider seams, historical routing, and complete-success reconciliation gates are test-covered; no schema or migration work is authorized.

## Phase 3: User Story 1 - Curate SMMGEN Offerings (Priority: P1) MVP

**Goal**: Import verified SMMGEN services as private provider offerings and require explicit MasterService mapping and selection without changing local commercial identity.

**Independent test**: Run sanitized service fixtures through the fake catalog boundary, explicitly map an offering, and verify normalized facts, idempotent provider identity, auditable selection, and unchanged MasterService fields.

- [X] T012 [P] [US1] Add unit fixtures and tests for SMMGEN `Default`, `Custom Comments`, unknown, missing, malformed, contradictory, duplicate, and incomplete service metadata in `backend/test/unit/catalog/smmgen-capability-normalizer.spec.ts`, asserting structured-type-only normalization and fail-closed results.
- [X] T013 [P] [US1] Add contract tests for the private SMMGEN catalog boundary in `backend/test/contract/catalog/smmgen-client.spec.ts`, asserting sanitized service shapes, private external identity handling, and complete-snapshot evidence without raw payload leakage.
- [X] T014 [US1] Implement `backend/src/modules/catalog/infrastructure/smmgen-capability-normalizer.ts` beside `backend/src/modules/catalog/infrastructure/capability-normalizer.ts` and `backend/src/modules/catalog/domain/provider-capability.ts`, using only structured SMMGEN `type`, mapping `Default` to `STANDARD` with `smmgen-default-v1` and verified target/positive-integer quantity bounds, mapping `Custom Comments` to unsupported `CUSTOM_COMMENTS`, and rejecting all unknown or contradictory metadata.
- [X] T015 [US1] Implement `backend/src/modules/catalog/infrastructure/smmgen.client.ts` as the `ProviderCatalogClient` implementation using backend-only `SMMGEN_API_URL` and `SMMGEN_API_KEY`, one TLS-verified HTTP POST `services` attempt with bounded timeout, sanitized failures, and no retries or raw logging.
- [X] T016 [US1] Wire SMMGEN client registration through `backend/src/modules/catalog/catalog.module.ts` and `backend/src/modules/catalog/infrastructure/provider-catalog-client.ts`, and connect `ProviderService` upsert by `(providerOrigin, externalId)` plus normalized private metadata through the existing offering/repository path.
- [X] T017 [US1] Extend the explicit curation path in `backend/src/modules/catalog/application/curation.service.ts`, `backend/src/modules/catalog/infrastructure/provider-service.repository.ts`, and `backend/src/modules/catalog/infrastructure/master-service-provider-offering.repository.ts` so SMMGEN mapping, enablement, availability, and selection are explicit, auditable, and allow multiple offerings per MasterService without title/rate/similarity matching.
- [X] T018 [US1] Add catalog synchronization integration coverage in `backend/test/integration/catalog/smmgen-curation.spec.ts` proving repeated sanitized imports are idempotent, SMMGEN facts never overwrite MasterService title/description/category/visibility/tenant price, and two offerings can coexist for one MasterService.

**Checkpoint**: A sanitized `Default` fixture can be imported and explicitly curated as a private Standard offering; `Custom Comments` and unknown types cannot become purchasable.

## Phase 4: User Story 2 - Publish Only Eligible Services (Priority: P1)

**Goal**: Publish only tenant-eligible, selected, available, supported provider-neutral catalog data and never expose SMMGEN infrastructure.

**Independent test**: Serialize public catalog fixtures containing selected, unsupported, unavailable, disabled, and ambiguous offerings and verify only the allowed local projection is returned.

- [X] T019 [P] [US2] Add public catalog contract tests in `backend/test/contract/catalog/smmgen-customer-projection.spec.ts` covering allowed MasterService identity, tenant selling price, Standard capability, target requirement, quantity requirement, and verified bounds, while asserting SMMGEN origin/IDs/rate/raw data are absent.
- [X] T020 [P] [US2] Add tenant/privacy integration tests in `backend/test/integration/catalog/smmgen-public-catalog.spec.ts` covering two tenants, role boundaries, unsupported offerings, unavailable/disabled offerings, missing selection, and no silent alternate-provider selection.
- [X] T021 [US2] Update `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts`, `backend/src/modules/catalog/application/public-catalog.service.ts`, and `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` to project SMMGEN offerings through the existing provider-neutral MasterService contract and tenant pricing path, without reusing BulkFollows-only metadata helpers.
- [X] T022 [US2] Enforce selected-available-supported Standard eligibility in the existing catalog and order preflight path using `backend/src/modules/catalog/application/master-service-provider-offering.service.ts` and `backend/src/modules/catalog/infrastructure/master-service-provider-offering.repository.ts`, returning existing sanitized unavailable/not-found behavior for invalid choices.
- [X] T023 [US2] Add response and log assertions to `backend/test/contract/catalog/smmgen-customer-projection.spec.ts` and `backend/test/integration/catalog/smmgen-public-catalog.spec.ts` proving API output and customer errors exclude credentials, API URL, provider identity, external IDs, rate/cost, raw payloads, routing state, and private snapshots.

**Checkpoint**: The public catalog exposes only local commercial data and provider-neutral Standard capability for an eligible selected offering.

## Phase 5: User Story 3 - Submit a Standard Order (Priority: P1)

**Goal**: Dispatch a valid Standard target and quantity through one explicitly selected SMMGEN adapter attempt while preserving existing wallet, pricing, and idempotency semantics.

**Independent test**: Submit a valid fixture order through a fake adapter and inspect the provider-neutral request, wallet result, order state, private binding, and absence of provider fields from the customer response.

- [X] T024 [P] [US3] Add unit tests in `backend/test/unit/orders/smmgen-order.adapter.spec.ts` for Standard request mapping `link <- target` and `quantity <- quantity`, supported bounds, accepted/rejected/uncertain adapter results, and exactly one fake provider attempt.
- [X] T025 [P] [US3] Extend `backend/test/unit/orders/canonical-order-input.spec.ts` with Standard target/quantity validation cases proving missing, malformed, non-positive, and out-of-bounds inputs fail before wallet debit, order creation, or adapter dispatch.
- [X] T026 [P] [US3] Add integration tests in `backend/test/integration/orders/smmgen-standard-order.spec.ts` covering selected offering resolution, tenant selling price, existing `[serviceId, target, quantity]` fingerprint, wallet atomicity, private snapshots, and provider-neutral responses using a fake adapter.
- [X] T027 [US3] Implement `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts` for Standard create and verified status boundaries, mapping only canonical target/quantity fields and returning sanitized accepted/rejected/uncertain results without retries, failover, substitution, or provider leakage.
- [X] T028 [US3] Route `backend/src/modules/orders/application/order.service.ts` through the origin-aware adapter resolver in `backend/src/modules/orders/application/provider-order-adapter.ts`, preserving `backend/src/modules/orders/infrastructure/order.repository.ts` selection checks, wallet/refund transaction boundaries, and existing idempotency behavior.
- [X] T029 [US3] Register the SMMGEN adapter beside BulkFollows in `backend/src/modules/orders/orders.module.ts` and preserve `backend/src/modules/orders/infrastructure/bulkfollows-order.adapter.ts` and `backend/src/modules/orders/infrastructure/bulkfollows-order.client.ts` behavior through the existing adapter contract.

**Checkpoint**: The executable Standard catalog-to-order path is complete using a fake adapter and retains existing customer pricing, wallet, idempotency, and privacy semantics.

## Phase 6: User Story 4 - Handle Custom Comments Safely (Priority: P1)

**Goal**: Recognize SMMGEN Custom Comments as `CUSTOM_COMMENTS` metadata but keep it unsupported and non-purchasable until a future approved contract exists.

**Independent test**: Normalize Custom Comments fixtures with varied unresolved quantity and text semantics and prove every order attempt fails before wallet, order, or provider side effects.

- [X] T030 [P] [US4] Add normalization fixtures and unit tests in `backend/test/unit/catalog/smmgen-capability-normalizer.spec.ts` for Custom Comments quantity, comment-count, bounds, newline, blank-line, trimming, duplicate, length, and field-mapping ambiguities, asserting metadata-only unsupported output.
- [X] T031 [P] [US4] Add order fail-closed tests in `backend/test/unit/orders/smmgen-order.adapter.spec.ts` and `backend/test/integration/orders/smmgen-custom-comments.spec.ts` proving Custom Comments never maps to Standard, never builds a provider request, never debits a wallet, and never creates an order.
- [X] T032 [US4] Enforce `CUSTOM_COMMENTS` non-purchasable eligibility in `backend/src/modules/catalog/infrastructure/smmgen-capability-normalizer.ts`, `backend/src/modules/catalog/application/master-service-provider-offering.service.ts`, and `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts`, with existing sanitized unsupported behavior.
- [X] T033 [US4] Record the deferred Custom Comments quantity, pricing, bounds, normalization, and exact request-field decisions in `specs/014-smmgen-provider-integration/research.md` or the relevant contract without inventing executable semantics or provider fields.

**Checkpoint**: Custom Comments is visible only as private unsupported metadata and is fail-closed at every purchase boundary.

## Phase 7: User Story 5 - Bind Orders Historically (Priority: P1)

**Goal**: Preserve the exact provider/offering/capability snapshot used by an accepted order and route later operations to that original SMMGEN binding.

**Independent test**: Accept an order through offering A, select or update offering B, then verify status and compatibility operations still resolve A and historical price/input/provider-cost snapshots remain unchanged.

- [X] T034 [P] [US5] Add historical binding integration tests in `backend/test/integration/orders/smmgen-historical-binding.spec.ts` covering selection replacement, offering disappearance, provider external-ID changes, immutable customer/provider-cost/input snapshots, and new orders using only the newly selected offering.
- [X] T035 [P] [US5] Add status-routing unit tests in `backend/test/unit/orders/smmgen-historical-status.spec.ts` covering historical SMMGEN origin/offering resolution, legacy null-link fallback, and rejection of current-selection routing for accepted orders.
- [X] T036 [US5] Persist and resolve the existing private `OrdenProveedor` offering/provider/capability/version evidence through `backend/src/modules/orders/infrastructure/order.repository.ts`, `backend/src/modules/orders/application/order.service.ts`, and `backend/src/modules/orders/application/provider-order-adapter.ts` without changing Prisma bindings or migrations.
- [X] T037 [US5] Verify `backend/src/modules/orders/application/canonical-order-input.ts` and the existing order persistence path retain Standard input, effective quantity, customer price, provider-cost metadata, request fingerprint, and historical snapshots when current SMMGEN metadata changes.

**Checkpoint**: Accepted orders remain operationally bound to their original SMMGEN offering and never follow later selection changes.

## Phase 8: User Story 6 - Reconcile Availability (Priority: P1)

**Goal**: Reconcile SMMGEN catalog drift safely, disabling disappeared offerings only after a complete successful snapshot while preserving local identity and history.

**Independent test**: Apply recorded present, changed, disappeared, failed, malformed, partial, timed-out, and uncertain snapshots and verify only the complete-success case changes disappearance availability.

- [X] T038 [P] [US6] Add synchronization fixture tests in `backend/test/unit/catalog/smmgen-reconciliation.service.spec.ts` for complete successful snapshots, failed HTTP, timeout, invalid JSON, malformed top-level data, partial pagination, per-item invalid data, failed writes, and uncertain completion.
- [X] T039 [P] [US6] Add reconciliation integration tests in `backend/test/integration/catalog/smmgen-reconciliation.spec.ts` proving absent offerings become unavailable only after complete success, current MasterService/tenant settings remain, favorites remain MasterService-only, and historical orders are untouched.
- [X] T040 [US6] Implement `backend/src/modules/catalog/infrastructure/smmgen-reconciliation.service.ts` as the complete-success gate for sanitized snapshot persistence and disappearance handling, with no mass disablement for incomplete or uncertain runs.
- [X] T041 [US6] Integrate `smmgen-reconciliation.service.ts` with `backend/src/modules/catalog/sync/import-orchestrator.ts`, `backend/src/modules/catalog/application/sync.service.ts`, and existing offering repositories so provider rate/technical metadata can change privately without changing customer pricing, local identity, or historical order facts.

**Checkpoint**: Only a verified complete SMMGEN services snapshot can reconcile disappearance; failed or uncertain synchronization is non-destructive.

## Phase 9: User Story 7 - Fail Closed On Unknown Actions (Priority: P1)

**Goal**: Reject unknown, future, malformed, contradictory, or unsupported SMMGEN capabilities without defaulting to Standard or creating provider requests.

**Independent test**: Feed unknown type names, missing fields, contradictory bounds, future action families, and malformed status/capability keys through normalization and order eligibility checks.

- [X] T042 [P] [US7] Add exhaustive fail-closed normalization tests in `backend/test/unit/catalog/smmgen-capability-normalizer.spec.ts` for unknown types, future actions, malformed keys, missing type, unsafe numeric values, contradictory metadata, and title/category/rate similarity traps.
- [X] T043 [P] [US7] Add contract tests in `backend/test/contract/orders/smmgen-order.client.spec.ts` or the established SMMGEN order contract location proving unsupported capabilities and unknown statuses produce sanitized unavailable/rejected/uncertain results and no outbound request.
- [X] T044 [US7] Enforce fail-closed capability and status handling in `backend/src/modules/catalog/infrastructure/smmgen-capability-normalizer.ts` and `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts`, ensuring no unknown value defaults to `STANDARD` or completion.
- [X] T045 [US7] Add regression coverage in `backend/test/unit/catalog/capability-normalizer.spec.ts` and `backend/test/unit/orders/order.service.spec.ts` proving BulkFollows unsupported/custom behavior remains unchanged while SMMGEN future actions remain non-purchasable.

**Checkpoint**: Unsupported and ambiguous provider data cannot cross into a purchasable capability or a successful order state.

## Phase 10: User Story 8 - Protect Tenants And Privacy (Priority: P1)

**Goal**: Preserve tenant isolation, role boundaries, sanitized errors/logs, and backend-only provider privacy across catalog, administration, orders, and historical operations.

**Independent test**: Exercise two tenants and platform/customer/tenant-admin roles with provider-shaped errors and sensitive fields, then inspect responses and captured logs.

- [X] T046 [P] [US8] Add tenant isolation integration tests in `backend/test/integration/catalog/smmgen-tenant-isolation.spec.ts` and `backend/test/integration/orders/smmgen-tenant-isolation.spec.ts` proving cross-tenant offering, catalog, price, order, configuration, and historical access uses existing scoped not-found/authorization behavior.
- [X] T047 [P] [US8] Add sanitized logging/error contract tests in `backend/test/contract/catalog/smmgen-client.spec.ts` and `backend/test/contract/orders/smmgen-order.client.spec.ts` proving API keys, authorization headers, URLs, raw payloads, comments, external IDs, rates, and provider error bodies never appear in logs or public errors.
- [X] T048 [US8] Enforce backend-only configuration and sanitized operational errors in `backend/src/modules/catalog/infrastructure/smmgen.client.ts` and `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts`, retaining TLS verification and never returning provider-private data through public DTOs.
- [X] T049 [US8] Verify `backend/src/modules/catalog/application/public-catalog.service.ts`, `backend/src/modules/catalog/application/curation.service.ts`, `backend/src/modules/orders/application/order.service.ts`, and existing authorization paths preserve tenant and role boundaries without adding provider administration UI or frontend configuration.

**Checkpoint**: Provider identity and secrets remain private, and no tenant or role can cross an existing authorization boundary.

## Phase 11: User Story 9 - Handle Provider Outcomes Without Retries (Priority: P1)

**Goal**: Normalize accepted, rejected, uncertain, and malformed SMMGEN outcomes into existing order, wallet, refund, idempotency, and monotonic-status policies with at most one attempt.

**Independent test**: Return each sanitized fake outcome and verify no duplicate dispatch, no retry/failover, correct wallet/refund/history behavior, and no false success.

- [X] T050 [P] [US9] Add outcome unit tests in `backend/test/unit/orders/smmgen-order.adapter.spec.ts` for accepted, explicit rejected, timeout/uncertain, malformed, incomplete, duplicate, and unknown-status responses, asserting one attempt and sanitized stable categories.
- [X] T051 [P] [US9] Add order lifecycle integration tests in `backend/test/integration/orders/smmgen-provider-outcomes.spec.ts` covering wallet debit/refund, idempotency replay, rejection history, uncertain state, monotonic status, and no alternate offering after any provider outcome.
- [X] T052 [US9] Implement outcome normalization and one-attempt behavior in `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts`, and route it through `backend/src/modules/orders/application/order.service.ts` without introducing retry, failover, ranking, substitution, or a second order pipeline.
- [X] T053 [US9] Add BulkFollows regression assertions in `backend/test/unit/orders/order.service.spec.ts`, `backend/test/unit/orders/bulkfollows-order.adapter.spec.ts`, and existing wallet/refund/idempotency suites proving the shared resolver does not alter established BulkFollows outcomes.

**Checkpoint**: Every provider outcome is financially safe and auditable; uncertain or malformed data never becomes success and no operation is retried.

## Phase 12: User Story 10 - Operate Without Live Provider Access (Priority: P1)

**Goal**: Verify the full SMMGEN catalog, Standard order, status, and reconciliation flow with unavailable credentials/network and no provider side effects.

**Independent test**: Run the focused Feature 014 suite with SMMGEN credentials unset and network access blocked, proving fake transports cover all expected behavior and no live request occurs.

- [X] T054 [P] [US10] Add no-live-access contract tests in `backend/test/contract/catalog/smmgen-client.spec.ts` and `backend/test/contract/orders/smmgen-order.client.spec.ts` proving missing configuration, blocked network, timeout, and invalid configuration produce sanitized unavailable outcomes without attempting a real provider operation.
- [X] T055 [P] [US10] Add the fixture-only end-to-end integration test in `backend/test/integration/smmgen-fixture-flow.spec.ts` covering Standard catalog import, explicit mapping/selection, public projection, order dispatch, status normalization, historical binding, and complete-success reconciliation through fakes only.
- [X] T056 [US10] Align `backend/test/fixtures/smmgen/`, existing fake transport setup, and `specs/014-smmgen-provider-integration/quickstart.md` so the complete Standard flow runs without `SMMGEN_API_KEY`, live URL access, provider balance, real order creation, or production database mutation.
- [X] T057 [US10] Add a test guard in the established backend test support location that fails the Feature 014 suite if a real SMMGEN host, credential value, default network transport, provider order endpoint, or production connection is used.

**Checkpoint**: Reviewers can validate the full executable Standard path locally with fixtures only and no provider credentials or side effects.

## Phase 13: Polish & Cross-Cutting Verification

**Purpose**: Verify all P1 stories together, preserve unrelated provider behavior, and close the safety boundary before implementation review.

- [X] T058 [P] Run the focused Feature 014 unit, contract, and integration suites from `specs/014-smmgen-provider-integration/quickstart.md` against sanitized fixtures, confirming all ten story criteria and no live provider access.
- [X] T059 [P] Run the existing BulkFollows catalog/order, Custom Comments rejection, wallet/refund, idempotency, public privacy, tenant isolation, provider replacement, and historical-binding suites under `backend/test/` and record that behavior remains green.
- [X] T060 Run `npm run build`, `npm run lint -- --no-fix`, the complete backend test suite, and `git diff --check` from `backend/` after implementation; resolve only Feature 014 failures and do not alter unrelated source, tests, Feature 013 migration, or frontend files.
- [X] T061 Perform the final privacy and safety audit across `backend/src/modules/catalog/infrastructure/smmgen.client.ts`, `backend/src/modules/catalog/infrastructure/smmgen-capability-normalizer.ts`, `backend/src/modules/catalog/infrastructure/smmgen-reconciliation.service.ts`, `backend/src/modules/orders/infrastructure/smmgen-order.adapter.ts`, fixtures, logs, and errors, confirming no credentials/raw provider data/public provider fields/live calls/retries/failover/schema changes are present.
- [X] T062 Confirm the implementation and test diff contains no Prisma schema or migration changes, no Feature 012/013 or frontend changes, no live-provider task or credential, and no deferred Custom Comments execution, Favorites, provider administration UI, automatic routing, retry, failover, ranking, substitution, balance, refill, cancellation, or unsupported action-family work.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No implementation dependency; fixture and safety conventions may be prepared in parallel.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story because all stories rely on origin-aware registration, complete-snapshot gating, and historical adapter resolution.
- **User Stories (Phases 3-12)**: All depend on Foundational. They are all P1, but the executable delivery order is US1 curation, US2 projection, US3 Standard order, US5 historical binding, US6 reconciliation, US7 fail-closed handling, US8 privacy, US9 outcomes, and US10 fixture-only verification; US4 fail-closed Custom Comments can proceed after normalization is available and before purchase enablement is accepted.
- **Polish (Phase 13)**: Depends on all desired stories and is the final verification gate.

### User Story Dependencies

- **US1**: Depends only on Foundational; provides the private normalized and explicitly curated offering used by later stories.
- **US2**: Depends on US1's normalized offering shape; remains independently testable with catalog fixtures.
- **US3**: Depends on US1 and US2 eligibility plus the Foundational adapter resolver; delivers the MVP's executable Standard order.
- **US4**: Depends on the normalizer and order eligibility boundary from US1/US3; it intentionally blocks Custom Comments execution rather than enabling it.
- **US5**: Depends on US3 order persistence and Foundational historical resolution.
- **US6**: Depends on US1 synchronization and Foundational complete-snapshot handling; it must not rewrite US5 historical bindings.
- **US7**: Depends on US1 normalization and US3 adapter eligibility.
- **US8**: Cross-cuts US1-US3 and existing tenant/public boundaries; its tests can run with fixture projections once those seams exist.
- **US9**: Depends on US3 adapter routing and existing wallet/idempotency lifecycle.
- **US10**: Depends on all in-scope runtime paths and validates the integrated Standard flow without provider access.

### Parallel Opportunities

- T002-T006 and T009-T010 are parallel where they touch different fixture, contract, or source files; do not parallelize edits to the same file.
- After Foundational completion, normalization/client tests (US1), public projection tests (US2), and Custom Comments fail-closed tests (US4) can proceed in parallel when their shared contracts are stable.
- Historical-binding tests (US5), reconciliation tests (US6), fail-closed tests (US7), and privacy tests (US8) can proceed in parallel on separate files after their respective boundaries exist.
- Outcome tests (US9) and no-live-access guards (US10) can proceed in parallel after the adapter contract is stable.
- Final focused, regression, build/lint, and safety checks are separate verification activities, but they must not be called “complete” until all have passed.

## Per-Story Independent Test Criteria

- **US1**: Sanitized `Default` imports as a private Standard offering, explicit mapping persists, repeated import is idempotent, multiple offerings coexist, and MasterService identity is unchanged.
- **US2**: Eligible selected Standard data serializes with only provider-neutral catalog fields; unsupported/unavailable/ambiguous offerings are not orderable and no alternate provider is selected.
- **US3**: A fake adapter receives exactly `link` and `quantity` from canonical input; valid orders preserve tenant price, wallet, fingerprint, binding, and privacy, while invalid input has no side effects.
- **US4**: Custom Comments normalizes to unsupported `CUSTOM_COMMENTS`; all quantity/text variants fail before wallet, order, or provider effects.
- **US5**: After selection changes or disappearance, an accepted order's original provider/offering/capability and historical financial/input snapshots still route later operations.
- **US6**: Only a complete successful snapshot marks disappeared offerings unavailable; failed, malformed, partial, timeout, and uncertain runs preserve availability and local identity.
- **US7**: Unknown/future/malformed/contradictory types and statuses never default to Standard or completion and never produce provider requests.
- **US8**: Two tenants and all relevant roles remain isolated; public responses, errors, and logs contain no credentials, raw provider data, identity, cost, or routing state.
- **US9**: Accepted/rejected/uncertain/malformed outcomes preserve existing wallet/refund/idempotency/history/monotonic policies with one attempt and no retry or failover.
- **US10**: The complete Standard fixture flow passes with credentials unset and network unavailable, and the test guard proves no live SMMGEN operation occurs.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Complete US1 private SMMGEN normalization, client boundary, idempotent import, and explicit curation tests.
3. Stop and validate US1 independently with sanitized fixtures; do not claim customer ordering until the later Standard path is complete.

### Executable Standard Increment

US1 is the suggested MVP scope. The first customer-executable increment is US1 + US2 + US3, followed by US5 historical binding, US6 reconciliation, US7 fail-closed handling, US8 privacy, US9 outcome safety, and US10 no-live-access verification. US4 remains required in that increment to ensure Custom Comments is recognized but never purchasable.

### Deferred / Out of Scope

The following are deliberately not represented as implementation tasks: Prisma schema or migration changes; live SMMGEN calls, credentials, balance access, provider orders, provider mutations, or production-data changes; frontend redesign or provider-specific public contracts; provider administration UI; automatic matching, ranking, health routing, retry, failover, substitution, or silent switching; executable Custom Comments quantity/pricing/bounds/normalization/request-field semantics; Favorites implementation; new refill/cancellation customer features; unsupported SMMGEN action families; and unrelated Feature 012/013, backend, frontend, or test refactors.

## Notes

- `[P]` appears only when the task is independently actionable in a different file or test surface and has no incomplete prerequisite in that phase.
- Every task includes a concrete repository path and a completion criterion; story tasks carry exactly one `[US#]` label, while Setup, Foundational, and Polish tasks omit story labels.
- No task authorizes a commit. The generated list is for future implementation and review only.