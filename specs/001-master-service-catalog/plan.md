# Implementation Plan: Master Service Catalog

**Branch**: `001-master-service-catalog` | **Date**: 2026-07-18 | **Spec**: specs/001-master-service-catalog/spec.md

**Input**: Feature specification from `specs/001-master-service-catalog/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Build a curated Master Service Catalog that ingests provider services from BulkFollows into a staging area, allows administrative curation, and publishes versioned snapshots used to generate tenant catalogs for the White Label platform. The implementation will follow the project's constitution and stack: Node.js + TypeScript backend using NestJS, MySQL with Prisma for persistence, and background jobs for synchronization. The master catalog will store provider provenance, provider cost, and a Default Selling Price; tenant catalogs inherit selling prices and may override them.

## Technical Context

**Language/Version**: Node.js (>=18), TypeScript (>=5.x) following project standards listed in the constitution.

**Primary Dependencies**: NestJS, Prisma ORM, MySQL driver. No external queueing system for v1 (no Redis/RabbitMQ).

**Storage**: MySQL (configured via Prisma).

**Testing**: Unit tests with Jest; integration tests for import/curation/publish flows; contract tests for export snapshot format.

**Target Platform**: Linux server (container-friendly).

**Project Type & Structure**: Single backend service implemented with the concrete layout below.

**Performance Goals**: Support catalogs of ~1k–10k services; initial full import runs should complete within operational windows (see spec SC-005). Re-evaluate for larger scales.

**Constraints**: Follow constitution: no new major infra without ADR; provider credentials stay backend-only; strict multi-tenant isolation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

I have re-evaluated planned choices against the ImpulsoSocialV2 constitution. The planned implementation:

- Uses the prescribed stack (Node.js/TypeScript/NestJS/MySQL/Prisma).
- Keeps provider integrations backend-only and stores credentials securely.
- Preserves tenant isolation and audit requirements.
- Introduces no new infrastructure (no external queues) for v1.

Result: Constitution check PASSED for Phase 0→1 progression. Any future architectural changes (e.g., external queue adoption) require an ADR.

## Synchronization (v1)

For v1 the synchronization mechanism will be an in-process NestJS scheduled job (CRON) plus an on-demand administrative trigger available via protected administrative interfaces. Synchronization behavior:

- Each execution (scheduled or on-demand) creates a `SyncJob` record capturing `jobId`, `startedAt`, `finishedAt`, `status`, and summary counts.
- The job performs incremental, idempotent imports: provider records are matched to existing `ProviderService` entries by the composite key `(providerOrigin, externalId)`; updates will reconcile technical metadata but will not overwrite curated business fields on `MasterService`.
- Raw provider payloads and provenance are stored securely (backend-only) and never included in tenant exports.
- Future adoption of an external queue (Redis/RabbitMQ) is explicitly out of scope for v1 and would require a separate ADR and design.

## Project Structure (concrete)

Implementation files and tests for this feature will reside under the concrete paths listed above. Use NestJS modules pattern: a `CatalogModule` containing `CatalogService`, `SyncService`, `MasterServiceRepository` (Prisma-backed), and `SnapshotService`.

## Project Structure

### Documentation (this feature)

```text
specs/001-master-service-catalog/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── master-catalog-export.md
└── tasks.md
```

### Source Code (concrete layout)

```text
backend/
├── src/
│   ├── modules/
│   │   └── catalog/
│   │       ├── catalog.module.ts
│   │       ├── application/
│   │       ├── domain/
│   │       ├── infrastructure/
│   │       └── presentation/
│   └── prisma/
└── test/
    ├── unit/
    │   └── catalog/
    ├── integration/
    │   └── catalog/
    └── contract/
        └── catalog/
```

**Structure Decision**: Implement the `CatalogModule` under `backend/src/modules/catalog` using NestJS module patterns. Do not assume alternative flat layouts.

## Complexity Tracking

No constitution violations require justification.
