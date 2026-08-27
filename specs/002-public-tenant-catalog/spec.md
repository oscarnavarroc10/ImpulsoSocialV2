# Feature Specification: Public Tenant Catalog

**Feature Branch**: `feature/002-public-tenant-catalog`

**Created**: 2026-08-27

**Status**: Approved

**Input**: Expose the curated tenant catalog to the frontend through a small, public, read-only API. The API must use local `MasterService` data, apply the configured tenant's visibility and price overrides, and never expose provider-private fields.

## Clarifications

### Session 2026-08-27

- The MVP resolves exactly one tenant from the existing `DEFAULT_TENANT_SLUG` backend setting. A caller cannot select a tenant through a path, query, body, or header.
- These endpoints are public and do not require a JWT or `CatalogAuthorizationGuard`.
- The public read model is built from active, visible `MasterService` rows plus the resolved tenant's optional `TenantServiceOverride`. Published snapshots remain an administrative export concern and are not read by this feature.
- A tenant override can disable a master-visible service but cannot make a master-hidden service public.
- A complete tenant price override replaces the default selling price. Without a complete override, the master service's default selling price is used.
- Monetary amounts are returned as integer minor units.
- URI versioning is local to these new routes (`/v1/...`); global API versioning and migration of existing routes remain outside this feature.

## User Scenarios & Testing

### User Story 1 - Browse the public catalog (Priority: P1)

As a visitor, I can retrieve a paginated list of services that the configured store currently offers so the frontend can render a catalog without authentication.

**Why this priority**: This is the smallest backend capability required to show sellable services to customers.

**Independent Test**: Seed active and inactive master services plus tenant overrides, call `GET /v1/catalog/services`, and verify that only services visible for the configured tenant are returned with customer-safe fields and resolved selling prices.

**Acceptance Scenarios**:

1. **Given** the configured tenant is active and an active `MasterService` has `isVisible=true` with no tenant override, **When** the catalog is requested, **Then** the service is returned with its default selling price.
2. **Given** an active, master-visible service has a tenant override with `isEnabled=false`, **When** the catalog is requested, **Then** that service is excluded.
3. **Given** an active, master-visible service has an enabled tenant override with a complete selling-price override, **When** the catalog is requested, **Then** the service is returned with the tenant price.
4. **Given** a master service is hidden, draft, or deprecated, **When** the catalog is requested, **Then** it is excluded regardless of any tenant override.
5. **Given** valid `page`, `limit`, `socialNetwork`, or `categoryId` query parameters, **When** the catalog is requested, **Then** the results and pagination metadata reflect those values.
6. **Given** invalid pagination or an empty filter value, **When** the catalog is requested, **Then** the API responds with HTTP 400.

---

### User Story 2 - View one public service (Priority: P1)

As a visitor, I can retrieve one currently available service by its internal ID so the frontend can render service details before a future order flow is implemented.

**Why this priority**: The detail contract is required by the customer purchase screen and must obey exactly the same tenant and visibility rules as the list.

**Independent Test**: Call `GET /v1/catalog/services/:id` for visible, disabled, hidden, deprecated, and nonexistent services; only the visible service is returned.

**Acceptance Scenarios**:

1. **Given** a service is visible for the configured tenant, **When** its internal ID is requested, **Then** the API returns the customer-safe service and resolved selling price.
2. **Given** a service does not exist or is not visible for the configured tenant, **When** its ID is requested, **Then** the API responds with the same HTTP 404 result.
3. **Given** an empty or invalid ID, **When** the detail endpoint is requested, **Then** the API responds with HTTP 400 or 404 without revealing internal data.

## Edge Cases

- If `DEFAULT_TENANT_SLUG` is absent, blank, points to a missing tenant, or points to an inactive tenant, the API must fail closed and must not fall back to another tenant.
- Pagination must remain deterministic when multiple services have the same title; order by `title` and then `id`, both ascending.
- A tenant override row belonging to another tenant must never affect the resolved tenant's catalog.
- A partially populated price override must not produce a partial monetary object; the complete master default price is used instead.
- `total` and `totalPages` must be calculated after tenant visibility and optional filters are applied.
- Hidden and nonexistent detail records must be indistinguishable to public callers.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose `GET /v1/catalog/services` without requiring authentication.
- **FR-002**: The system MUST expose `GET /v1/catalog/services/:id` without requiring authentication.
- **FR-003**: The system MUST resolve the tenant only from the normalized `DEFAULT_TENANT_SLUG` backend configuration and MUST verify that the matching `Tienda` exists and is active.
- **FR-004**: Public catalog queries MUST be scoped to the resolved tenant's ID when reading `TenantServiceOverride` rows.
- **FR-005**: The system MUST include only `MasterService` rows whose `status` is `active` and whose `isVisible` value is `true`.
- **FR-006**: A matching override with `isEnabled=false` MUST exclude the service. An override MUST NOT enable a master-hidden, draft, or deprecated service.
- **FR-007**: The selling price MUST use the tenant override only when both override amount and currency are present; otherwise it MUST use `defaultSellingPriceAmount` and `defaultSellingPriceCurrency`.
- **FR-008**: `GET /v1/catalog/services` MUST support `page` and `limit`; defaults are `page=1` and `limit=20`, the maximum limit is `100`, and both values MUST be positive integers.
- **FR-009**: The list MUST support optional exact filters for `socialNetwork` and `categoryId`; provided filter values MUST be trimmed, non-empty strings.
- **FR-010**: List results MUST be ordered deterministically by `title ASC, id ASC`.
- **FR-011**: The list response MUST have the following shape:

  ```json
  {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
  ```

- **FR-012**: Each public service MUST contain only this contract:

  ```json
  {
    "id": "internal-master-service-id",
    "title": "Instagram Followers",
    "description": "Curated customer description",
    "socialNetwork": "Instagram",
    "categoryId": "internal-category-id",
    "sellingPrice": {
      "amount": 1750,
      "currency": "USD"
    }
  }
  ```

- **FR-013**: `sellingPrice.amount` MUST be an integer expressed in minor units and `sellingPrice.currency` MUST be the stored ISO currency string.
- **FR-014**: Public responses MUST NOT contain provider cost, provider origin, external IDs, provenance references, raw payloads, provider metadata, audit data, or tenant override persistence details.
- **FR-015**: A missing or tenant-invisible service MUST return HTTP 404 from the detail endpoint.
- **FR-016**: Invalid query values MUST return HTTP 400 using NestJS validation behavior.
- **FR-017**: Both endpoints and all request/response DTOs MUST be documented in Swagger/OpenAPI, including query parameters, examples, successful responses, HTTP 400, and HTTP 404 where applicable.
- **FR-018**: The implementation MUST use the existing `CatalogModule`, Prisma client, `MasterService`, `Tienda`, and `TenantServiceOverride` models without schema changes or new dependencies.

### Public Contract Fields

| Field | Type | Rule |
|---|---|---|
| `id` | string | Internal `MasterService.id` only |
| `title` | string | Curated title |
| `description` | string | Curated description |
| `socialNetwork` | string | Curated network |
| `categoryId` | string | Internal category identifier |
| `sellingPrice.amount` | integer | Minor units; tenant override or master default |
| `sellingPrice.currency` | string | Currency paired with the selected amount |

## Success Criteria

- **SC-001**: Automated tests return 100% of eligible active, visible services and 0 hidden, disabled, draft, or deprecated services in the fixture set.
- **SC-002**: Automated contract assertions find 0 forbidden provider-private fields in list and detail responses.
- **SC-003**: Pagination, both filters, tenant price override, default price fallback, and detail 404 behavior pass focused automated tests.
- **SC-004**: The backend builds successfully and the focused public-catalog tests pass without contacting BulkFollows or requiring live credentials.
- **SC-005**: Swagger documents both public versioned routes and their exact customer-facing response shape.

## Assumptions

- The existing seed creates the tenant named by `DEFAULT_TENANT_SLUG`.
- `TenantServiceOverride` write validation continues to ensure monetary consistency; this feature is read-only.
- The current MVP uses one configured public tenant. Hostname or custom-domain tenant resolution will be specified separately.
- `categoryId` is sufficient for this MVP response; a public categories endpoint and category names are separate work.

## Out of Scope

- Registration, login, refresh-token rotation, and logout.
- Creating orders, calling BulkFollows for orders, order status, refill, or cancellation.
- Wallets, balances, deposits, charges, and refunds.
- Public category listing or search by free text.
- Hostname, subdomain, header, or caller-selected tenant resolution.
- Published snapshot selection or tenant catalog publication workflows.
- Changes to existing administrative catalog routes or their authorization.
- Prisma schema changes, migrations, new packages, caching, CRON, queues, or frontend changes.
- Completing remaining tasks from `001-master-service-catalog`.
