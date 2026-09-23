# Implementation Plan: SMMGEN Provider Integration

**Branch**: `014-smmgen-provider-integration` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-smmgen-provider-integration/spec.md`

## Summary

Plan SMMGEN as a second provider implementation behind the Feature 013 catalog and order boundaries. `Default` normalizes to `STANDARD` and is the only executable capability. `Custom Comments` normalizes to `CUSTOM_COMMENTS` but remains unsupported and non-purchasable. Unknown, malformed, contradictory, or incomplete metadata is unsupported; no title, category, rate, or similarity inference is allowed.

The work is planning-only. It must use fake transports, mocks, sanitized fixtures, and recorded provider-shaped responses. It must not send live requests, use credentials, create provider orders, mutate production data, modify Feature 013 implementation or migration, or create `tasks.md`.

## Technical Context

**Language/Version**: TypeScript on Node.js, NestJS 11

**Primary Dependencies**: Prisma 7 with MariaDB adapter, `@nestjs/config`, native `fetch` transport seam, Jest 30, `ts-jest`, existing Feature 013 provider-neutral capability and adapter types

**Storage**: MySQL/MariaDB through Prisma; reuse `ProviderService`, `MasterServiceProviderOffering`, `TenantServiceOverride`, `Orden`, `OrdenProveedor`, `HistorialOrden`, `SyncJob`, and existing wallet/idempotency records. No migration is planned.

**Testing**: Jest unit, contract, integration, and e2e suites under `backend/test`; fake transports and adapters only for Feature 014

**Target Platform**: Backend service; SMMGEN access is backend-only

**Project Type**: Multi-tenant NestJS web API with Angular frontend unchanged by this feature

**Performance Goals**: Preserve existing catalog/order behavior; bound provider calls with the existing timeout pattern and make at most one attempt per operation. No new throughput target is introduced.

**Constraints**: Fail closed on unknown, malformed, contradictory, unsupported, unavailable, or ambiguously selected data; complete-success-only disappearance reconciliation; no automatic retry, failover, ranking, substitution, or provider leakage; TLS verification remains enabled; no live provider access during verification.

**Scale/Scope**: One additional provider origin (`smmgen`) and two normalized capability labels, with Standard as the only executable capability. Multiple provider offerings may map to one local MasterService.

## Verified Feature 013 Extension Points

- **Catalog boundary**: `backend/src/modules/catalog/infrastructure/provider-catalog-client.ts`, `bulkfollows.client.ts`, and `catalog.module.ts`; `PROVIDER_CATALOG_CLIENT` currently resolves only to BulkFollows.
- **Capability normalization**: `backend/src/modules/catalog/infrastructure/capability-normalizer.ts` and `domain/provider-capability.ts`; the current normalizer is BulkFollows-specific and fail-closed.
- **Import/reconciliation**: `backend/src/modules/catalog/sync/import-orchestrator.ts` and `sync.service.ts`; the orchestrator hard-codes `BULKFOLLOWS_PROVIDER_ORIGIN`, so SMMGEN needs origin-aware complete-snapshot handling.
- **Mapping/selection**: `backend/src/modules/catalog/infrastructure/master-service-provider-offering.repository.ts` and `application/master-service-provider-offering.service.ts`; selection is transactional and `findSelectedAvailable` is the new-order lookup.
- **Curation/availability**: `application/curation.service.ts`, `provider-service.repository.ts`, `staged-service.repository.ts`, and `provider-offering-backfill.service.ts`; mapping must remain explicit.
- **Public projection/pricing**: `infrastructure/public-catalog.repository.ts`, `application/public-catalog.service.ts`, `application/dto/public-catalog.dto.ts`, `tenant-service-override.repository.ts`, and `tenant-service-override.service.ts`; existing provider metadata helpers are BulkFollows-specific.
- **Order selection/invocation**: `backend/src/modules/orders/infrastructure/order.repository.ts` (`findCandidate`) and `application/order.service.ts` (`create`, `claimAndSubmit`); create currently calls concrete `BulkFollowsOrderClient` even though `PROVIDER_ORDER_ADAPTER` is registered.
- **Adapter registry/resolution**: `application/provider-order-adapter.ts`, `orders.module.ts`, `bulkfollows-order.adapter.ts`, and `bulkfollows-order.client.ts`; add origin-aware resolution at this boundary.
- **Historical binding/status**: `OrdenProveedor` in `backend/prisma/schema.prisma`, `OrderRepository.findForRefresh/applyRefresh`, and `OrderService.refreshStatus`; refresh currently exposes only origin/id and falls back to BulkFollows.
- **Tests**: `backend/test/unit/catalog/capability-normalizer.spec.ts`, `import-orchestrator.spec.ts`, `sync.service.spec.ts`, `backend/test/integration/catalog/sync-idempotency.spec.ts`, `provider-replacement.spec.ts`, `migration-verification.spec.ts`, `backend/test/unit/orders/order.service.spec.ts`, `bulkfollows-order.adapter.spec.ts`, `historical-binding.spec.ts`, `canonical-order-input.spec.ts`, and BulkFollows contract tests.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

All gates pass for planning:

- **Specification before implementation**: `spec.md` is authoritative and explicitly limits this work to planning/design.
- **Human architecture decisions**: no new technology, service, queue, routing policy, or parallel architecture is proposed; the provider client and adapter follow Feature 013 seams.
- **Tenant isolation and local catalog ownership**: tenant eligibility and `TenantServiceOverride` remain application-owned; SMMGEN identity, costs, raw payloads, and routing state remain private.
- **Secure provider integration**: `SMMGEN_API_URL` and `SMMGEN_API_KEY` are backend environment configuration only; TLS verification is retained and logs/errors are sanitized.
- **Order and financial integrity**: existing idempotency, wallet transaction, one-attempt, accepted/rejected/uncertain, refund, and monotonic status behavior is retained.
- **API compatibility**: public responses remain MasterService/provider-neutral; no frontend or provider-specific public contract is added.
- **Quality and simplicity**: focused fixture-based tests are planned, and the existing Prisma schema is reused. No migration is required; therefore no migration is created.

No constitution violation requires a complexity exception.

## Project Structure

### Documentation (this feature)

```text
specs/014-smmgen-provider-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── smmgen-provider-boundary.md
    └── smmgen-customer-projection.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── modules/
│       ├── catalog/
│       │   ├── infrastructure/
│       │   │   ├── smmgen.client.ts                 # planned provider client
│       │   │   └── smmgen-capability-normalizer.ts  # planned provider mapping
│       │   │   └── smmgen-reconciliation.service.ts # planned complete-success gate
│       │   ├── sync/
│       │   └── application/
│       └── orders/
│           ├── infrastructure/
│           │   └── smmgen-order.adapter.ts          # planned Standard/status adapter
│           └── application/
└── test/
  ├── unit/catalog/
  ├── unit/orders/
  ├── contract/catalog/
  ├── contract/orders/
  └── integration/catalog/

frontend/                                             # unchanged by this feature
```

**Structure Decision**: Keep the existing NestJS `catalog` and `orders` modules. Add SMMGEN-specific implementations beside `bulkfollows.client.ts` and `bulkfollows-order.adapter.ts`, register them through the existing provider tokens/registry seam, and reuse the existing offering repository, sync job, order repository, wallet service, and public DTO projection. Do not create a parallel provider module, provider-specific public controller, tenant routing model, or frontend surface.

## Existing Feature 013 Extension Points

The implementation inspection identified these concrete owners:

- Catalog identity and curation: `backend/src/modules/catalog/application/curation.service.ts`, `master-service.repository.ts`, `provider-service.repository.ts`, and `MasterServiceProviderOfferingRepository`.
- Capability normalization: `backend/src/modules/catalog/infrastructure/capability-normalizer.ts` and `backend/src/modules/catalog/domain/provider-capability.ts`.
- Offering selection and availability: `backend/src/modules/catalog/application/master-service-provider-offering.service.ts`, `master-service-provider-offering.repository.ts`, and `sync/import-orchestrator.ts`.
- Provider catalog boundary: `provider-catalog-client.ts`, `BulkFollowsClient`, `SyncService`, and `ImportOrchestrator`.
- Canonical inputs and order adapters: `backend/src/modules/orders/application/canonical-order-input.ts`, `provider-order-adapter.ts`, `bulkfollows-order.adapter.ts`, and `bulkfollows-order.client.ts`.
- Tenant/pricing/privacy: `OrderRepository`, `PublicCatalogRepository`, `PublicCatalogService`, `TenantServiceOverrideRepository`, and the existing DTOs.
- Historical binding, idempotency, and status: `OrdenProveedor` relations in Prisma, `OrderRepository.findForRefresh/applyRefresh`, `OrderService`, and the existing wallet transaction path.
- Regression anchors: `backend/test/unit/orders/bulkfollows-order.adapter.spec.ts`, `order.service.spec.ts`, `historical-binding.spec.ts`, `canonical-order-input.spec.ts`, `backend/test/contract/orders/bulkfollows-order.client.spec.ts`, and catalog sync/offering tests.

## Schema And Migration Decision

No Feature 014 schema change is justified. `ProviderService` has `(providerOrigin, externalId)` uniqueness; `MasterServiceProviderOffering` stores explicit mapping, capability key/version/contract, enabled/available/selected state; `OrdenProveedor` stores provider identity, external order ID, offering/provider links, capability/version snapshots, private request/response records, and refresh state; `Orden.datosEntradaPrivada` and `requestFingerprint` preserve private input and idempotency; `HistorialOrden` and `SyncJob` cover lifecycle/audit and synchronization. The Feature 013 migration `backend/prisma/migrations/20260922190000_add_provider_agnostic_offerings` remains unchanged. If implementation proves a missing field, stop for a separately approved additive migration decision.

## Phase 0 And Phase 1 Outputs

- `research.md` records the source inspection, provider-boundary decision, normalization policy, reconciliation safety rule, and deferred Custom Comments decisions.
- `data-model.md` maps SMMGEN facts to existing records and states the no-migration rationale.
- `contracts/smmgen-provider-boundary.md` defines the private catalog/order/status boundary and sanitized result shapes.
- `contracts/smmgen-customer-projection.md` defines the provider-neutral public projection and privacy exclusions.
- `quickstart.md` defines fixture-only validation commands and expected outcomes; it contains no live credentials or provider calls.

This planning run intentionally does not create `tasks.md`.

## Complexity Tracking

No complexity exceptions are required.
