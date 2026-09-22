# Research: Customer Dashboard and Order Experience

**Feature**: `012-customer-dashboard-orders`

## Decision 1: Reuse the existing authentication lifecycle

- **Decision**: Reuse `AuthService`, `AuthApiService`, `authGuard`, `authInterceptor`, `SessionStorageService`, and the backend `/auth/login`, `/auth/register`, `/v1/auth/refresh`, and `/v1/auth/logout` contracts.
- **Rationale**: The existing flow validates the authenticated user, tenant, and active rotated session. Refresh rotation is atomic and logout revocation is idempotent.
- **Alternatives considered**: A new customer authentication service or a second token mechanism was rejected because it would duplicate security behavior and could weaken refresh rotation or logout revocation.
- **Verified details**: Login and registration return `usuario`, `accessToken`, and `refreshToken`. Protected backend guards verify the access token, session record, active user, and tenant ownership. Frontend currently writes the session to tenant-namespaced `sessionStorage` and restores it at app initialization.

## Decision 2: Session persistence must extend the existing storage abstraction

- **Decision**: Plan the “Mantener mi sesión iniciada” option as a change to `SessionStorageService` and the existing login/auth flow only after confirming the desired browser-lifetime semantics. Preserve the same `AuthService`, refresh interceptor, rotated refresh tokens, logout, and clear-session behavior.
- **Rationale**: Current storage is always `sessionStorage`, so browser restart persistence is not currently available. The storage abstraction is already the boundary for reads, writes, and clearing credentials.
- **Alternatives considered**: Storing a second token in an unrelated local-storage key or bypassing the refresh flow was rejected. A persistent mode may use the existing session state with an explicit storage target, but must clear both supported storage locations on logout and on refresh failure.
- **Open implementation constraint**: The plan must verify browser storage/security policy and tests before choosing `localStorage` or another already-approved mechanism. No new authentication contract is implied by the checkbox.

## Decision 3: Use the existing public catalog for service discovery

- **Decision**: Consume `GET /v1/catalog/services` and `GET /v1/catalog/services/:id` through a typed frontend catalog service, preserving pagination and filters.
- **Rationale**: The backend resolves the configured active tenant and returns local, curated services with current commercial category data, tenant-aware facets, title, description, social network, category ID, and selling price.
- **Alternatives considered**: Calling BulkFollows or exposing provider catalog data was rejected by the constitution and existing backend boundary.
- **Contract extension approved**: The existing list response now includes current `category` metadata and `facets` calculated over all eligible services for the configured tenant, independently of page pagination. Existing exact `socialNetwork` and `categoryId` filters remain internal request capabilities.
- **Customer constraint**: Angular derives platform/category choices from facets and does not expose category IDs, typed network search, hardcoded platform/category names, or title-based inference.

## Decision 4: Reuse order creation and customer order retrieval

- **Decision**: Use `GET /v1/orders`, `GET /v1/orders/:id`, and `POST /v1/orders` with the existing `CreateOrderDto`, `OrderListQueryDto`, and `Idempotency-Key` header.
- **Rationale**: The backend scopes reads by authenticated `tenantId` and `userId`, validates service eligibility, quantity bounds, money totals, balance, provider submission, and idempotency fingerprint.
- **Alternatives considered**: Client-side order persistence or direct provider calls were rejected.
- **Verified behavior**: `POST /v1/orders` accepts `serviceId`, HTTPS/HTTP target URL, and integer quantity. It can return 201, 200 for replay, or 202 for an unknown/pending provider result. The UI must not report success as fully confirmed when the response is only pending.

## Decision 5: Reuse wallet balance and movement contracts

- **Decision**: Use `GET /v1/wallet` and `GET /v1/wallet/movements` for Mi saldo and dashboard balance/activity.
- **Rationale**: Both endpoints scope through the authenticated user and tenant, return integer minor-unit amounts plus currency, and distinguish missing wallets with a not-found response.
- **Alternatives considered**: Calculating balance from orders in the frontend or displaying a configured default was rejected because it would fabricate financial information.
- **Verified behavior**: Movement responses include type, amount, balance after, description, created timestamp, and pagination. Wallet credit is admin-only and is outside this customer feature.

## Decision 6: Reuse authenticated user data from the auth response, document profile as limited

- **Decision**: Use the authenticated `usuario` object already returned by login/register/refresh context for the initial profile summary: ID, tenant ID, name, email, and role.
- **Rationale**: No customer profile/account GET controller or DTO was found. The auth response is the verified source for the fields it contains.
- **Verified gap**: There is no separate authenticated customer/account retrieval contract. Fields beyond the auth response must be unavailable, not invented. A profile endpoint is not added by this plan unless approved as a verified product requirement.

## Decision 7: Tenant support configuration is currently unavailable

- **Decision**: Do not invent a support endpoint. Use the existing tenant runtime configuration only if it is explicitly extended and approved to include support information; otherwise render the required honest unavailable state and retain existing configured public links where applicable.
- **Rationale**: The backend `Tienda` model and exposed controllers do not currently provide tenant support configuration to the authenticated customer frontend.
- **Verified gap**: No support/soporte controller, DTO, repository query, or tenant support field was found in the inspected backend surface.

## Decision 8: Keep the current Angular standalone and white-label architecture

- **Decision**: Add lazy customer child routes/components under the existing Angular application, reusing tenant config, Transloco, theme services, local icons, responsive SCSS layers, and existing public visual language.
- **Rationale**: `/cuenta` already exists as an auth-guarded standalone component and the frontend has established loading/error, localization, and theme patterns.
- **Alternatives considered**: A separate customer application, new UI framework, or duplicated tenant configuration was rejected as unnecessary architectural scope.

## Catalog taxonomy normalization

- BulkFollows `rawPayload.category` is the primary taxonomy source. The backend normalizer maps supported provider categories to canonical commercial names and does not infer a platform from a service name globally.
- The initial published platforms are Instagram, TikTok, YouTube, and Facebook. Unsupported platforms remain importable and stageable but are excluded from the public catalog until explicitly supported.
- Known `Likes+Followers` provider categories use the individual service name only to disambiguate Likes versus Followers. Unknown or ambiguous services remain pending without invented taxonomy.
- Canonical `Category` rows are resolved by normalized name during staging and reused idempotently. No Prisma schema or migration change is required.
- Existing active master services outside the supported public platform set are not rewritten automatically. `npm run catalog:reprocess-invalid` reports candidates; `npm run catalog:reprocess-invalid -- --apply` explicitly deprecates and hides those candidates while preserving provider and staging records.

## Contract verification summary

| Capability | Verified current contract | Result for plan |
|---|---|---|
| Authentication/session | `/auth/login`, `/auth/register`, `/v1/auth/refresh`, `/v1/auth/logout`; rotated refresh sessions; frontend `sessionStorage` | Reuse; plan persistence change at existing storage boundary |
| Public catalog | `GET /v1/catalog/services`, `GET /v1/catalog/services/:id` | Reuse; quantity bounds missing publicly |
| Order creation | `POST /v1/orders` + `Idempotency-Key` | Reuse; preserve 201/200/202 semantics |
| Customer order listing | `GET /v1/orders`, `GET /v1/orders/:id` | Reuse; tenant/user scoped |
| Wallet balance | `GET /v1/wallet` | Reuse |
| Wallet movements | `GET /v1/wallet/movements` | Reuse |
| Authenticated account | `usuario` from auth response only | Reuse limited fields; no profile GET found |
| Tenant resolution | `DEFAULT_TENANT_SLUG` on backend plus tenant ID in auth principal; runtime tenant config on frontend | Reuse; no new tenant resolver |
| Tenant support configuration | No verified customer-facing contract found | Honest unavailable state unless separately approved |
| Existing `/cuenta` | Auth-guarded single dashboard shell; orders/wallet links are placeholders and services is public placeholder | Extend in place with lazy child routes |
