# Implementation Plan: Public Tenant Catalog

**Branch**: `feature/002-public-tenant-catalog` | **Date**: 2026-08-27 | **Spec**: `specs/002-public-tenant-catalog/spec.md`

**Input**: Feature specification from `specs/002-public-tenant-catalog/spec.md`

## Summary

Add a small public, read-only catalog to the existing NestJS `CatalogModule`. The implementation resolves the single MVP tenant from `DEFAULT_TENANT_SLUG`, reads only active and master-visible `MasterService` rows, applies that tenant's optional visibility and selling-price overrides, maps results to an explicit safe DTO, and exposes versioned list and detail routes. No database, authentication, provider, snapshot, or infrastructure changes are required.

## Technical Context

**Language/Version**: Existing Node.js and TypeScript versions from `backend/package.json`.

**Primary Dependencies**: Existing NestJS, Prisma ORM, MySQL, `class-validator`, `class-transformer`, and `@nestjs/swagger` packages only.

**Storage**: Existing `Tienda`, `MasterService`, and `TenantServiceOverride` Prisma models. No migration.

**Testing**: Focused Jest unit and contract tests with mocked Prisma/repository dependencies; no live MySQL and no BulkFollows calls.

**Public Routes**:

- `GET /v1/catalog/services`
- `GET /v1/catalog/services/:id`

**Performance Target**: A single paginated query plus count per list request; bounded page size of 100. A detail request must retrieve at most one eligible service.

**Constraints**:

- No new package, schema change, migration, global API prefix, guard, cache, or provider call.
- Do not modify auth, snapshot, sync, curation, order, wallet, or existing administrative controller behavior.
- Do not accept tenant identity from public request data.
- Do not expose Prisma entities directly.

## Constitution Check

- **Specification before implementation**: This spec, plan, and task list define the complete feature before production code changes.
- **Multi-tenancy**: Tenant is resolved server-side from `DEFAULT_TENANT_SLUG`; all override reads use the resulting tenant ID. No caller-controlled tenant ID is accepted.
- **Local catalog ownership**: Responses use curated `MasterService` fields only.
- **Provider secrecy**: Repository selection and DTO mapping exclude provider cost, provenance, external IDs, raw payloads, and metadata.
- **API contracts**: New public paths are URI-versioned under `/v1` and fully documented with Swagger.
- **Money**: Amounts remain integer minor units and are never converted through floating point.
- **Security by default**: Missing or inactive tenant resolution fails closed; hidden and nonexistent service details both return 404.
- **Simplicity**: The feature reuses existing models and module structure without new infrastructure or abstractions beyond one focused repository/service/controller flow.

**Gate Result**: PASSED. No ADR is required because this feature adds a bounded read-only contract and does not change the approved persistence or multi-tenant architecture. The explicit MVP choice to use `DEFAULT_TENANT_SLUG` is documented in the specification.

## Request Flow

1. `PublicCatalogController` validates query or path input and delegates to the application service.
2. `PublicCatalogService` reads and normalizes `DEFAULT_TENANT_SLUG` through `ConfigService`.
3. `PublicCatalogRepository` resolves an active `Tienda`; missing or inactive tenant resolution fails closed.
4. The repository lists or retrieves only active, master-visible services, scoped to the resolved tenant's overrides.
5. Disabled overrides exclude services. Complete tenant price overrides replace the master default price.
6. The service maps selected data to the explicit public DTO; Prisma rows are never returned directly.

## Implementation Design

### DTO and validation

Create `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` containing:

- Query DTO with `page`, `limit`, `socialNetwork`, and `categoryId` validation/transformation.
- Public selling-price, service item, pagination, and list response DTOs with Swagger properties.
- No provider or persistence-only fields.

### Repository

Create `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts`.

Repository responsibilities:

- Resolve an active tenant by normalized slug.
- Execute tenant-scoped list and detail reads.
- Enforce `status='active'` and `isVisible=true` at query time.
- Exclude a service when the resolved tenant has an override with `isEnabled=false`.
- Select only the curated fields and the resolved tenant's price override fields.
- Return a deterministic `title ASC, id ASC` page and filtered total.

The list data query and count query must use the same eligibility predicate. Queries must not load `ProviderService`, `StagedService`, `provenanceRef`, provider cost, raw payload, or metadata.

### Application service

Create `backend/src/modules/catalog/application/public-catalog.service.ts`.

Service responsibilities:

- Normalize and require `DEFAULT_TENANT_SLUG`.
- Fail closed when the configured tenant is absent or inactive.
- Calculate skip/take from validated pagination.
- Select a complete tenant price override or the complete master default price.
- Map list and detail results to the exact public response contract.
- Return `NotFoundException` for missing or ineligible detail records.

### Controller and module wiring

Create `backend/src/modules/catalog/presentation/public-catalog.controller.ts` with the literal versioned route `v1/catalog/services` so `main.ts` and existing unversioned endpoints remain unchanged.

The controller must:

- Have no `CatalogAuthorizationGuard` and no bearer-auth decorator.
- Document operations, query parameters, response DTOs, HTTP 400, and HTTP 404 in Swagger.
- Delegate business decisions to `PublicCatalogService`.

Register the controller, repository, and service in the existing `CatalogModule`. Do not export them unless an existing consumer requires it.

## Planned File Changes

```text
specs/002-public-tenant-catalog/
├── spec.md
├── plan.md
└── tasks.md

backend/src/modules/catalog/
├── catalog.module.ts                                      # modify wiring only
├── application/
│   ├── dto/public-catalog.dto.ts                          # new
│   └── public-catalog.service.ts                          # new
├── infrastructure/public-catalog.repository.ts           # new
└── presentation/public-catalog.controller.ts              # new

backend/test/
├── unit/catalog/public-catalog.service.spec.ts            # new
└── contract/catalog/public-catalog.controller.spec.ts     # new
```

Maximum expected production/test files changed: 7. The three SDD files are already approved inputs and are not implementation scope.

## Test Strategy

### Unit tests

`public-catalog.service.spec.ts` must prove:

- Configured active tenant resolution and normalization.
- Missing/inactive configured tenant fails closed.
- Default selling price and complete tenant override selection.
- Partial tenant price override falls back to the complete master default.
- Pagination metadata and deterministic repository parameters.
- Hidden/disabled/deprecated/nonexistent detail results produce no public data and detail returns 404.
- Repository calls are scoped to the resolved tenant ID.

### Contract tests

`public-catalog.controller.spec.ts` must prove:

- Routes are public and do not depend on a JWT.
- Default and custom pagination plus filters are accepted.
- Invalid query values return 400.
- List and detail responses contain exactly the approved public fields.
- A recursive forbidden-key assertion rejects provider/private keys, including `providerCostAmount`, `providerCostCurrency`, `provenanceRef`, `providerOrigin`, `externalId`, `rawPayload`, and `metadata`.
- Missing/ineligible detail returns 404.

Tests must use fakes or mocks and must not call live MySQL or BulkFollows.

## Validation Commands

Run only the focused checks below from `backend/`:

```bash
npm run build

npx eslint \
  src/modules/catalog/application/dto/public-catalog.dto.ts \
  src/modules/catalog/application/public-catalog.service.ts \
  src/modules/catalog/infrastructure/public-catalog.repository.ts \
  src/modules/catalog/presentation/public-catalog.controller.ts \
  src/modules/catalog/catalog.module.ts \
  test/unit/catalog/public-catalog.service.spec.ts \
  test/contract/catalog/public-catalog.controller.spec.ts

npm test -- --runInBand \
  test/unit/catalog/public-catalog.service.spec.ts \
  test/contract/catalog/public-catalog.controller.spec.ts
```

Do not run a live provider synchronization as part of this feature.

## Stop Conditions

Stop without expanding the implementation and report the reason if any task appears to require:

- A Prisma schema change or migration.
- A new dependency.
- Changes to `main.ts`, auth, orders, wallets, sync, snapshots, or existing administrative endpoint behavior.
- More than the seven planned production/test files.
- Caller-controlled tenant selection.
- A provider API call.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.
