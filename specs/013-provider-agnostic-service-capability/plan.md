# Implementation Plan: Provider-Agnostic Service Capability Foundation

**Branch**: `013-provider-agnostic-service-capability` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

## Summary

Introduce the smallest backward-compatible provider-offering boundary around the existing `MasterService`, `ProviderService`, `OrderService`, and `OrdenProveedor` flow. Add an explicit platform-global offering association, normalized capability metadata, private order-input snapshot support, and historical offering linkage. Preserve `provenanceRef`, existing Standard request semantics, wallet/idempotency/refund protections, and the BulkFollows one-attempt/unknown-result behavior while moving provider-specific resolution behind an adapter boundary.

`STANDARD` is the only capability eligible for the first executable migration against current BulkFollows evidence. `CUSTOM_COMMENTS` is modeled and tested as unsupported/fail closed until its exact BulkFollows contract, quantity semantics, normalization rules, and field names are verified. SMMGEN remains deferred.

## Technical Context

**Language/Version**: TypeScript 5.7, NestJS 11, Angular 22 (frontend contract impact only)

**Primary Dependencies**: Prisma 7 with `@prisma/client`, MySQL/MariaDB adapter, NestJS DI, class-validator, Swagger, Jest 30, ts-jest

**Storage**: Existing MySQL/MariaDB Prisma schema; JSON columns are already used for provider payloads and order request/response snapshots

**Testing**: Backend unit, contract, integration, and e2e Jest suites; Prisma schema/client generation and migration dry-run during implementation

**Target Platform**: Backend Node.js service with existing Angular customer client; provider calls remain backend-only

**Project Type**: Multi-tenant web application with NestJS API and Angular frontend

**Performance Goals**: Preserve current order transaction and provider-attempt behavior; offering resolution adds bounded indexed lookups and must not introduce provider calls before wallet/order guards

**Constraints**: No live provider calls during implementation planning; no credentials in logs or artifacts; no automatic failover/retry; no tenant-specific routing; no Feature 012 UI work; Custom Comments remains non-orderable without verified contract evidence

**Scale/Scope**: One existing BulkFollows integration, many curated MasterServices, multiple provider offerings per MasterService, one selected platform-global offering per MasterService, existing tenant price/enablement overrides

## Constitution Check

### Pre-design gate

- **Specification before implementation**: PASS. Feature 013 is clarified and this plan is design-only.
- **Human-approved architecture**: PASS. The explicit offering relation, platform-global routing, historical binding, environment credentials, and JSON snapshot preference are recorded in the clarification session.
- **Tenant isolation**: PASS. Offerings are platform infrastructure; `TenantServiceOverride` remains tenant-scoped commercial data and all customer order/catalog queries retain tenant context.
- **Local catalog ownership**: PASS. MasterService remains the public identity; provider IDs, payloads, costs, and routing configuration remain private.
- **Provider adapters and credential safety**: PASS. BulkFollows remains backend-only; adapter lookup is selected by private origin and credentials stay in backend environment configuration.
- **Order and money integrity**: PASS. Existing integer money, transaction, idempotency, refund, and ambiguous-result protections are preserved.
- **Public API compatibility**: PASS with additive capability projection only; provider infrastructure is excluded.

No constitution violation requires an exception.

## Repository Surface

### Documentation

```text
specs/013-provider-agnostic-service-capability/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── customer-catalog-capability.md
│   └── provider-order-adapter.md
└── tasks.md                 # deliberately not created by this plan
```

### Backend files/modules affected during implementation

- `backend/prisma/schema.prisma`: offering relation, normalized contract storage, historical binding fields, private input snapshot.
- `backend/src/modules/catalog/catalog.module.ts`: register offering/normalization repositories and services.
- `backend/src/modules/catalog/application/curation.service.ts`: create/update explicit offering mappings during curated promotion without repurposing `provenanceRef`.
- `backend/src/modules/catalog/infrastructure/master-service.repository.ts`: preserve legacy provenance lookup and add offering-aware persistence methods.
- `backend/src/modules/catalog/infrastructure/provider-service.repository.ts`: expose provider-service lookup/upsert data needed for normalization/backfill.
- `backend/src/modules/catalog/infrastructure/bulkfollows.client.ts`: retain import contract and feed structured normalization facts; do not add Custom Comments assumptions.
- `backend/src/modules/catalog/infrastructure/quantity-bounds.ts`: remain a compatibility reader for legacy BulkFollows Standard records, not the new routing authority.
- `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts`: resolve safe capability metadata from the selected valid offering, with legacy fallback only during migration.
- `backend/src/modules/catalog/application/public-catalog.service.ts` and `backend/src/modules/catalog/application/dto/public-catalog.dto.ts`: add only normalized customer-safe capability fields when contract-valid; never expose provider metadata.
- `backend/src/modules/orders/application/order.service.ts`: resolve a provider-neutral candidate, canonicalize dynamic input for idempotency, and dispatch through the adapter while preserving current result handling.
- `backend/src/modules/orders/infrastructure/order.repository.ts`: replace direct provenance/raw-payload routing for new orders with offering resolution; preserve legacy resolution for unbackfilled Standard orders; persist historical binding and input snapshot.
- `backend/src/modules/orders/infrastructure/bulkfollows-order.client.ts`: adapt the existing client to the provider-neutral create/status boundary without changing timeout, one-attempt, or unknown-result semantics.
- `backend/src/modules/orders/orders.module.ts`: register adapter, offering resolver, and repositories.
- `backend/test/unit/orders/*`, `backend/test/contract/orders/*`, `backend/test/unit/catalog/*`, `backend/test/contract/catalog/*`, and `backend/test/integration/catalog/*`: focused regression and migration tests.

No frontend source, Feature 012 artifact, provider Admin UI, Favorites code, or SMMGEN integration is in scope.

## Implementation Phases

### Phase 1: Domain and schema foundation

1. Add an explicit `MasterServiceProviderOffering` relation between `MasterService` and `ProviderService`.
2. Store platform-global selection and availability on the offering. Enforce the invariant that, for each MasterService, at most one offering may have `isSelected = true`. Do not use `UNIQUE(masterServiceId, isSelected)`, because multiple non-selected offerings must remain valid. Prefer a MySQL/MariaDB-compatible enforcement strategy; if conditional uniqueness cannot be cleanly enforced by the database, enforce selection changes transactionally in the application/repository layer and cover the invariant with concurrency tests. Do not introduce a PostgreSQL-style partial unique index.
3. Store a versioned normalized capability contract as private structured JSON plus a bounded capability key. Initial keys are `STANDARD` and `CUSTOM_COMMENTS`; unknown values are unsupported.
4. Add nullable historical offering/provider-service/capability linkage to `OrdenProveedor`; retain `proveedor`, `idExterno`, original request/response, and existing uniqueness/indexes during compatibility. Treat `OrdenProveedor.idExterno` strictly as the external provider ORDER ID, never as `ProviderService.externalId`.
5. Add a nullable private structured input snapshot to `Orden` if the final Prisma mapping is clean. If Prisma/index/query constraints make that unsuitable, use one private one-to-one order-input record; do not create capability-specific tables. Preserve `Orden.cantidad` and do not make it nullable solely for Custom Comments.
6. Add indexes for `(masterServiceId, isEnabled, isSelected)`, provider-service lookup, historical offering lookup, and any JSON/version lookup required by the chosen schema. Do not index customer private comment text.
7. Generate a forward-only migration plan: additive columns/tables first, nullable historical fields, then backfill, then application read cutover. No destructive change or database reset.

### Phase 2: Capability normalization and BulkFollows compatibility

1. Define a provider-neutral capability contract with required fields, quantity mode, target kind, bounds, supported operations, source provider/type, and validation status.
2. Normalize only structured provider metadata. Preserve raw payload for diagnostics, but do not let new order code inspect it directly.
3. Map verified BulkFollows `Default` entries to `STANDARD`.
4. Map BulkFollows Custom Comments to `CUSTOM_COMMENTS` only after the exact provider contract is verified. Until then, retain the record as unsupported/non-orderable.
5. Keep `readQuantityBounds` as a legacy compatibility normalizer for unbackfilled BulkFollows Standard records; do not use it to infer Custom Comments semantics.
6. Make unknown/malformed/contradictory capability metadata unavailable and emit only sanitized administrative diagnostics.

### Phase 3: New-order offering resolution

1. Add a platform-global offering resolver that receives tenant, MasterService, and customer-neutral input context.
2. Resolve active/visible MasterService, tenant override, selected offering, normalized capability, provider service, price/cost inputs, and provider adapter before wallet/provider side effects.
3. Require exactly one selected, enabled, available, supported offering. Missing or ambiguous selection fails closed; no cheapest, random, tenant-specific, or fallback selection.
4. Preserve existing Standard order request fields and price calculation. For unbackfilled Standard services, use a temporary legacy resolver through `provenanceRef` only where the relationship and raw contract are unambiguous.
5. Create the order and wallet movement transactionally, then create the historical provider binding before an accepted provider result can be associated.
6. Submit through one provider-neutral adapter. Preserve one attempt, accepted/rejected/unknown outcomes, safe responses, and no cross-provider retry after ambiguity.

### Phase 4: Historical binding, dynamic inputs, and idempotency

1. Reuse `OrdenProveedor` as the historical provider record and populate immutable offering/provider-service/capability linkage for new orders.
2. Resolve status, refill, cancellation, and reconciliation from the historical binding, not current MasterService selection. Existing rows with null new linkage continue through legacy provider fields.
3. Preserve the existing request fingerprint representation for current `STANDARD` orders; adding a private input snapshot or capability metadata must not silently alter it. For capabilities that actually define dynamic inputs, use a versioned canonical representation containing stable field order, normalized target, capability key, and normalized dynamic values.
4. Include comments and any effective quantity in the versioned dynamic-input fingerprint only when that capability defines those inputs. Do not log comments or include provider credentials/raw responses in snapshots.
5. Persist the validated private input snapshot alongside the order lifecycle record. Use `Orden.cantidad` as effective quantity whenever the contract proves it deterministic; do not invent quantity.
6. Keep Custom Comments rejected before wallet/order writes while quantity semantics or normalization rules remain unresolved.

### Phase 5: Customer-safe catalog contract

1. Continue exposing MasterService identity, curated copy, tenant price, and safe bounds only.
2. Add an optional normalized capability projection only when the selected/eligible offering has a valid supported contract. The projection contains logical input requirements, not provider type codes, IDs, origin, cost, raw payload, or routing state.
3. Keep provider disappearance visible only as loss of order eligibility; preserve MasterService and future Favorite compatibility.
4. Update Swagger and contract tests additively. No Feature 012 form implementation is included; frontend rendering is deferred to a separate feature.

### Phase 6: Backfill, migration verification, and regression suite

1. Inventory every active MasterService with non-null `provenanceRef`.
2. Backfill one explicit BulkFollows offering only when the referenced ProviderService and verified Standard contract are unambiguous.
3. Mark missing, duplicate, malformed, unsupported, or disappeared relationships unavailable; never infer cross-provider mappings from text.
4. Backfill `OrdenProveedor` historical linkage only where independent, deterministic repository evidence identifies the provider service/offering originally used. `idExterno` is the external provider order ID and must not be used as `ProviderService.externalId`. Never infer historical linkage from titles, descriptions, prices, categories, or the external order ID; otherwise leave new linkage nullable and continue resolving through existing legacy provider fields.
5. Run migration dry-run and schema/client generation in an isolated test database. Verify rollback/forward recovery procedure before production rollout.
6. Run catalog, order, wallet, refund, idempotency, tenant-isolation, adapter, public-contract, and historical-routing tests with fakes only.

## Backward Compatibility Rules

- `MasterService.provenanceRef` remains nullable and readable only as a compatibility path; it is never the new selector.
- Existing BulkFollows Standard orders keep `serviceId`, target, quantity, current pricing, wallet, refund, idempotency, and ambiguous-result semantics.
- Existing `STANDARD` request fingerprints remain represented exactly as they are today; private snapshots and capability metadata are additive and must not silently migrate those semantics.
- Existing `OrdenProveedor` rows remain valid with legacy provider fields and null new linkage.
- Existing public catalog fields remain stable; capability is additive and customer-safe.
- Provider disappearance disables offering resolution without deleting MasterService, tenant overrides, or future Favorite references.

## Remaining Implementation Gates

1. BulkFollows Custom Comments remains blocked until its exact request shape, quantity mode, bounds, blank-line/trimming/duplicate policy, pricing quantity, and provider field names are verified.
2. The final Prisma placement and exact field shape of the private structured order-input snapshot must be selected during implementation design, with `Orden.cantidad` preserved.

## Post-design Constitution Check

PASS. The design is additive, provider-adapter based, tenant-safe, fail-closed, financially compatible, and explicitly defers all unapproved provider behavior. No task generation or implementation is part of this plan.
