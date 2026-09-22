# Tasks: Customer Dashboard and Order Experience

**Input**: Design documents from `/specs/012-customer-dashboard-orders/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/customer-api.md`, `quickstart.md`

**Tests**: Included because the specification requires focused contract, integration, component, security, and regression coverage.

## Phase 1: Setup

**Purpose**: Establish feature-specific source and test locations without introducing new dependencies or changing unrelated modules.

- [X] T001 Create the customer feature API/service directories under `frontend/src/app/core/customer/` and the lazy feature directories under `frontend/src/app/features/account/` according to `specs/012-customer-dashboard-orders/plan.md`.
- [X] T002 [P] Add the customer dashboard/order translation namespaces and matching `es-MX`/`en` keys in `frontend/public/i18n/es-MX.json` and `frontend/public/i18n/en.json` without adding placeholder business data.
- [X] T003 [P] Add feature test fixtures and shared resource-state types in `frontend/src/app/core/customer/` using the states defined in `specs/012-customer-dashboard-orders/data-model.md`.

## Phase 2: Foundational

**Purpose**: Verify and protect the shared contracts and security boundaries required by every user story.

- [X] T004 [P] Add a backend contract test inventory for authentication, catalog, orders, wallet, tenant scoping, and error responses in `backend/test/contract/customer-dashboard/customer-contracts.e2e-spec.ts` using the routes documented in `specs/012-customer-dashboard-orders/contracts/customer-api.md`.
- [X] T005 [P] Add frontend HTTP contract models and parsing tests for catalog, order, wallet, pagination, and stable customer error categories in `frontend/src/app/core/customer/customer.models.spec.ts` and `frontend/src/app/core/customer/customer.models.ts`.
- [X] T006 [P] Verify the existing auth guard/interceptor/session-refresh behavior with customer route and expired-session tests in `frontend/src/app/core/auth/auth.guard.spec.ts`, `frontend/src/app/core/auth/auth.interceptor.spec.ts`, and `frontend/src/app/core/auth/session-storage.service.spec.ts`; preserve existing behavior while adding coverage for `/cuenta` return URLs.
- [X] T007 Document the verified session-storage threat model, browser-lifetime semantics, refresh-token rotation, logout revocation, clear-session behavior, and persistence decision gate in `specs/012-customer-dashboard-orders/session-persistence-decision.md` before changing `frontend/src/app/core/auth/session-storage.service.ts`.
- [X] T008 [P] Add tenant/user isolation regression tests for authenticated order and wallet reads in `backend/test/contract/orders/customer-ownership.e2e-spec.ts` and `backend/test/contract/wallets/customer-ownership.e2e-spec.ts`, confirming a customer cannot read another customer or tenant.
- [X] T009 [P] Add backend customer-facing error mapping tests in `backend/test/contract/auth/customer-error-contracts.e2e-spec.ts`, `backend/test/contract/orders/customer-error-contracts.e2e-spec.ts`, and `backend/test/contract/wallets/customer-error-contracts.e2e-spec.ts` to ensure raw provider/internal details are not exposed.

**Checkpoint**: Existing auth, tenant scope, API shapes, error mapping, and the session-persistence security decision are verified before customer screens are implemented.

## Phase 3: User Story 1 - Enter the Customer Area (Priority: P1) 🎯 MVP

**Goal**: Replace the placeholder `/cuenta` shell with authenticated navigation and real-data-ready dashboard composition while preserving the existing guard, logout, white-label, locale, theme, and responsive architecture.

**Independent Test**: Authenticate, open `/cuenta`, navigate to all required customer destinations, verify profile/logout controls, test unauthenticated redirect, and confirm no fabricated metrics or customer data are displayed.

### Tests for User Story 1

- [X] T010 [P] [US1] Add route tests for guarded `/cuenta` child routes, safe login return URLs, and logout navigation in `frontend/src/app/app.routes.spec.ts`.
- [X] T011 [P] [US1] Add dashboard shell component tests for required navigation labels, authenticated customer identity, logout action, loading/unavailable resource states, keyboard focus, and responsive semantics in `frontend/src/app/features/account/account-dashboard.component.spec.ts`.

### Implementation for User Story 1

- [X] T012 [US1] Replace placeholder navigation and future-only cards in `frontend/src/app/features/account/account-dashboard.component.html` with links for Resumen, Nueva orden, Mis órdenes, Servicios, Mi saldo, Soporte, profile summary, and logout, using only translated labels and honest unavailable states.
- [X] T013 [US1] Refactor `frontend/src/app/features/account/account-dashboard.component.ts` to compose child customer resources without creating duplicate authentication or tenant-resolution logic.
- [X] T014 [US1] Add lazy authenticated child routes for `/cuenta`, `/cuenta/nueva-orden`, `/cuenta/ordenes`, `/cuenta/servicios`, `/cuenta/saldo`, and `/cuenta/soporte` in `frontend/src/app/app.routes.ts`, preserving `authGuard` and existing public routes.
- [X] T015 [US1] Add the authenticated customer layout/navigation styles and responsive states in the repository's existing global account styles (`frontend/src/styles/_pages.scss` and `frontend/src/styles/_responsive.scss`) without changing the established white-label token architecture.
- [X] T016 [US1] Add friendly translated customer-area error, empty, unavailable, navigation, and logout labels in `frontend/public/i18n/es-MX.json` and `frontend/public/i18n/en.json` with identical recursive structure.

**Checkpoint**: The authenticated customer shell is independently navigable and safe, even while domain data screens remain unavailable or empty.

## Phase 4: User Story 2 - Browse Real Services (Priority: P1)

**Goal**: Expose authoritative quantity limits through the existing public catalog capability, then render real tenant-curated services in the customer area.

**Independent Test**: Call the catalog endpoint and verify title, description, network, category, price, availability, min quantity, max quantity, pagination, tenant scoping, and honest empty/unavailable UI states.

### Tests for User Story 2

- [X] T017 [P] [US2] Add backend catalog contract tests for `minQuantity` and `maxQuantity` in `backend/test/contract/catalog/public-catalog-quantity-bounds.e2e-spec.ts`, including valid provider-configured bounds, missing/invalid provider bounds, pagination, and tenant visibility.
- [X] T018 [P] [US2] Add backend public catalog service/repository tests in `backend/src/modules/catalog/application/public-catalog.service.spec.ts` and `backend/src/modules/catalog/infrastructure/public-catalog.repository.spec.ts` proving the new fields come from authoritative service/order configuration and are never hardcoded.
- [X] T019 [P] [US2] Add frontend catalog API/component tests in `frontend/src/app/core/customer/catalog-api.service.spec.ts` and `frontend/src/app/features/account/customer-services.component.spec.ts` for loading, ready, empty, unavailable, retry, filters, pagination, and exact server-provided quantity bounds.

### Implementation for User Story 2

- [X] T020 [US2] Extend the existing public catalog response DTO and Swagger metadata in `backend/src/modules/catalog/application/dto/public-catalog.dto.ts` with authoritative customer-facing `minQuantity` and `maxQuantity` response fields sourced from existing backend configuration; document their integer shape without adding request-validation behavior to the response DTO, because final quantity validation remains authoritative in existing order creation.
- [X] T021 [US2] Update `backend/src/modules/catalog/infrastructure/public-catalog.repository.ts` and `backend/src/modules/catalog/application/public-catalog.service.ts` to map quantity limits from the existing approved service/order configuration, returning an explicit unavailable/null contract when authoritative limits cannot be verified rather than duplicating or hardcoding values.
- [X] T022 [US2] Add catalog contract coverage and update `specs/012-customer-dashboard-orders/contracts/customer-api.md` with authoritative quantity bounds, current commercial category metadata, and tenant-aware facets independent of page pagination.
- [X] T023 [US2] Implement the typed catalog client in `frontend/src/app/core/customer/catalog-api.service.ts` for `GET /v1/catalog/services` and `GET /v1/catalog/services/:id`, reusing `TenantConfigService`, `authInterceptor`, existing pagination, and translated error normalization.
- [X] T024 [US2] Implement the real customer services screen in `frontend/src/app/features/account/customer-services.component.ts` and `frontend/src/app/features/account/customer-services.component.html` with facet-driven platform-to-category-to-service navigation, no technical search inputs, server-backed prices/category/min-max/availability, pagination, and honest empty/unavailable/retry states.
- [X] T025 [US2] Add service-card/order navigation styling in `frontend/src/styles/_pages.scss` and `frontend/src/styles/_components.scss` while preserving local SVG icons, theme tokens, keyboard focus, and 200% zoom behavior.
- [X] T025a [US2] Add focused catalog coverage for commercial category data, tenant-aware facets, service counts outside the current page, hidden/disabled service exclusion, internal platform/category filters, and platform-to-category-to-service navigation without starting T026+.

**Checkpoint**: Public catalog contract work is complete before the new-order form consumes quantity limits; Angular never hardcodes or derives min/max values.

## Phase 5: User Story 3 - Create a New Order (Priority: P1)

**Goal**: Let an authenticated customer select a real catalog service, validate target and authoritative quantity bounds, see the server-backed price, and submit one idempotent order with correct pending/error semantics.

**Independent Test**: Select a catalog service, enter a valid URL and quantity between server-provided bounds, submit once with an idempotency key, and verify created/replayed/pending/rejected states without duplicate orders.

### Tests for User Story 3

- [ ] T026 [P] [US3] Add typed order API tests for `GET /v1/orders`, `GET /v1/orders/:id`, and `POST /v1/orders` in `frontend/src/app/core/customer/orders-api.service.spec.ts`, including `Idempotency-Key`, 201, 200 replay, 202 pending, validation, insufficient balance, conflict, and provider-unavailable mappings.
- [ ] T027 [P] [US3] Add new-order form tests in `frontend/src/app/features/account/customer-new-order.component.spec.ts` for service selection, required/URL target validation, integer quantity bounds, server price display, disabled repeated submit, friendly errors, and recovery.
- [ ] T028 [P] [US3] Add backend idempotency/ownership regression coverage in `backend/test/contract/orders/customer-order-idempotency.e2e-spec.ts` for same-key replay, conflicting fingerprint, concurrent submission, 202 unknown result, and tenant/user isolation.

### Implementation for User Story 3

- [X] T029 [US3] Implement the typed order client in `frontend/src/app/core/customer/orders-api.service.ts` using the existing DTO shapes, authenticated interceptor, required `Idempotency-Key`, and no blind retry after unknown results.
- [X] T030 [US3] Implement the new-order reactive form in `frontend/src/app/features/account/customer-new-order.component.ts` and `frontend/src/app/features/account/customer-new-order.component.html` using the selected catalog service's server-provided min/max, target URL validation matching `CreateOrderDto`, integer quantity validation, and server-backed currency/price presentation.
- [X] T031 [US3] Implement order submission state handling in `frontend/src/app/features/account/customer-new-order.component.ts` for generated valid idempotency keys, duplicate-submit prevention, 201/200 confirmation, 202 pending/unconfirmed messaging, recoverable failures, and navigation to the resulting order without claiming unsupported success.
- [X] T032 [US3] Add translated order validation, insufficient-balance, conflict, pending, unavailable, and generic failure messages in `frontend/public/i18n/es-MX.json` and `frontend/public/i18n/en.json` without exposing backend/provider details.
- [X] T033 [US3] Add new-order layout and accessible form/error styling in `frontend/src/styles/_pages.scss`, `frontend/src/styles/_components.scss`, and `frontend/src/styles/_responsive.scss`.

**Checkpoint**: Customers can create or safely recover from a real order using authoritative catalog limits and existing backend idempotency.

## Phase 6: User Story 4 - Review Customer Information (Priority: P2)

**Goal**: Show real customer orders, balance, wallet movements, authenticated identity, and honest support/profile gaps from the existing capabilities.

**Independent Test**: Test customers with orders, no orders, wallet data, missing wallet, movements, and no support/profile capability; verify only real scoped data appears.

### Tests for User Story 4

- [X] T034 [P] [US4] Add orders list/detail component tests in `frontend/src/app/features/account/customer-orders.component.spec.ts` for real rows, empty state, unavailable/retry state, pagination, status display, and 202/pending order status.
- [X] T035 [P] [US4] Add wallet balance/movement component tests in `frontend/src/app/features/account/customer-wallet.component.spec.ts` for real integer amount/currency, zero versus missing wallet, empty movements, pagination, unavailable state, and translated errors.
- [X] T036 [P] [US4] Add profile/support component tests in `frontend/src/app/features/account/customer-support.component.spec.ts` and `frontend/src/app/features/account/customer-profile.component.spec.ts` proving profile uses only auth identity fields and support renders not-configured/unavailable without calling an invented endpoint.

### Implementation for User Story 4

- [X] T037 [US4] Implement typed order listing/detail resources in `frontend/src/app/features/account/customer-orders.component.ts` and `frontend/src/app/features/account/customer-orders.component.html` using the existing `/v1/orders` contracts, pagination, status values, ownership-safe errors, and honest empty state.
- [X] T038 [US4] Implement the typed wallet client in `frontend/src/app/core/customer/wallet-api.service.ts` for `/v1/wallet` and `/v1/wallet/movements`, preserving integer minor units and server currencies.
- [X] T039 [US4] Implement balance and movements screens in `frontend/src/app/features/account/customer-wallet.component.ts` and `frontend/src/app/features/account/customer-wallet.component.html`, distinguishing zero from unavailable and never deriving balance from fabricated dashboard data.
- [ ] T040 [US4] Implement the summary screen in `frontend/src/app/features/account/customer-summary.component.ts` and `frontend/src/app/features/account/customer-summary.component.html` by composing real order/wallet resources and explicit loading/empty/unavailable states rather than invented activity or metrics.
- [X] T041 [US4] Implement the profile summary in `frontend/src/app/features/account/customer-profile.component.ts` and `frontend/src/app/features/account/customer-profile.component.html` using only `AuthService.user()` fields; label unsupported fields unavailable and do not add a profile endpoint.
- [ ] T042 [US4] Implement the support screen in `frontend/src/app/features/account/customer-support.component.ts` and `frontend/src/app/features/account/customer-support.component.html` as a verified-configured view only when existing tenant config supplies support data, otherwise show not-configured/unavailable without a new backend capability.
- [X] T043 [US4] Add translated summary, orders, wallet, profile, support, movement-type, status, empty, unavailable, and retry strings in `frontend/public/i18n/es-MX.json` and `frontend/public/i18n/en.json` with recursive parity.
- [X] T044 [US4] Add dashboard information architecture and responsive/accessibility styles in `frontend/src/styles/_pages.scss`, `frontend/src/styles/_layout.scss`, and `frontend/src/styles/_responsive.scss`.

**Checkpoint**: Customer information screens show only authenticated tenant/user data, with no fabricated profile, support, balance, orders, activity, or metrics.

## Phase 7: User Story 5 - Choose Session Persistence (Priority: P2)

**Goal**: Add the optional “Mantener mi sesión iniciada” choice only if the explicit security/design task proves it can be implemented without weakening the existing auth architecture.

**Independent Test**: Verify unchecked and checked login behavior across browser restart, refresh rotation, logout, refresh failure, guard redirects, and interceptor recovery; if the security decision is blocked, verify the secure current behavior remains unchanged and the requirement is documented as blocked.

### Tests for User Story 5

- [ ] T045 [P] [US5] Add login-form tests in `frontend/src/app/features/auth/auth-page.component.spec.ts` for the accessible unchecked-by-default persistence choice, request mapping, translated failures, and no Google/Apple authentication exposure.

### Security/design gate and implementation

- [ ] T046 [US5] Review and approve `specs/012-customer-dashboard-orders/session-persistence-decision.md` against the existing refresh-token rotation, revocation, logout, storage, and threat-model behavior; record whether safe persistence is supported, blocked, or requires a separately approved authentication change before any persistence-specific test or implementation.
- [ ] T047 [P] [US5] If T046 approves a safe existing-architecture strategy, add storage/auth security tests in `frontend/src/app/core/auth/session-storage.service.spec.ts` and `frontend/src/app/core/auth/auth.service.spec.ts` for selected/unselected storage behavior, tenant namespacing, refresh rotation, clear-session, logout, refresh failure, and storage unavailability.
- [ ] T048 [P] [US5] If T046 approves a safe existing-architecture strategy, add browser-context/session regression coverage in `frontend/src/app/core/auth/session-persistence.e2e.spec.ts` or the repository's established browser test location for restart semantics, guard behavior, and interceptor refresh recovery.
- [ ] T049 [US5] If T046 approves a safe existing-architecture strategy, implement the explicit persistence preference through `frontend/src/app/core/auth/session-storage.service.ts`, `frontend/src/app/core/auth/auth.service.ts`, `frontend/src/app/features/auth/auth-page.component.ts`, and `frontend/src/app/features/auth/auth-page.component.html`; otherwise document the blocked requirement in `specs/012-customer-dashboard-orders/session-persistence-decision.md`, add a regression assertion in `frontend/src/app/core/auth/session-storage.service.spec.ts` or `frontend/src/app/core/auth/auth.service.spec.ts` that current `sessionStorage` behavior remains unchanged, and create no persistence mechanism.
- [ ] T050 [US5] Add translated “Mantener mi sesión iniciada” labels, security explanation, and blocked/unavailable messaging in `frontend/public/i18n/es-MX.json` and `frontend/public/i18n/en.json` without exposing token/storage internals.

**Checkpoint**: Session persistence is either safely implemented through the existing architecture or explicitly blocked without weakening authentication security.

## Phase 8: Polish and Cross-Cutting Validation

- [ ] T051 [P] Add final frontend regression coverage for route navigation, translation parity, tenant theme/locale, responsive states, keyboard focus, and no fabricated data in `frontend/src/app/features/account/` and `frontend/src/app/core/customer/` tests.
- [ ] T052 [P] Add backend regression coverage for catalog quantity bounds, tenant/user isolation, order idempotency, wallet ownership, and stable error contracts in `backend/test/contract/` and `backend/test/integration/`.
- [ ] T053 [P] Update `specs/012-customer-dashboard-orders/research.md`, `data-model.md`, `contracts/customer-api.md`, and `quickstart.md` with any approved catalog contract or blocked session-persistence outcome; do not document unverified capabilities as available.
- [ ] T054 Run the frontend test suite and production build from `frontend` with `npm test -- --watch=false` and `npm run build`, then resolve only feature-related failures.
- [ ] T055 Run backend contract/unit/integration tests from `backend` using the repository's package scripts and verify tenant, order, wallet, and auth regressions.
- [ ] T056 Run the manual scenarios in `specs/012-customer-dashboard-orders/quickstart.md` at 320x568, 768x1024, 1440x900, 200% zoom, `es-MX`/`en`, and light/dark themes; record unavailable states and any blocked persistence decision.
- [ ] T057 Run `git diff --check`, inspect `git status --short`, and verify no Google/Apple flow, provider call, fabricated customer data, unapproved endpoint, or hardcoded quantity limit was added.

## Taxonomy normalization extension

- [X] T058 Add deterministic BulkFollows taxonomy normalization from `rawPayload.category`, including constrained ambiguous `Likes+Followers` name disambiguation and unsupported-platform handling.
- [X] T059 Integrate normalized platform/category proposals into import staging with idempotent canonical `Category` reuse while preserving raw provider payloads.
- [X] T060 Extend curated platform validation to YouTube and restrict public catalog publication to normalized MVP platforms without deleting unsupported provider records.
- [X] T061 Add focused normalization, staging, curation, public-facet, and idempotency tests plus an explicit dry-run/apply historical cleanup command for invalid active master services.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; creates only feature scaffolding and translation/test foundations.
- **Phase 2 Foundational**: Depends on Setup; blocks all user stories because it verifies contracts, isolation, error mapping, and session security.
- **Phase 3 US1**: Depends on Foundational; provides the authenticated customer shell and is the MVP.
- **Phase 4 US2**: Depends on Foundational; its backend catalog quantity-limit tasks T017-T022 must complete before US3 form tasks T026-T033.
- **Phase 5 US3**: Depends on US2 catalog contract and frontend catalog models; reuses existing order creation/idempotency.
- **Phase 6 US4**: Depends on Foundational and can proceed in parallel with US2/US3 after shared customer API models exist.
- **Phase 7 US5**: Depends on Foundational and the explicit security decision T046; persistence-specific tests and implementation are conditional on T046 approval, while a blocked decision preserves current `sessionStorage` behavior.
- **Phase 8 Polish**: Depends on all selected user stories and any approved gap decision.

### User Story Dependencies

- **US1 (P1)**: Foundational only; MVP shell is independently testable.
- **US2 (P1)**: Foundational only; catalog screen is independently testable. Its quantity-bound backend contract must precede US3.
- **US3 (P1)**: Depends on US2's authoritative quantity-bound contract and catalog client.
- **US4 (P2)**: Foundational plus customer API models; orders/wallet reuse existing contracts and profile/support remain honest gaps.
- **US5 (P2)**: Foundational plus security/design decision T046; only the login UI test is unconditional, and no persistence-specific test or implementation proceeds if the strategy is unsafe.

### Parallel Opportunities

- T002, T003, T004, T005, T006, T008, and T009 can run in parallel after setup because they touch separate files/surfaces.
- T017, T018, and T019 can run in parallel as tests/specification work for the catalog slice.
- T034, T035, and T036 can run in parallel after shared customer models are available.
- US1 shell work, US2 catalog contract work, US4 wallet/order information work, and US5 security analysis can be staffed in parallel after Foundational, with US3 held behind US2's contract completion.
- T051, T052, and T053 can run in parallel before final runtime validation.

## Parallel Example: Catalog before New Order

```text
# Parallel contract tests and frontend contract tests
T017: backend/test/contract/catalog/public-catalog-quantity-bounds.e2e-spec.ts
T018: backend/src/modules/catalog/application/public-catalog.service.spec.ts
T019: frontend/src/app/core/customer/catalog-api.service.spec.ts

# Then sequential implementation
T020-T022: expose and document authoritative quantity bounds
T023-T025: consume and render the catalog contract
T026-T033: implement the order form only after T020-T025 pass
```

## Parallel Example: Customer Information

```text
# These can proceed independently once foundational models exist
T034-T037: orders screens and tests
T035, T038-T039: wallet screens and tests
T036, T041-T042: profile/support honest states and tests
T040, T043-T044: summary composition and shared presentation
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup and Phase 2 Foundational.
2. Complete Phase 3 US1 authenticated customer shell.
3. Validate guarded navigation, logout, translations, themes, responsive behavior, and no fabricated data.
4. Deliver US1 as the smallest demonstrable customer-area increment.

### Incremental Delivery

1. Add US2 with the minimal authoritative catalog quantity-bound contract.
2. Add US3 new-order flow only after the catalog contract is available and tested.
3. Add US4 real orders/wallet information with honest profile/support states.
4. Resolve US5 through the security decision; implement only if safe, otherwise document blocked persistence.
5. Run Phase 8 regression and manual validation.

### Notes

- Every task starts with `- [ ]`, has a sequential ID, and includes a concrete repository file path.
- `[P]` marks only tasks that can proceed independently without incomplete dependencies.
- `[US#]` labels appear on user-story tasks only.
- No task authorizes direct provider access, fabricated data, a profile endpoint, a tenant-support endpoint, or hardcoded quantity limits.
