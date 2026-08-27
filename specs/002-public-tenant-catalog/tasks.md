# Tasks: Public Tenant Catalog

**Input**: `specs/002-public-tenant-catalog/spec.md` and `specs/002-public-tenant-catalog/plan.md`

**Scope rule**: Implement only T001–T006. Do not execute tasks from `001-master-service-catalog` and do not add adjacent functionality.

## Phase 1: Public contract

- [x] **T001** Define and document the validated public catalog query and response DTOs, including pagination defaults (`page=1`, `limit=20`), maximum limit (`100`), optional `socialNetwork` and `categoryId` filters, integer-minor-unit selling price, and the exact safe response fields — `backend/src/modules/catalog/application/dto/public-catalog.dto.ts`

**Independent completion**: DTO validation accepts the approved query values, rejects invalid values, and Swagger can describe the exact list/detail contracts without any provider-private fields.

## Phase 2: Tenant-scoped read path

- [x] **T002** Implement the focused Prisma repository that resolves an active tenant by slug and performs list/count/detail queries scoped to that tenant, enforcing `MasterService.status='active'`, `isVisible=true`, tenant disable overrides, optional filters, safe field selection, and deterministic `title ASC, id ASC` ordering — `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts`

- [x] **T003** Implement the public catalog application service that resolves only `DEFAULT_TENANT_SLUG`, fails closed for a missing/inactive tenant, applies complete tenant selling-price overrides with default-price fallback, maps only the approved public fields, returns pagination metadata, and maps missing/ineligible detail records to HTTP 404 — `backend/src/modules/catalog/application/public-catalog.service.ts`

**Independent completion**: With mocked persistence, list and detail return the resolved tenant's safe catalog and cannot be influenced by another tenant's override.

## Phase 3: Public versioned API

- [x] **T004** Add the public Swagger-documented `GET /v1/catalog/services` and `GET /v1/catalog/services/:id` controller without `CatalogAuthorizationGuard` or bearer authentication, then register only the new controller, service, and repository in `CatalogModule` — `backend/src/modules/catalog/presentation/public-catalog.controller.ts`, `backend/src/modules/catalog/catalog.module.ts`

**Independent completion**: Both routes are reachable without a JWT and existing administrative routes and authorization remain unchanged.

## Phase 4: Focused verification

- [x] **T005** Add focused unit and contract tests covering tenant resolution, active/visible filtering, disabled overrides, tenant/default price resolution, partial override fallback, pagination, filters, deterministic repository inputs, detail success/404, public access, exact response shape, and recursive absence of provider-private keys — `backend/test/unit/catalog/public-catalog.service.spec.ts`, `backend/test/contract/catalog/public-catalog.controller.spec.ts`

- [x] **T006** Run the exact focused validation commands from `plan.md`: backend build, ESLint only for the seven planned production/test files, and only the two new Jest suites. Report commands and results; do not continue to auth, orders, wallets, snapshots, sync, or any task from feature `001`.

## Dependencies and Execution Order

- T001 must complete before T003, T004, and T005.
- T002 must complete before T003 and T005.
- T003 must complete before T004 and T005.
- T004 must complete before the controller contract tests in T005.
- T001–T005 must complete before T006.

## Definition of Done

- `GET /v1/catalog/services` and `GET /v1/catalog/services/:id` match the approved contract.
- Tenant resolution is server-controlled and override queries use only the resolved tenant ID.
- Hidden, disabled, draft, deprecated, and nonexistent services do not leak through list or detail.
- No provider cost, provider identity, provenance, raw payload, or metadata appears in public responses.
- No Prisma schema, migration, dependency, auth, provider, snapshot, order, wallet, or existing administrative behavior is changed.
- Backend build, focused ESLint, and both focused Jest suites pass.
- T001–T006 are checked only after their implementation and validation are complete.

## Mandatory Stop Conditions

Stop and report without editing outside scope if implementation appears to require a schema/migration change, a new package, `main.ts`, caller-selected tenant identity, provider access, more than the seven planned production/test files, or changes to unrelated modules.
