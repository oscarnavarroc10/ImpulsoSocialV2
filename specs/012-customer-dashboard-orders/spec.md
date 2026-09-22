# Feature Specification: Customer Dashboard and Order Experience

**Feature Branch**: `012-customer-dashboard-orders`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "Create the authenticated customer dashboard and order experience for ImpulsoSocial."

## User Scenarios & Testing

### User Story 1 - Enter the customer area (Priority: P1)

After signing in with the existing email and password experience, a customer can enter `/cuenta` and see a customer area with navigation for Summary, New order, My orders, Services, Balance, Support, and profile/logout actions.

**Why this priority**: The authenticated area is the foundation for every customer task and must reuse the existing authentication lifecycle.

**Independent Test**: Sign in as a valid customer, open `/cuenta`, and verify that the protected shell and all required destinations are available. Open `/cuenta` while unauthenticated and verify that the existing authentication guard behavior is preserved.

**Acceptance Scenarios**:

1. **Given** a valid authenticated customer session, **When** the customer opens `/cuenta`, **Then** the customer dashboard is displayed with navigation for Resumen, Nueva orden, Mis órdenes, Servicios, Mi saldo, Soporte, profile, and logout.
2. **Given** no authenticated session, **When** the visitor opens `/cuenta`, **Then** the existing authentication guard redirects or responds according to the current authentication behavior without exposing customer data.
3. **Given** an authenticated customer, **When** the customer selects logout, **Then** the existing logout flow ends the session and the customer can no longer access protected customer data.
4. **Given** the dashboard is viewed at supported narrow and wide viewport sizes, **When** the customer navigates the area, **Then** navigation remains usable without overlapping or hiding required actions.

### User Story 2 - Browse real services (Priority: P1)

A customer can browse services from the existing public catalog, understand which services are available, and select a real service as the starting point for a new order.

**Why this priority**: The service catalog is the source of truth for order selection, pricing, quantity limits, and availability.

**Independent Test**: Authenticate as a customer, open Servicios, load the existing public catalog, and verify that displayed services and their commercial information come from the catalog response. Verify honest loading, empty, and unavailable states when the catalog has no usable data.

**Acceptance Scenarios**:

1. **Given** the existing catalog returns available services, **When** the customer opens Servicios, **Then** the customer sees the real service name, network/category context, description when provided, price information, quantity limits, and availability state supplied by the catalog.
2. **Given** the catalog returns no available services, **When** the customer opens Servicios, **Then** the interface shows an explicit empty state and does not fabricate services, prices, or metrics.
3. **Given** the catalog cannot be loaded, **When** the customer opens Servicios, **Then** the interface shows a friendly unavailable state and a retry action without exposing raw backend errors.
4. **Given** the customer selects an available service, **When** the customer chooses to order it, **Then** the new-order flow opens with that real service selected.

### User Story 3 - Create a new order (Priority: P1)

A customer can select a real service, provide the required target or link, enter a quantity within the service limits, see the corresponding customer price, and submit an order through the existing order capability.

**Why this priority**: Creating an order is the primary customer outcome of the authenticated area and involves money, validation, and idempotency risks.

**Independent Test**: Use a service with known quantity limits and price, enter a valid target and quantity, verify the displayed price, submit once, and verify the resulting order state from the existing order capability.

**Acceptance Scenarios**:

1. **Given** an available real service with quantity limits and a customer price, **When** the customer selects it, **Then** the form shows the service details, required target/link field, valid quantity range, and calculated customer price.
2. **Given** a selected service, **When** the customer enters an empty or malformed target/link, **Then** submission is blocked and a friendly field-level validation message is shown.
3. **Given** a selected service, **When** the customer enters a quantity below minimum, above maximum, non-numeric, or otherwise invalid, **Then** submission is blocked and the valid range is explained.
4. **Given** valid order inputs and sufficient available balance according to the existing capability, **When** the customer confirms the order, **Then** one order is created through the existing order operation and the customer sees a confirmation linked to the resulting order state.
5. **Given** an order submission is in progress, **When** the customer activates the submit action repeatedly, **Then** the interface prevents accidental duplicate submissions and does not create duplicate orders.
6. **Given** the existing order capability rejects the request, **When** the customer submits valid-looking inputs, **Then** the customer sees a friendly failure message, the raw backend response is not exposed, and the form remains recoverable.
7. **Given** the selected service becomes unavailable or its limits change before submission, **When** the customer submits, **Then** the customer is informed that the service or inputs must be reviewed and no successful order is claimed without a confirmed result.

### User Story 4 - Review customer information (Priority: P2)

A customer can view their real summary, orders, balance, and support entry points from the customer area.

**Why this priority**: Customers need trustworthy information after ordering and must be able to understand what has happened without relying on fabricated dashboard metrics.

**Independent Test**: Authenticate as customers with and without orders and balance activity, open each customer destination, and verify real data, empty states, and unavailable states separately.

**Acceptance Scenarios**:

1. **Given** real customer orders exist, **When** the customer opens Mis órdenes or Resumen, **Then** the interface shows those orders with their available statuses, timestamps, quantities, targets, and customer charges as supplied by the existing capability.
2. **Given** the customer has no orders, **When** the customer opens Mis órdenes or Resumen, **Then** the interface shows an honest empty state with a path to Nueva orden.
3. **Given** real balance or wallet information exists, **When** the customer opens Mi saldo or Resumen, **Then** the interface shows the available balance and real movements or status information supplied by the existing capability.
4. **Given** balance information is unavailable, **When** the customer opens Mi saldo, **Then** the interface shows an unavailable state and does not display a fabricated balance.
5. **Given** support information is configured for the active tenant, **When** the customer opens Soporte, **Then** the configured support options are shown. **Given** no support option is configured, **Then** the interface says support availability is not configured rather than inventing a channel.
6. **Given** the customer opens profile controls, **When** profile information is available, **Then** the customer sees their own account information only; unavailable fields remain explicitly unavailable.

### User Story 5 - Choose session persistence (Priority: P2)

During the existing login flow, a customer can optionally choose “Mantener mi sesión iniciada” so the authenticated session follows the existing security architecture and persists across browser restarts only when selected.

**Why this priority**: Customers need control over convenience versus session persistence without introducing a second authentication mechanism.

**Independent Test**: Log in once with the option selected and once without it, restart the browser context, and verify the existing session persistence behavior for each choice while preserving refresh, logout, guard, and interceptor behavior.

**Acceptance Scenarios**:

1. **Given** the login form is displayed, **When** the customer reviews the options, **Then** the optional “Mantener mi sesión iniciada” choice is present, accessible, and unselected by default unless the existing product policy specifies otherwise.
2. **Given** the customer selects the option and completes a successful login, **When** the browser context is restarted, **Then** the existing authentication architecture restores the session according to its supported persistence behavior.
3. **Given** the customer leaves the option unselected and completes a successful login, **When** the browser context is restarted, **Then** the session does not persist beyond the existing non-persistent session behavior.
4. **Given** login or registration fails, **When** the backend returns an error, **Then** the customer sees a friendly translated message without raw backend details, and the existing retry/recovery behavior remains available.

## Edge Cases

- The tenant configuration is missing, invalid, or unavailable while the customer area is loading; the existing configuration error and retry behavior remains visible.
- A customer session expires while viewing the dashboard, catalog, balance, or order form; the existing refresh, interceptor, and guard flow handles it without displaying protected data as current.
- A customer requests a service that is disabled, hidden, or no longer present in the local tenant catalog; the service cannot be ordered and the customer receives a recoverable message.
- A target/link is syntactically valid but rejected by the existing order capability; the customer sees a friendly rejection and no success state is shown.
- A quantity is at exactly the configured minimum or maximum; it is accepted when the service allows those bounds.
- A quantity is fractional, negative, zero, excessively large, or formatted with unsupported characters; it is rejected before submission.
- The calculated price is zero, unavailable, or cannot be confirmed; the customer cannot be misled into believing an order has a known charge.
- The customer has insufficient balance or the existing capability reports a financial rejection; no order success is shown and no balance is fabricated.
- The order request times out or returns an unknown result; the customer is told to verify the order state rather than being invited to retry blindly.
- The customer double-clicks or re-submits while a request is pending; duplicate order creation is prevented by the client interaction and existing idempotency safeguards.
- There are many orders or services; the interface remains navigable and uses the existing pagination or loading conventions where available.
- A tenant has no configured support links or social links; absent links are omitted or represented by an honest unavailable state.
- Google and Apple authentication are requested; they remain outside this feature and are not displayed as available login methods.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide an authenticated customer area rooted at `/cuenta` using the existing authentication session, refresh, logout, guards, and interceptors.
- **FR-002**: The customer area MUST provide navigation for Resumen, Nueva orden, Mis órdenes, Servicios, Mi saldo, Soporte, profile, and logout.
- **FR-003**: The system MUST prevent unauthenticated users from viewing customer data and MUST preserve the existing unauthorized navigation behavior.
- **FR-004**: The system MUST load services from the existing tenant-aware public catalog and MUST NOT fabricate services, prices, availability, balances, orders, activity, or metrics.
- **FR-005**: The system MUST show real service identity, network/category context, description when available, customer price, quantity limits, and availability using the existing catalog information.
- **FR-005a**: The public catalog MUST expose current commercial category `{ id, name, description }` for each service and MUST expose tenant-aware platform/category facets with service counts calculated across all eligible services, independently of the current page.
- **FR-005b**: The customer catalog MUST guide selection through platform, category, and service states using facet data; it MUST NOT request typed social-network input, display category IDs, hardcode platform/category names, or infer categories from service copy.
- **FR-006**: The system MUST provide explicit loading, empty, unavailable, and retry states for catalog, dashboard, orders, balance, and support information when those states occur.
- **FR-007**: The new-order flow MUST allow a customer to select an available real service and provide every target/link value required by the existing order capability.
- **FR-008**: The new-order flow MUST validate target/link presence and format, quantity type, and quantity bounds before submission, using the selected service's real limits.
- **FR-009**: The new-order flow MUST display the corresponding customer price from the existing product/order capability and MUST avoid representing an unknown or unconfirmed price as final.
- **FR-010**: The system MUST submit valid orders through the existing order capability and MUST show success only after a confirmed result identifies the created order or equivalent confirmed state.
- **FR-011**: The system MUST prevent accidental duplicate submissions and MUST preserve existing idempotency protections for operations that can create an order or charge balance.
- **FR-012**: The system MUST provide friendly translated customer-facing messages for authentication, registration, catalog, balance, and order failures without exposing raw backend errors, provider payloads, credentials, or internal details.
- **FR-013**: The summary, orders, and balance views MUST show only real information belonging to the authenticated customer and active tenant.
- **FR-014**: The orders view MUST represent real order status and must not infer success from an incomplete, unknown, or unavailable provider response.
- **FR-015**: The balance view MUST distinguish unavailable information from a zero balance and MUST not calculate or display financial values using fabricated data.
- **FR-016**: The support view MUST use configured tenant support information and MUST show an honest unavailable state when no support option exists.
- **FR-017**: The login experience MUST include an optional, accessible “Mantener mi sesión iniciada” choice, unselected by default, and MUST map the choice onto the existing authentication persistence mechanism without creating a parallel authentication system.
- **FR-018**: Session persistence selection MUST preserve the existing session refresh, logout, guard, interceptor, registration, and failure-message behavior.
- **FR-019**: The customer area MUST preserve white-label tenant configuration, theme preferences, localization, translations, responsive behavior, and the existing visual language.
- **FR-020**: The feature MUST exclude Google authentication, Apple authentication, provider administration, and creation of new backend contracts when an equivalent existing capability is available.
- **FR-021**: All customer-facing data requests MUST respect the active tenant context and authenticated customer ownership; no view may mix data across tenants or customers.
- **FR-022**: The feature MUST preserve accessibility for keyboard navigation, focus visibility, semantic labels, form errors, loading announcements, and responsive layouts across supported locales.

### Key Entities

- **Customer account**: The authenticated customer identity and profile information available from the existing authentication/account capability.
- **Customer dashboard**: The authenticated area containing summary, navigation, recent information, and links to customer workflows.
- **Catalog service**: A tenant-curated service with network/category context, commercial price, quantity limits, availability, and any description exposed by the existing catalog capability.
- **Order request**: The customer's selected service, target/link, quantity, calculated customer price, and submission state.
- **Customer order**: A confirmed or tracked order belonging to the authenticated customer, including its available status, target, quantity, charge, and timestamps.
- **Wallet balance and movement**: The customer's available financial balance and real balance movements exposed by the existing wallet capability.
- **Tenant support configuration**: The active tenant's configured support channels and localized support information.
- **Session persistence preference**: The customer's login choice controlling whether the existing authenticated session may persist across browser restarts.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At least 95% of authenticated test users can reach `/cuenta` and identify all seven required customer destinations without assistance.
- **SC-002**: At least 95% of authenticated test users can select a real service, complete valid target and quantity fields, confirm the displayed customer price, and submit one order successfully when the existing capabilities return a valid response.
- **SC-003**: 100% of tested invalid target/link and out-of-range quantity cases are blocked before an order submission is sent.
- **SC-004**: 100% of tested dashboard, order, balance, and support empty/unavailable cases display an explicit honest state without fabricated data.
- **SC-005**: 100% of tested repeated-submit scenarios create at most one order for a single customer confirmation.
- **SC-006**: 100% of tested authentication and registration failures display a friendly localized message without raw backend error details.
- **SC-007**: In usability testing, at least 90% of customers can find their current orders and balance within 30 seconds from the dashboard.
- **SC-008**: The customer area remains usable at 320px, 768px, and 1440px viewport widths and at 200% browser zoom without overlapping required controls.
- **SC-009**: Session persistence behavior matches the customer's selected preference in 100% of tested browser-restart scenarios while existing refresh and logout behavior remains functional.
- **SC-010**: No customer or tenant data isolation test exposes another customer's or tenant's services, orders, balance, profile, or support configuration.

## Assumptions

- Existing email/password login, registration, session refresh, logout, route guards, request interceptors, public catalog, wallet, and order capabilities are the source of truth and will be reused.
- During planning, the existing backend contracts MUST be inspected and verified for public catalog, order creation, customer order retrieval/listing, wallet/balance retrieval, wallet movements/history, authenticated customer/account information, and tenant support configuration.
- Planning MUST identify explicitly any gap where a verified backend capability does not expose data required by a dashboard section; the plan MUST NOT invent an endpoint or assume that capability exists. Any backend capability addition must be justified by verified product requirements and documented separately from reuse of existing contracts.
- When verified contracts do not expose data required by a dashboard section, the feature MUST use an honest empty or unavailable state unless the verified product requirements explicitly require adding the missing backend capability.
- The active tenant is determined by the existing white-label configuration and tenant context; this feature does not change tenant resolution.
- The authenticated customer has stable network access during normal use, but loading, timeout, and unavailable states are required.
- Customer prices, quantity limits, balance deductions, order status, and financial outcomes are authoritative only when confirmed by existing backend capabilities.
- Existing session persistence policy and secure storage mechanism determine how “Mantener mi sesión iniciada” is implemented; this specification does not authorize a new persistence mechanism.
- Responsive web use, Spanish (`es-MX`) and English localization, light/dark themes, and keyboard accessibility remain in scope because they are established product requirements.
- Google and Apple authentication are explicitly out of scope for this feature.
- Provider-specific data and credentials remain backend-only and are never exposed to the frontend or customer.
