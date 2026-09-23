# Feature Specification: SMMGEN Provider Integration

**Feature Branch**: `014-smmgen-provider-integration`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "SMMGEN Provider Integration"

**Implementation boundary**: This specification authorizes design and planning only. It does not authorize live SMMGEN calls, credential use, provider spending, code changes outside this feature, changes to Feature 013 implementation or migration, frontend redesign, or production-data mutation.

## Problem Statement

ImpulsoSocialV2 has the provider-agnostic service capability foundation defined by Feature 013. The platform now needs a future-ready specification for adding SMMGEN as a provider without weakening the stable `MasterService` catalog identity, explicit offering selection, tenant isolation, order integrity, or provider privacy. SMMGEN-specific service types, action fields, identifiers, credentials, and responses must remain behind the provider boundary.

The integration must support only verified, explicitly normalized capabilities. Unknown or contradictory SMMGEN types must fail closed. Customers select a local MasterService and provider-neutral inputs; administrators explicitly curate and select an available SMMGEN offering. Existing orders remain bound to the provider offering selected when they were accepted.

## Scope And Constraints

- Feature 013 provider-agnostic architecture is authoritative: `MasterService` is the stable commercial identity; SMMGEN is an offering/provider implementation.
- No live SMMGEN HTTP calls, real orders, balance changes, credentials, provider-side mutations, or production synchronization are permitted during specification, planning, testing, or implementation of this feature.
- Provider credentials remain backend-only, are not committed, logged, returned, or sent to the frontend, and must retain TLS verification.
- Provider selection is explicit and manual. There is no automatic ranking, retry, failover, substitution, or silent provider switching.
- New orders use an explicitly selected available offering; existing orders use their immutable historical provider/offering binding.
- Customers and tenant administrators do not see provider names, external IDs, costs, raw payloads, credentials, or routing configuration.
- SMMGEN capability types must be normalized from structured provider metadata, never inferred from titles or descriptions.
- `STANDARD` is the executable SMMGEN capability in Feature 014. `CUSTOM_COMMENTS` is recognized and normalized but remains fail-closed and non-purchasable.
- `CUSTOM_COMMENTS` quantity, pricing basis, comment-count semantics, bounds, newline normalization, blank-line handling, trimming, duplicate policy, limits, and exact SMMGEN field mapping are intentionally deferred to a future approved decision. No implementation may guess these rules, and this deferral does not block Feature 014 planning or Standard implementation.

## Clarifications

### Session 2026-09-23

- Q: What SMMGEN capability is executable in Feature 014? -> A: `Default` maps to provider-neutral `STANDARD`; Standard synchronization, explicit offering selection, dispatch, result normalization, historical binding, status, and availability reconciliation are in scope.
- Q: What is the Feature 014 behavior for SMMGEN `Custom Comments`? -> A: Normalize it as `CUSTOM_COMMENTS`, but keep it fail-closed and non-purchasable; quantity, pricing, bounds, normalization, and request-field semantics are intentionally deferred.
- Q: What source determines SMMGEN capability mapping? -> A: The structured SMMGEN service `type` field is authoritative; `Default` maps to `STANDARD`, `Custom Comments` maps to `CUSTOM_COMMENTS`, and every other or malformed type is unsupported.
- Q: How are SMMGEN credentials configured? -> A: Backend environment variables `SMMGEN_API_URL` and `SMMGEN_API_KEY`; no database storage, credential UI, tenant-specific credentials, or encryption redesign.
- Q: What provider access is allowed during Feature 014 work? -> A: Fixtures, mocks, fakes, and recorded sanitized responses only; no live synchronization, orders, balance calls, credential verification, or provider mutations.
- Q: How is provider selection performed? -> A: Platform-global explicit selection through `MasterServiceProviderOffering`; no tenant routing, failover, ranking, health routing, random selection, or silent substitution.
- Q: How are SMMGEN services associated with MasterServices? -> A: Through explicit curation only; no automatic cross-provider merge by title, category, rate, bounds, network, or similarity.
- Q: What historical binding is authoritative? -> A: Feature 013 historical binding; new SMMGEN orders snapshot the selected offering/provider data, and later selection changes affect new orders only.
- Q: Is SMMGEN status retrieval in scope? -> A: Yes; normalize the verified `action=status` response through the existing provider-neutral lifecycle, and fail safely for unknown status values rather than treating them as completion.
- Q: Are refill and cancellation customer features in scope? -> A: No; preserve an existing provider-neutral compatibility contract only if required, without adding customer APIs or UI.
- Q: Is SMMGEN balance exposed or required? -> A: No; balance is provider-private operational data and no live balance call is authorized.
- Q: When may availability reconciliation disable offerings? -> A: Only after a verified successful complete services snapshot; failed, malformed, partial, timed-out, or uncertain synchronization must not mass-disable offerings.
- Q: How does SMMGEN `rate` affect pricing? -> A: It remains private provider-cost metadata and never replaces MasterService, TenantServiceOverride, or existing customer pricing.
- Q: Does provider identity change Standard idempotency? -> A: No; preserve the established Standard customer fingerprint and semantics.
- Q: May Feature 014 modify the Feature 013 migration? -> A: No; the Feature 013 migration remains unchanged, and any genuine schema need requires a separate additive Feature 014 migration justified during planning.
- Q: Are Favorites implemented? -> A: No; preserve the MasterService-only compatibility rule without implementing Favorites.
- Q: What provider data may customer contracts expose? -> A: Only provider-neutral catalog/order data; never SMMGEN identity, IDs, rates, raw payloads, credentials, external order IDs, routing state, or private snapshots.
- Q: Which architecture must SMMGEN use? -> A: Reuse Feature 013 synchronization, offering, historical-binding, and provider-neutral adapter abstractions; do not create a parallel order pipeline.
- Q: What BulkFollows behavior must remain unchanged? -> A: Existing BulkFollows ordering, pricing, wallet/refund, idempotency, privacy, and fail-closed semantics remain compatible; BulkFollows Custom Comments does not become executable through this feature.
- Q: Is Feature 014 ready for planning after these decisions? -> A: Yes; Standard SMMGEN integration is the executable MVP, while Custom Comments execution semantics are intentionally deferred and do not block planning.

## User Scenarios & Testing

### User Story 1 - Curate SMMGEN Offerings (Priority: P1)

As a platform administrator, I can import and explicitly map verified SMMGEN services to local MasterServices without changing local commercial identity.

**Why this priority**: The integration is unsafe unless provider data is controlled by the local catalog and explicit curation.

**Independent Test**: Use recorded SMMGEN-shaped fixtures and fake provider boundaries only; verify normalized offering facts, explicit mapping, and unchanged MasterService identity.

**Acceptance Scenarios**:

1. **Given** a structured SMMGEN service with a supported verified type, **When** it is normalized, **Then** it becomes a private provider offering with a provider-neutral capability and does not overwrite curated MasterService title, description, category, visibility, or tenant price.
2. **Given** an administrator maps a SMMGEN service to a MasterService, **When** the mapping is saved, **Then** the association is explicit, auditable, and can coexist with other provider offerings for the same MasterService.

### User Story 2 - Publish Only Eligible Services (Priority: P1)

As a customer, I can see an eligible local service without being exposed to SMMGEN infrastructure or unsupported actions.

**Why this priority**: Customer catalog privacy and honest availability are core product and security requirements.

**Independent Test**: Serialize public catalog fixtures containing SMMGEN metadata and unsupported offerings; verify only the normalized commercial projection is exposed.

**Acceptance Scenarios**:

3. **Given** an active MasterService, tenant access, and an available selected SMMGEN offering, **When** the customer requests the catalog, **Then** the response exposes only local identity, commercial data, capability projection, and allowed bounds.
4. **Given** an offering is unsupported, unavailable, disabled, or missing from the selected configuration, **When** the customer requests or starts an order, **Then** the service is non-orderable and no alternate provider is silently selected.

### User Story 3 - Submit a Standard Order (Priority: P1)

As a customer, I can submit a `STANDARD` order using a target and quantity without knowing that SMMGEN fulfills it.

**Why this priority**: Standard ordering is the first executable SMMGEN capability and must preserve current order and wallet behavior.

**Independent Test**: Submit a valid fixture order through a fake SMMGEN adapter and inspect the normalized request, wallet result, order state, and private binding without making an HTTP call.

**Acceptance Scenarios**:

5. **Given** a valid selected SMMGEN Standard offering and an eligible tenant, **When** the customer submits a valid target and quantity within normalized bounds, **Then** one provider-neutral order is dispatched to the SMMGEN adapter and the customer sees no provider-specific fields.
6. **Given** a Standard target is missing, malformed, or outside quantity bounds, **When** the customer submits, **Then** validation fails before wallet debit, order creation, or provider dispatch.

### User Story 4 - Handle Custom Comments Safely (Priority: P1)

As a customer, I cannot purchase SMMGEN Custom Comments in Feature 014 because its quantity and pricing contract remains intentionally deferred.

**Why this priority**: Incorrect quantity or pricing semantics could cause incorrect charges or provider orders.

**Independent Test**: Run fixtures for SMMGEN Custom Comments normalization and verify that every Feature 014 order attempt remains fail-closed without wallet or provider side effects.

**Acceptance Scenarios**:

7. **Given** an SMMGEN service has type `Custom Comments`, **When** it is synchronized, **Then** it is represented as `CUSTOM_COMMENTS` metadata but remains non-purchasable in Feature 014.
8. **Given** Custom Comments quantity, pricing basis, field mapping, or normalization semantics are unresolved, **When** the customer attempts to order, **Then** the offering fails closed before monetary or provider side effects and is not treated as Standard.

### User Story 5 - Bind Orders Historically (Priority: P1)

As the system, I preserve the exact SMMGEN offering used by an accepted order even after catalog configuration changes.

**Why this priority**: Status and financial history must not change when administrators replace or disable current offerings.

**Independent Test**: Create a fixture order through offering A, change selection to offering B, and verify later operations resolve the original private binding.

**Acceptance Scenarios**:

9. **Given** an order is accepted through SMMGEN offering A, **When** administration selects offering B for the same MasterService, **Then** new orders use B while the existing order remains bound to A.
10. **Given** a historically bound SMMGEN order exists, **When** status, reconciliation, refill, or cancellation is requested, **Then** the operation uses the historical provider/offering snapshot and never follows the current selection.

### User Story 6 - Reconcile Availability (Priority: P1)

As a platform administrator, I can reconcile SMMGEN availability while preserving local catalog identity and avoiding unsafe routing.

**Why this priority**: Provider catalog drift must produce honest availability rather than accidental orders.

**Independent Test**: Apply recorded synchronization fixtures for present, changed, and disappeared services and verify offering state transitions without provider calls.

**Acceptance Scenarios**:

11. **Given** an SMMGEN service disappears or becomes invalid during reconciliation, **When** the catalog is updated, **Then** its offering is marked unavailable or unsupported while the MasterService, tenant configuration, and future favorite references remain intact.
12. **Given** an offering's provider rate or technical metadata changes after an order exists, **When** reconciliation completes, **Then** only current offering facts change and the historical order price, provider-cost snapshot, and wallet movement remain unchanged.

### User Story 7 - Fail Closed On Unknown Actions (Priority: P1)

As a platform, I reject SMMGEN action types that have not been explicitly verified and supported.

**Why this priority**: Guessing provider semantics can create invalid orders, financial errors, or privacy leaks.

**Independent Test**: Feed unknown, contradictory, malformed, and future SMMGEN type fixtures through normalization and order eligibility checks.

**Acceptance Scenarios**:

13. **Given** an unknown SMMGEN service type or capability key, **When** it is imported or mapped, **Then** it is classified as unsupported and can never default to `STANDARD`.
14. **Given** a known future SMMGEN action such as mentions, package, drip-feed, web traffic, subscription, poll, or group invite without an approved contract, **When** it is selected, **Then** it remains non-purchasable and no provider request is created.

### User Story 8 - Protect Tenants And Privacy (Priority: P1)

As a tenant and customer, I receive only data authorized for my tenant and account.

**Why this priority**: Provider integration must not create a cross-tenant or provider-data disclosure path.

**Independent Test**: Exercise catalog, order, administrative, and error fixtures across two tenants and roles; inspect response and log-safe outputs.

**Acceptance Scenarios**:

15. **Given** a customer or tenant administrator requests an SMMGEN service outside the active tenant scope, **When** the request is evaluated, **Then** it is rejected using existing scoped authorization/not-found behavior without revealing existence.
16. **Given** provider responses, errors, or logs contain SMMGEN credentials, authorization data, raw payloads, comments, or external IDs, **When** they are processed, **Then** public responses and logs contain only sanitized, approved information.

### User Story 9 - Handle Provider Outcomes Without Retries (Priority: P1)

As the order system, I distinguish accepted, rejected, and uncertain provider outcomes without duplicating charges or orders.

**Why this priority**: External operations and wallet movements are financially sensitive and cannot be made safe by blind retries.

**Independent Test**: Return fixture outcomes from a fake adapter and verify existing idempotency, wallet, order-history, and safe-error policies.

**Acceptance Scenarios**:

17. **Given** SMMGEN rejects a valid order, **When** the adapter returns an explicit rejection, **Then** the existing rejection/refund/history policy is applied and no retry or alternate offering is attempted.
18. **Given** SMMGEN times out or returns an ambiguous result, **When** the adapter reports uncertainty, **Then** the order remains in the existing uncertain state and the system does not retry, fail over, or claim success.

### User Story 10 - Operate Without Live Provider Access (Priority: P1)

As a developer or administrator, I can verify the integration using fixtures and fake adapters without credentials or live provider side effects.

**Why this priority**: The feature must be testable and reviewable without sending real requests or spending provider balance.

**Independent Test**: Run the complete focused integration suite with network access and credentials unavailable; verify no live SMMGEN request is attempted.

**Acceptance Scenarios**:

19. **Given** SMMGEN credentials are absent or invalid, **When** a provider operation is evaluated, **Then** it fails as an unavailable operational condition with sanitized output and no provider side effect or failover.
20. **Given** the integration test suite runs with fake adapters and recorded fixtures only, **When** catalog, ordering, status, and reconciliation paths are exercised, **Then** all expected behavior is observable without a live SMMGEN request, credential, or production-data change.

## Edge Cases

- SMMGEN returns duplicate, malformed, contradictory, or incomplete service metadata; the affected offering is rejected or unsupported and never guessed.
- A selected offering is disabled between catalog display and submission; submission fails closed before monetary or provider effects.
- A MasterService is disabled, hidden, or unavailable for one tenant while remaining valid for another; tenant scope remains authoritative.
- A SMMGEN external identifier changes or disappears; historical identifiers remain private and existing order bindings are not rewritten.
- A provider response is incomplete, contains an unknown status, or cannot be safely correlated; it is treated as rejected or uncertain according to the existing order policy, never as confirmed success.
- A target or comment payload contains excessive length, unsupported characters, blank lines, duplicates, or ambiguous normalization; Custom Comments remains unavailable until the approved contract specifies behavior.
- Provider rate changes after an order; current offering facts update without changing historical customer charges.
- Multiple offerings are available but none is explicitly selected; order creation fails closed rather than selecting one.
- A tenant administrator attempts provider configuration or credential access; existing role boundaries deny it.
- A future favorite references a MasterService whose provider offering disappears; the favorite remains stable but ordering is temporarily unavailable.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST represent SMMGEN as a provider offering associated explicitly with a local `MasterService` and MUST support multiple offerings for one MasterService.
- **FR-002**: The system MUST normalize SMMGEN service metadata into bounded provider-neutral capabilities and MUST retain provider-specific source facts privately for diagnostics only.
- **FR-003**: The system MUST support `STANDARD` only when target, quantity, bounds, pricing basis, and SMMGEN field mapping are verified and complete.
- **FR-004**: The system MUST keep `CUSTOM_COMMENTS` non-purchasable until quantity/comment-count, pricing, normalization, bounds, and exact SMMGEN request fields are explicitly approved.
- **FR-005**: The system MUST fail closed for unknown, unsupported, malformed, or contradictory SMMGEN types and MUST never default them to `STANDARD`.
- **FR-006**: The system MUST expose customers only to the MasterService identity and provider-neutral capability projection; it MUST exclude provider origin, external IDs, provider costs, raw payloads, credentials, and routing controls.
- **FR-007**: The system MUST require platform administration to explicitly map, enable, disable, and select SMMGEN offerings for new orders.
- **FR-008**: The system MUST fail before wallet, order, or provider side effects when no selected offering exists or the selected offering is unavailable, unsupported, disabled, or invalid.
- **FR-009**: The system MUST preserve tenant-scoped catalog eligibility and pricing without duplicating MasterServices for provider differences.
- **FR-010**: The system MUST bind each accepted order to the exact provider/offering/capability snapshot used at acceptance and MUST use that binding for later provider operations.
- **FR-011**: The system MUST preserve historical customer price, provider-cost, effective quantity, and input snapshots and MUST NOT recalculate them from later SMMGEN metadata.
- **FR-012**: The system MUST reconcile SMMGEN availability and metadata changes without deleting MasterServices, invalidating future MasterService-only favorites, or silently remapping orders.
- **FR-013**: The system MUST use one explicit adapter boundary for SMMGEN catalog and order operations and MUST keep provider-specific field names, type codes, HTTP details, and responses inside that boundary.
- **FR-014**: The system MUST preserve existing idempotency, wallet atomicity, rejection/refund, uncertain-outcome, and monotonic-status behavior.
- **FR-015**: The system MUST perform at most one provider attempt for an operation and MUST NOT retry, fail over, rank by cost, or silently substitute another offering.
- **FR-016**: The system MUST keep credentials backend-only, sanitize logs and errors, preserve TLS verification, and prevent credential or raw-provider-data disclosure.
- **FR-017**: The system MUST enforce existing platform, tenant-administrator, and customer authorization boundaries for SMMGEN configuration, catalog, orders, and historical operations.
- **FR-018**: The system MUST support fixture and fake-adapter verification for all in-scope behavior without live SMMGEN requests, credentials, provider balance, or production-data mutation.
- **FR-019**: The system MUST preserve Feature 013 implementation and migration as prerequisites and MUST NOT modify them as part of this specification.
- **FR-020**: The system MUST keep future SMMGEN action families out of the purchasable customer contract until separately specified, normalized, tested, and approved.

### Key Entities

- **SMMGEN provider offering**: A private, explicitly mapped local representation of one SMMGEN service, including normalized capability, availability, selection state, and private external identity.
- **MasterService**: The stable platform-owned commercial product selected by customers and retained independently of SMMGEN.
- **Normalized capability contract**: The provider-neutral fields, required inputs, bounds, quantity basis, supported operations, and version required to safely use an offering.
- **Historical order binding**: The immutable provider/offering/capability references and snapshots needed to operate on an accepted order.
- **Availability reconciliation result**: A sanitized administrative outcome describing whether an offering remains usable without changing local identity or history.
- **Canonical order input**: The validated target, quantity when applicable, and ordered comments when the approved Custom Comments contract permits them.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of in-scope Standard fixture orders use the explicitly selected SMMGEN offering and produce at most one provider attempt.
- **SC-002**: 100% of unknown, unsupported, malformed, or unresolved-capability fixtures are rejected before wallet debit, order creation, or provider dispatch.
- **SC-003**: 100% of historical-order fixtures continue to resolve their original provider/offering binding after current selection or availability changes.
- **SC-004**: 100% of public catalog and customer-order fixture responses exclude SMMGEN credentials, external IDs, provider costs, raw payloads, and routing controls.
- **SC-005**: 100% of tenant-isolation fixtures prevent cross-tenant SMMGEN offering, catalog, order, and configuration access.
- **SC-006**: 100% of reconciliation fixtures preserve MasterService identity, tenant commercial settings, and future MasterService-only favorite references when an SMMGEN service disappears.
- **SC-007**: 100% of fixture-based tests execute without live SMMGEN network calls, credentials, provider balance, or production-data changes.
- **SC-008**: The complete supported Standard catalog-to-order fixture flow can be verified within 5 minutes by a reviewer using documented local test commands.
- **SC-009**: At least 95% of acceptance-test users can identify the same local service before and after an SMMGEN offering replacement, with no provider information required.
- **SC-010**: The unresolved Custom Comments decision is explicitly recorded and prevents purchase until approved quantity, pricing, and field semantics exist.

## Assumptions

- Feature 013's provider-agnostic model, existing order lifecycle, wallet/idempotency policy, tenant overrides, and authorization roles are the baseline and are not redesigned here.
- SMMGEN's provider API contract, action types, status values, and field names are untrusted until captured in approved evidence; documentation alone is not treated as executable authorization.
- Platform administrators, rather than tenant administrators, own provider mapping, availability, selection, and credential configuration.
- Existing customer-facing catalog and order contracts remain provider-neutral and compatible with the local MasterService identity.
- A future Favorite references only the stable `userId` and `masterServiceId`, so provider replacement or disappearance does not delete the favorite.
- Standard order quantity remains deterministic and is retained in existing historical order semantics.
- Custom Comments may use an ordered canonical comment list internally, but no rule about quantity, pricing, bounds, whitespace, blank lines, duplicates, or provider field names is approved until contract evidence is reviewed.
- Testing uses recorded fixtures, fake adapters, and sanitized configuration; no test requires network access to SMMGEN.

## Open Decisions And Ambiguities

1. The authoritative SMMGEN Custom Comments request contract is unresolved, including whether `quantity` is required, derived from comment count, or forbidden.
2. The Custom Comments pricing basis and effective quantity used for wallet debit, bounds, `Orden.cantidad`, idempotency, and historical snapshots are unresolved.
3. Custom Comments normalization rules are unresolved: newline handling, blank lines, trimming, duplicate comments, maximum size, and preservation of text.
4. The exact SMMGEN status-value mapping and any future action-specific field names require approved provider evidence; unknown status values remain fail-safe.
5. The final placement of private normalized capability and input snapshots must preserve Feature 013 compatibility and historical binding without modifying Feature 013 artifacts in this feature.

Custom Comments execution semantics remain intentionally deferred, not a blocker for Feature 014 planning or Standard implementation.

## Non-Goals

- Sending any live SMMGEN request or creating, changing, refilling, canceling, or reconciling a real provider order.
- Adding SMMGEN credentials to the repository, frontend configuration, seed data, logs, tests, or customer responses.
- Modifying Feature 013 implementation, Prisma migration, or existing Feature 013 artifacts.
- Redesigning the Angular customer catalog/order experience or adding provider-specific fields to it.
- Implementing automatic routing, cost ranking, retry, failover, substitution, or provider health-based selection.
- Implementing unsupported SMMGEN actions, Favorites, provider administration UI, or unrelated catalog/order refactors.
- Inferring capability or Custom Comments semantics from service titles, descriptions, numeric type codes without mapping approval, or incomplete payloads.

## Readiness Notes

This specification is ready for `/speckit.plan`. Standard SMMGEN integration is the executable MVP. Custom Comments normalization and fail-closed behavior are in scope, while executable quantity, pricing, bounds, normalization, and request-field semantics remain intentionally deferred to a future approved decision. Planning must preserve the explicit no-live-call, no-credentials, fail-closed, no-retry/failover, privacy, tenant-isolation, and historical-binding constraints above.
