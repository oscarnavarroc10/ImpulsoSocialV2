# Feature Specification: Provider-Agnostic Service Capability Foundation

**Feature Branch**: `feature/013-provider-agnostic-service-capability`

**Created**: 2026-09-22

**Status**: Draft

**Input**: Design the provider-agnostic service capability foundation for
ImpulsoSocialV2 while preserving the existing BulkFollows catalog, tenant
catalog, order, wallet, and order-history behavior.

**Implementation boundary**: This document is specification/design only. It
must not be treated as authorization to modify application code, Prisma,
migrations, frontend, provider credentials, or live provider data.

## Clarifications

### Session 2026-09-22

- Q: How should MasterService-provider offerings be associated? -> A: Use an explicit MasterService-to-ProviderService offering association; retain `MasterService.provenanceRef` for compatibility only.
- Q: What scope should provider selection use for the MVP? -> A: Platform-global selection.
- Q: What routing policy should apply when the selected offering is unavailable? -> A: Explicit/manual routing; fail closed with no failover or substitution.
- Q: Which record should preserve historical provider binding? -> A: Reuse `OrdenProveedor` with nullable offering/provider-service/capability linkage and legacy fields retained.
- Q: What persistence approach should be preferred for private order input? -> A: Prefer a private structured JSON snapshot on existing persistence when clean; exact field placement remains for planning.
- Q: Which capabilities are initially supported? -> A: `STANDARD` and `CUSTOM_COMMENTS` only.
- Q: What should the customer catalog expose? -> A: Eventually expose only the normalized capability projection, never provider-specific metadata.
- Q: Where should provider credentials live initially? -> A: Backend environment configuration; encrypted/admin-editable credential storage is deferred.
- Q: How should future Favorites identify services? -> A: Reference only `userId` and `masterServiceId`.
- Q: What happens when a provider disappears? -> A: Preserve the MasterService and Favorites, and disable the affected offering.
- Q: How should cross-provider mappings be created? -> A: Explicitly and through curation/administration; never infer mappings from titles or descriptions.
- Q: How should `Orden.cantidad` behave for Custom Comments? -> A: Preserve it as the effective quantity when deterministic; do not declare it nullable merely because Custom Comments may omit direct quantity.


## 1. Problem Statement

ImpulsoSocialV2 has a curated `MasterService` catalog, but the purchase path
still treats the current BulkFollows relationship as the service contract.
The current order flow resolves `MasterService.provenanceRef`, reads
BulkFollows fields from `ProviderService.rawPayload`, requires provider type
`Default`, builds `service + link + quantity`, and calls
`BulkFollowsOrderClient` directly.

That coupling makes the current provider's order shape, service type, quantity
rules, status mapping, and historical relationship part of customer/domain
behavior. It also prevents a single commercial service from having more than
one fulfillment offering and would force a future provider such as SMMGEN to
reshape the customer catalog and order form.

The platform needs a stable customer-facing service identity and an explicit,
private fulfillment offering selected by administration. Provider capabilities
must be normalized at the boundary, unknown capability types must fail closed,
and accepted orders must retain the exact provider offering used at creation.

## Terminology

- **MasterService**: the platform-owned, stable commercial product selected by
  customers and referenced by future Favorites.
- **ProviderService**: an imported external provider service record, including
  private provider identifiers and raw/technical source data.
- **Provider offering**: an explicit mapping between a MasterService and a
  ProviderService, including normalized capability, availability, and
  administrative selection state.
- **Capability**: the provider-neutral order-input contract, initially
  `STANDARD` or `CUSTOM_COMMENTS`.
- **Current offering**: the explicitly selected offering used for new orders.
- **Historical binding**: the immutable private provider/offering reference
  captured for an accepted order.

## User Scenarios & Testing

### User Story A - Standard Order (Priority: P1)

As a customer, I can order a standard MasterService using a target and
quantity without knowing which external provider fulfills it.

**Independent Test**: With a tenant-enabled MasterService and a valid selected
Standard offering, submit a fixture order through a fake adapter and verify
the existing wallet, idempotency, safe response, and provider-attempt rules.

**Acceptance Scenarios**:

1. Given valid target and quantity within structured bounds, when the customer
   submits, then the selected offering receives one provider-neutral request.
2. Given an invalid or unavailable offering, when the customer submits, then
   no wallet debit or provider request occurs.

### User Story B - Custom Comments (Priority: P1)

As a customer, I can order a Custom Comments MasterService using target and
comments without provider-specific knowledge.

**Independent Test**: Submit normalized comments through a fake adapter and
verify required fields, effective quantity semantics, pricing, persistence,
and rejection behavior.

**Acceptance Scenarios**:

1. Given a valid structured Custom Comments capability, target, and comments,
   when the customer submits, then the adapter receives the normalized input.
2. Given empty comments or unresolved quantity semantics, when the customer
   submits, then the order fails closed before monetary side effects.

### User Story C - Provider Transparency (Priority: P1)

As a customer, my catalog and order experience does not expose provider
identity, external IDs, costs, credentials, URLs, or raw payloads.

**Independent Test**: Inspect catalog/order DTOs and serialized errors from
fixtures containing provider data; verify no provider infrastructure appears.

### User Story D - Provider Configuration (Priority: P2)

As a platform administrator, I can eventually associate provider offerings
with a MasterService and choose which offering is used for new orders.

**Independent Test**: Using administrative fixtures, enable/disable and select
offerings, then verify deterministic new-order resolution without building UI.

### User Story E - Provider Replacement (Priority: P2)

As a platform administrator, I can replace a MasterService offering without
changing the customer-facing MasterService identity.

**Independent Test**: Switch the selected offering from provider A to provider
B and verify catalog identity stays stable while only new orders use B.

### User Story F - Historical Order (Priority: P1)

As the system, an existing provider order remains associated with the provider
that originally created it even after MasterService configuration changes.

**Independent Test**: Create an order through provider A, switch to B, and
verify status/reconciliation fixtures still resolve A.

### User Story G - Provider Unavailable (Priority: P1)

As a customer, I cannot accidentally submit an order through an unavailable
or unsupported provider offering.

**Independent Test**: Mark the selected offering unavailable or unsupported and
verify a closed failure with zero external and wallet side effects.

### User Story H - Future Favorite Compatibility (Priority: P3)

As a future customer, I can favorite a MasterService and keep that favorite
when its fulfillment provider changes or disappears.

**Independent Test**: Model the future reference as `(userId, masterServiceId)`
only and verify provider replacement does not invalidate it. No Favorite
entity or endpoint is implemented in this feature.

## 2. Goals

1. Establish `MasterService` as the stable commercial identity selected by
   customers, tenants, public catalog APIs, and future Favorites.
2. Model provider services as private external offerings that may be mapped to
   one or more MasterServices through explicit administrative configuration.
3. Support a MasterService having multiple provider offerings while retaining
  one explicit/manual, platform-global offering selection for new orders in
  this milestone.
4. Define a provider-neutral order-input capability representation for at least
   `STANDARD` and `CUSTOM_COMMENTS`.
5. Ensure unsupported or unknown provider input types are unavailable for
   purchase and never silently treated as `STANDARD`.
6. Define an adapter boundary for create order and status, with extension
   points for refill, cancel, and balance.
7. Preserve current BulkFollows catalog import, curation, public catalog,
   tenant override, pricing, wallet, idempotency, order, and history behavior.
8. Make future SMMGEN integration possible without changing the customer
   catalog identity or inventing provider-specific Angular fields.
9. Preserve enough private order history to continue status, refill, cancel,
   and reconciliation against the provider that accepted each order.
10. Keep provider credentials backend-only and outside customer APIs and
    frontend configuration.

## 3. Non-Goals

- Integrating SMMGEN or making any live SMMGEN request.
- Changing Feature 012 or redesigning the Angular customer dashboard/order
  experience.
- Automatic cheapest-provider selection, automatic failover, retries, or
  silent provider switching.
- Favorites implementation, favorite endpoints, favorite UI, or favorite
  persistence.
- Building a provider administration UI.
- Replacing the existing catalog curation workflow, tenant overrides, wallet,
  pricing, authentication, or order idempotency mechanisms.
- Parsing service titles or free-form descriptions to infer authoritative
  order behavior.
- Exposing raw provider payloads, provider names, provider IDs, provider costs,
  credentials, or infrastructure to customers.
- Supporting every future provider service type in this milestone. The domain
  may recognize a bounded set of capability keys, but only `STANDARD` and
  `CUSTOM_COMMENTS` are purchasable initially.
- Changing provider production data, spending provider balance, submitting,
  canceling, refilling, or reconciling real provider orders during design.

## 4. Current Architecture Discovered from Repository

### 4.1 Catalog and commercial identity

The existing Prisma schema contains:

- `MasterService`: internal service identity with title, description,
  category, social network, provider cost, default selling price, visibility,
  lifecycle status, and nullable `provenanceRef`.
- `ProviderService`: imported provider record keyed by
  `(providerOrigin, externalId)` with `rawPayload`, import timestamp, and
  optional metadata.
- `StagedService`: curation record related to `ProviderService`.
- `TenantServiceOverride`: tenant-scoped enablement and selling-price
  override keyed by `(tenantId, masterServiceId)`.
- `MasterCatalogSnapshot` and `MasterCatalogSnapshotItem`: versioned curated
  catalog export records.
- `SyncJob` and `AuditLog`: synchronization and administrative traceability.

`CurationService` currently promotes staged records into `MasterService` and
uses the staged provider record as the current `provenanceRef`. It normalizes
provider rate and derives integer-minor-unit commercial prices. Provider sync
must not overwrite curated business fields.

### 4.2 Provider catalog import

`ProviderCatalogClient` is the existing small catalog boundary. The concrete
`BulkFollowsClient` imports services and maps provider `service` to
`ProviderService.externalId`; the imported payload includes structured fields
such as `type`, `min`, `max`, `refill`, and `cancel`.

The current implementation identifies BulkFollows with the stable origin
`bulkfollows`, but synchronization and presentation still contain explicit
BulkFollows checks. The new design must preserve those checks during migration
while moving future routing decisions behind provider-specific adapters and
normalized offering metadata.

### 4.3 Customer catalog

`PublicCatalogService` and `PublicCatalogRepository` expose tenant-filtered
MasterServices. The current safe DTO includes service identity, commercial
copy, network/category, selling price, quantity bounds, and refill/cancel
metadata when available.

The repository currently follows `MasterService.provenanceRef` to
`ProviderService`, then derives quantity bounds and metadata from raw
BulkFollows payload only when the provider origin is `bulkfollows`. This is a
compatibility behavior that must remain usable while normalized metadata is
introduced. Raw payload itself must never cross the customer API boundary.

### 4.4 Order creation and history

`OrderService.create` currently:

1. validates idempotency and computes a request fingerprint;
2. resolves an eligible active/visible MasterService for the authenticated
   tenant;
3. follows `provenanceRef` to one BulkFollows ProviderService;
4. requires structured provider type `Default` and valid min/max bounds;
5. calculates selling and provider totals with integer arithmetic;
6. creates the order and wallet purchase atomically;
7. conditionally claims `pendiente -> enviando`;
8. calls `BulkFollowsOrderClient.submit` once; and
9. persists accepted/rejected/ambiguous results without unsafe automatic retry.

`CreateOrderDto` currently contains exactly `serviceId`, `target`, and
`quantity`. `OrderResponseDto` is intentionally safe and excludes provider
information, credentials, raw payloads, and wallet internals.

`Orden` stores the MasterService relation, target, quantity, price and cost
snapshots, local status, idempotency fields, and timestamps. `OrdenProveedor`
is currently one-to-one with `Orden` and stores provider origin as a string,
external order ID, external status, private request/response JSON, and cost.
`HistorialOrden`, `SolicitudReposicion`, and `SolicitudCancelacion` already
provide order lifecycle persistence.

### 4.5 Provider status and money behavior

The current status mapping is in `OrderService` and is BulkFollows-specific.
Partial/canceled refresh can invoke existing refund behavior. Wallet debits and
refunds are transactionally guarded and use integer minor units. This feature
must not weaken those safeguards or alter existing order status semantics for
orders already created.

### 4.6 Roles and tenant isolation

`RolUsuario` currently includes `cliente`, `administradorTienda`, and
`administradorPlataforma`. Existing catalog administration authorization
requires `administradorPlataforma`. Tenant-scoped customer and catalog queries
carry authenticated tenant identity and must continue to do so.

Provider configuration, credentials, offering selection, and synchronization
are platform infrastructure. Store/tenant administrators may manage tenant
commercial enablement and selling prices but must never receive provider API
credentials.

### 4.7 Existing specifications and sequencing

The repository contains specs `001` through `009`, `011`, and `012`.
Feature 001 defines the curated MasterService catalog; Feature 004 defines
BulkFollows order placement; Features 005-007 cover order status/refunds;
Features 008-009 cover wallet/deposits; Feature 011 establishes the Angular
foundation; and Feature 012 establishes the customer dashboard/order
experience.

The missing provider-foundation work was previously described informally as a
possible Feature 010, but Feature 012 now exists and must not be modified.
This specification uses the next available feature number, `013`, to avoid
rewriting historical sequence or changing an existing feature directory.

## 5. Proposed Domain Boundaries

### 5.1 MasterService

`MasterService` remains the platform-owned commercial product. It owns:

- stable internal identity;
- customer-facing title and description;
- curated category and social-network identity;
- lifecycle and commercial visibility;
- platform/default and tenant-resolved selling price;
- normalized customer-safe capability information.

Customers select only this identity. A MasterService does not become a new
record merely because the platform changes its fulfillment provider.

### 5.2 Provider service

`ProviderService` remains the imported external offering record. It owns:

- provider origin and external service identifier;
- raw imported payload retained for backend audit/diagnostics;
- import timestamp and technical metadata;
- the latest normalized provider facts needed for routing and validation.

ProviderService is never a customer-facing catalog identity.

### 5.3 Provider offering mapping

Introduce one explicit private association concept, named here
`MasterServiceProviderOffering` for clarity. The final table/model name may
follow repository naming conventions.

It should associate:

- `masterServiceId`;
- `providerServiceId`;
- provider-neutral normalized capability key and input contract version;
- normalized bounds and capability flags where authoritative;
- private provider cost/rate snapshot source;
- administrative availability/enabled state;
- explicit manual-selection state or selection metadata;
- created/updated timestamps.

A MasterService may have many offerings. An offering must reference one
ProviderService, and a ProviderService may be mapped to more than one curated
MasterService only through explicit administrative mapping.

For the MVP, new orders resolve exactly one explicitly selected available
offering. If none is selected or the selected offering is unavailable, the
service is not purchasable. The system must not choose another offering
implicitly.

### 5.4 Provider integration registry

A small private provider integration concept may be introduced if needed for
administration and adapter resolution. It should contain a stable origin,
non-secret display/configuration metadata, enabled state, and a reference to
the backend environment configuration rather than the credential itself.

Encrypted, administrator-editable credential storage is deferred. Credentials
remain backend-only environment configuration for this milestone.

This registry is not a customer catalog and is not a generic plugin marketplace.
If the existing `providerOrigin` string can safely remain the registry key for
this milestone, do not duplicate it solely for naming purposes. The
implementation plan must choose the smallest form that supports explicit
adapter lookup and future administration.

### 5.5 Provider-neutral capability

The capability boundary belongs to the offering because the external service
contract determines the required fields. The customer-visible MasterService
may expose a normalized capability projection only after the selected/eligible
offering has a valid supported contract.

Provider-specific numeric type codes remain inside adapter/import metadata.
The customer/domain contract uses a bounded provider-neutral capability key and
field requirements, not `type === 'Default'` or another provider code.

## 6. MasterService vs Provider Offering Lifecycle

1. Catalog synchronization imports or updates a ProviderService and its
   normalized technical facts.
2. Curation creates or updates a MasterService independently from the provider
   title, raw ID, and provider description.
3. Administration maps one or more ProviderServices to the MasterService as
   offerings.
4. Administration explicitly enables an offering and selects the offering to
   use for new orders.
5. TenantServiceOverride independently controls tenant enablement and selling
   price; it does not duplicate a MasterService because provider mapping
   differs.
6. Customer catalog eligibility requires active/visible MasterService,
   tenant-allowed override, and a valid available supported offering when the
   customer needs to order it.
7. A provider sync may update technical metadata and availability, but must not
   overwrite curated MasterService identity or tenant prices.
8. Changing the selected offering affects only new orders after the change.
9. Existing orders retain their historical offering/provider binding and must
   continue to use it for status, refill, cancellation, and reconciliation.
10. Deprecating a MasterService must preserve existing orders and future
    Favorite references; it must not delete historical provider data.

## 7. Provider-Neutral Capability Model

The initial normalized capability representation should be a constrained
allow-list plus a structured field contract, rather than a large provider
specific enum or arbitrary JSON interpreted by customer code.

The minimum capability keys are:

- `STANDARD`: target/link and quantity;
- `CUSTOM_COMMENTS`: target/link and comments, with quantity semantics taken
  from the normalized contract rather than assumed.

The model may reserve future keys for mentions, package, drip feed, web
traffic, subscription, poll, group invites, and similar shapes, but a reserved
or unknown key is `unsupported` until its adapter and validation contract are
implemented.

A normalized contract should express, at minimum:

- capability key;
- required and optional logical fields;
- whether quantity is required, optional, derived, or forbidden;
- valid target kind;
- min/max quantity or comment-count constraints when authoritative;
- input contract version;
- provider-specific source/type retained privately for diagnostics;
- supported operations such as create/status/refill/cancel.

The representation must be validated at import/mapping time and again before
purchase. Missing, contradictory, malformed, or unknown contracts are
unavailable. No mapper may default an unknown provider type to `STANDARD`.

Structured provider metadata is authoritative where present. Titles and
human-readable descriptions are display content only and cannot determine
capability or business validation.

## 8. STANDARD Order Requirements

For a `STANDARD` offering:

- customer input includes the MasterService identity, target/link, and positive
  integer quantity;
- the backend resolves tenant price, selected offering, provider service ID,
  provider cost, and bounds server-side;
- quantity must satisfy the offering's normalized min/max contract;
- price and provider-cost calculations retain the existing integer minor-unit
  and per-1,000 rules where those rules are part of the current catalog
  contract;
- the adapter transforms the provider-neutral request into the provider's
  private request shape;
- the customer API never receives provider service IDs, type codes, provider
  origin, or provider cost;
- idempotency fingerprinting includes the canonical capability input, so a
  changed target or quantity is a different request;
- the historical order stores the MasterService, selected offering/provider
  binding, selling-price snapshot, provider-cost snapshot where appropriate,
  and input snapshot.

Existing Standard orders and the current three-field request remain supported
without requiring clients to know about the new offering model.

## 9. CUSTOM_COMMENTS Order Requirements

Custom Comments is a real capability selected from structured metadata. It
must not be inferred from a title containing `Custom Comment` or from a
free-form description.

The provider-neutral request should represent comments as an ordered list of
non-empty strings internally, while accepting newline-separated input at the
adapter boundary if the customer API chooses that transport representation.
The canonical representation must define newline normalization, empty-line
handling, maximum size, and whether comment text is preserved exactly after
validation. Those limits require evidence from the selected provider contract;
this feature must not invent provider limits.

The normalized contract determines whether the request includes:

- target/link;
- comments;
- quantity, if the provider contract explicitly requires it;
- a derived comment count, if that is the provider's authoritative quantity
  measure.

The backend must reject a missing or empty comments input. It must validate
quantity or comment count against structured min/max data when that data is
part of the offering contract. It must not blindly require quantity when the
provider contract uses comments as the count, and it must not silently derive
quantity when the provider contract requires an independent quantity.

The adapter owns conversion from the provider-neutral comments representation
to the provider's request fields. Provider-specific fields, numeric type codes,
and external identifiers remain private. The order snapshot must preserve the
validated customer input needed for history and reconciliation without exposing
provider payloads in customer responses.

If the selected provider's Custom Comments contract is incomplete or its
quantity semantics are unknown, the offering is unsupported and cannot be
purchased.

For the initial implementation, BulkFollows Custom Comments must remain fail
closed until its structured request contract and quantity semantics are
verified.

## 10. Unsupported Capability Behavior

- Unknown provider type or capability key: mark the offering unsupported and
  reject purchase with a stable business error before wallet/order side effects.
- Known future capability without an implemented adapter: expose no purchasable
  form and reject purchase closed, without falling back to Standard.
- Missing required normalized field contract: reject mapping or mark offering
  unavailable; never guess.
- Invalid min/max, malformed external service ID, or contradictory metadata:
  reject the offering and retain a sanitized administrative diagnostic only.
- Provider capability changes after import: new orders use the current valid
  mapped contract; existing orders use their historical snapshot and adapter
  binding.
- An unavailable selected offering does not trigger automatic selection of
  another offering in this milestone.

## 11. Provider Adapter Boundary

Use normal NestJS interfaces and dependency injection; do not create a dynamic
plugin framework.

The domain/application layer should depend on a provider-neutral boundary
conceptually equivalent to:

```text
ProviderOrderAdapter
  createOrder(request): accepted | rejected | uncertain
  getStatus(request): normalized status | unavailable
  refill(request): deferred capability
  cancel(request): deferred capability
  getBalance(request): deferred capability
```

The exact TypeScript names and result types are implementation decisions, but
the boundary must:

- receive a resolved private offering and normalized provider-neutral input;
- resolve credentials/configuration only in backend infrastructure;
- validate and serialize provider-specific requests internally;
- normalize provider responses and statuses before application code sees them;
- sanitize logs and errors;
- use one adapter selected by historical provider origin for existing orders;
- keep customer/domain code unaware of HTTP verbs, form field names, API keys,
  provider numeric type codes, and raw payloads.

The existing `BulkFollowsOrderClient` becomes the first adapter implementation
without changing its one-attempt/idempotency semantics. Status mapping currently
in `OrderService` moves behind the adapter or a provider-specific mapper while
preserving existing local status behavior. SMMGEN is a future adapter only; no
SMMGEN code or request is part of this feature.

The catalog import boundary may continue using `ProviderCatalogClient`, but
its output must feed normalized ProviderService/offering metadata rather than
making the order domain inspect raw JSON directly.

## 12. Provider Routing Rules

For this milestone:

1. Platform administration explicitly selects the offering used for new orders.
2. At order creation, resolve the selected available offering for the chosen
   MasterService and authenticated tenant eligibility.
3. If there is no selected available offering, fail before monetary or external
   side effects.
4. Do not rank by cost, automatically choose the cheapest offering, fail over,
   retry with another provider, or silently switch providers.
5. Persist the selected offering/provider binding before the external operation
   can be considered accepted.
6. Once an order has an accepted provider binding, all later provider
   operations use that binding even if administration changes the current
   selection.
7. A manually changed selection affects only newly created orders.

Future priority, preferred-provider, fallback, or lowest-cost policies require
separate specifications and explicit audit behavior.

## 13. Multi-Tenant Behavior

- MasterService and provider offerings are platform-level concepts.
- TenantServiceOverride remains the tenant-specific commercial layer.
- A tenant may enable/disable a MasterService and override selling price using
  the existing rules.
- Provider offering selection is infrastructure configuration, not a tenant
  customer identity and not a reason to duplicate MasterService per tenant.
- Tenant-facing catalog queries remain scoped by active tenant and must expose
  only eligible MasterService data and safe normalized capability information.
- Store/tenant administrators may manage tenant enablement and price according
  to existing authorization, but cannot read provider credentials or raw
  provider payloads.
- Platform administration owns provider registry/configuration, synchronization,
  mapping, selection, and provider availability.
- No query may allow a customer to provide tenant ID, provider ID, offering ID,
  or external provider service ID as a routing override.

## 14. Historical Order/Provider Binding

At order creation, the backend must snapshot enough private information to
answer which commercial service and provider offering fulfilled that order:

- `MasterService` identity;
- provider integration/origin;
- provider service/external identifier;
- selected offering identity and capability-contract version, where available;
- external provider order ID after acceptance;
- provider cost snapshot where appropriate;
- customer selling-price snapshot;
- validated input snapshot, including target, quantity when present, and
  comments when present;
- normalized provider status and local status history.

The current `OrdenProveedor` one-to-one record should be evolved rather than
duplicated. It should gain nullable linkage to the selected offering/provider
service and a contract/capability snapshot while retaining existing
`proveedor`, `idExterno`, request/response, status, and timestamps for backward
compatibility. Existing rows remain valid when the new linkage is null; a
backfill may link them by the current provider origin/external ID where the
relationship is unambiguous.

`Orden.servicioId` remains the MasterService relation. Existing orders must not
be reassigned when an administrator maps BulkFollows to another provider.
Future status, refill, cancellation, and reconciliation resolve the adapter
from the historical private binding, never from the current MasterService
selection.

A customer-safe order response continues to omit provider identity, provider
service ID, external order ID, provider cost, raw request/response, contract
internals, credentials, and private snapshots.

## 15. Catalog Metadata Normalization

Normalize only structured, authoritative provider facts that the domain needs:

- capability key and contract version;
- min/max quantity or comment-count bounds;
- average time when available and approved for a customer-safe projection;
- refill/cancel/drip-feed support flags;
- target/link kind and input field requirements;
- provider availability and last synchronization time.

The normalized representation must identify the source and validation status of
technical facts. Raw `ProviderService.rawPayload` remains backend-only for
import diagnostics and migration support. Customer DTOs receive a deliberate
safe projection, never rawPayload or arbitrary metadata.

Provider descriptions may be retained for administrator review and curated
copy, but regex parsing or keyword scanning of descriptions is not a business
rule. If structured metadata is absent or contradictory, the capability is
unavailable until curated/normalized safely.

During migration, the public catalog may continue deriving existing
BulkFollows min/max/refill/cancel values from raw payload through one
compatibility normalizer. New provider-neutral order logic must consume the
normalized offering contract and must not add more direct raw-payload reads.

## 16. Future Favorites Compatibility

Favorites are explicitly deferred. The data model must nevertheless allow a
future entity conceptually equivalent to:

```text
UserFavoriteService
- userId
- masterServiceId
- createdAt
- unique(userId, masterServiceId)
```

A future favorite must reference only the stable MasterService, never a
provider, ProviderService, offering, or external provider ID. Provider changes
must not invalidate or delete the favorite.

When a customer selects a future favorite, the application resolves current
tenant availability and the current explicitly configured offering. It
preselects network, category, and MasterService, but leaves target/link,
quantity, and comments empty. The form is generated from the current normalized
capability. If no offering is available, the favorite remains stored and is
shown as temporarily unavailable; no silent alternate provider is selected.

The proposed offering model must therefore avoid making a provider foreign key
part of any future favorite identity or customer URL.

## 17. Future SMMGEN Compatibility

SMMGEN is a design input only. It is not integrated by this feature and no
request may be sent to `https://my.smmgen.com/api/v2`.

The design must accommodate its documented action families without leaking
those fields into the current customer contract:

- standard fields such as `service`, `link`, and `quantity`;
- custom comments fields;
- mentions, package, drip-feed, web traffic, subscriptions, polls, and group
  invite variants;
- future status, refill, cancel, and balance operations.

SMMGEN's provider numeric service type and action-specific field names belong
inside its adapter and normalized contract. The customer selects the same
MasterService identity and receives a provider-neutral capability projection.
Adding SMMGEN later must require a new adapter, import normalizer, and offering
configuration, not a redesign of the customer catalog identity or a second
provider-specific customer order DTO.

## 18. Security Requirements

- Provider credentials are backend-only and are never returned to customer,
  tenant-admin, or public catalog APIs.
- Credentials are read from the existing backend secret/configuration boundary
  or a future secret reference. They are not stored in frontend configuration,
  Prisma seed data, committed files, or raw order snapshots.
- Logs must not contain credentials, authorization headers, request keys, raw
  provider bodies, provider order IDs where avoidable, or customer private
  comments beyond approved audit requirements.
- Provider raw payloads and raw responses remain backend-only and are excluded
  from customer DTOs and tenant/public exports.
- Provider administration endpoints require `administradorPlataforma` and
  preserve existing authorization and tenant boundaries.
- `administradorTienda` can manage only permitted tenant commercial settings;
  it cannot configure or read provider credentials.
- Customers cannot select provider origin, provider service ID, offering ID,
  provider cost, or routing policy in an order request.
- All provider inputs and imported metadata are untrusted and require strict
  validation. Unknown capabilities fail closed.
- Existing authentication, idempotency, wallet atomicity, and safe error
  behavior remain mandatory.

## 19. Backward Compatibility and Migration Considerations

### 19.1 Data-model evolution

The minimal compatible evolution should be evaluated in this order:

1. Add a private provider integration/registry only if adapter/configuration
   lookup cannot safely use the existing `providerOrigin` value.
2. Add a `MasterServiceProviderOffering` association for many-to-many
   MasterService/ProviderService mapping, availability, normalized capability,
   and explicit selection.
3. Add normalized capability/contract fields or a versioned structured
   metadata record associated with the offering. Keep rawPayload for import
   compatibility, but stop adding domain behavior that reads it directly.
4. Add nullable historical offering/provider-service linkage and capability
   snapshot fields to `OrdenProveedor`; retain all existing columns during a
   compatibility period.
5. Add a private structured JSON order-input snapshot on existing persistence,
  preferably on `Orden` when that is clean, or use a related private
  order-input record if required by the final schema design. The snapshot
  must support target, comments, and optional quantity without fabricating
  values. Preserve existing `Orden.cantidad` values and use it as effective
  quantity whenever the normalized contract makes that quantity deterministic.
  The migration must not erase or reinterpret existing quantities.
6. Keep `MasterService.provenanceRef` nullable and readable only as a
  compatibility path during migration. The explicit offering association is
  authoritative for new orders; existing provenance-backed services may be
  backfilled to one offering where the link is unambiguous.

The exact model names, indexes, nullability details, and whether input snapshots
live on `Orden` or a one-to-one child record require implementation planning and
migration review. No schema change is authorized by this specification pass.

### 19.2 Backfill and rollout

- Inventory all MasterServices with non-null `provenanceRef`.
- Verify each reference resolves to a ProviderService and classify malformed,
  missing, unsupported, and duplicate provenance.
- Create one BulkFollows offering for each unambiguous supported existing
  relationship.
- Mark ambiguous or unsupported services unavailable for new orders rather
  than guessing a mapping.
- Backfill existing `OrdenProveedor` rows to the matching offering where safe;
  leave legacy fields intact and preserve rows that cannot be linked.
- Deploy read compatibility before switching order creation to offering
  resolution.
- Verify public catalog, tenant overrides, wallet debit/refund, idempotency,
  status refresh, order history, and deprecation behavior before removing any
  legacy resolution path.
- Do not delete or rewrite raw provider records or historical orders.

### 19.3 Existing API compatibility

Existing customer catalog and order contracts remain valid for Standard orders.
A future capability-aware order request may add provider-neutral optional input
fields in a backward-compatible way, but must not expose provider-specific
fields. Existing safe response fields remain stable. Any optional new capability
projection requires a separate contract review and frontend implementation
scope; it is not a reason to modify Feature 012 in this feature.

## 20. Acceptance Criteria

The design is accepted only when all statements below are true:

- Customer-facing services use stable MasterService identity.
- Customer APIs do not expose provider identity, provider service IDs, provider
  costs, raw payloads, or credentials.
- A MasterService can conceptually have multiple provider offerings.
- Existing BulkFollows catalog sync, curation, public catalog, tenant catalog,
  order placement, status, refunds, pricing, wallet, and history can remain
  operational during migration.
- SMMGEN can later be added as an adapter and catalog source without redesigning
  customer catalog identity or provider-specific order fields into Angular.
- `STANDARD` and `CUSTOM_COMMENTS` have explicit provider-neutral requirements.
- Custom Comments is selected from structured capability metadata and supports a
  comments input without blindly requiring quantity.
- Unsupported provider service types and unknown capability keys cannot be
  ordered and never fall back to Standard.
- Existing orders remain bound to the provider offering that created them.
- Provider selection changes affect new orders only.
- Future Favorites can reference MasterService only and survive provider
  remapping.
- Tenant isolation and existing role boundaries remain intact.
- No provider credentials reach Angular or tenant/public APIs.
- No automatic provider failover, cheapest selection, or silent switching is
  introduced.
- No real provider operation is executed during this specification task.
- The proposed migration preserves legacy `provenanceRef` and `OrdenProveedor`
  data until historical linkage is verified.

## 21. Testing Strategy

### Contract and unit tests

- Normalize BulkFollows structured metadata into Standard and Custom Comments
  contracts.
- Reject unknown, missing, contradictory, malformed, and unsupported types.
- Prove no title or description substring changes capability.
- Validate Standard quantity bounds and Custom Comments comments/quantity
  semantics from the normalized contract.
- Validate canonical input snapshots and idempotency fingerprints for optional
  quantity/comments.
- Verify adapter request mapping without real HTTP and with credentials
  asserted absent from captured logs/snapshots.
- Verify adapter status normalization and provider-specific status mapping.

### Catalog and administration tests

- A MasterService with zero, one, and multiple offerings resolves according to
  explicit selection rules.
- Disabled/unselected/unavailable offerings cannot be used for new orders.
- Tenant enablement and selling-price overrides continue to apply to the
  MasterService, independent of provider selection.
- Public catalog projections contain only approved normalized metadata and no
  provider identifiers or raw payloads.
- Platform-admin authorization permits provider configuration; tenant admins and
  customers are denied credentials and provider infrastructure.

### Order and history tests

- Standard order behavior remains equivalent to current BulkFollows behavior,
  including wallet debit, idempotency, accepted/rejected/uncertain outcomes,
  and safe responses.
- Custom Comments persists validated input without requiring a fabricated
  quantity and maps through the adapter contract.
- An order stores historical offering/provider binding before external
  fulfillment can be accepted.
- Changing the current selected offering does not change status/refill/cancel
  routing for an existing order.
- Legacy orders with null new linkage continue to resolve through preserved
  provider fields and existing compatibility logic.
- Concurrent order requests cannot select different providers for the same
  accepted order or create duplicate provider side effects.

### Security and regression tests

- Recursive assertions find no provider credentials, raw payloads, provider
  identifiers, provider costs, or raw provider responses in customer DTOs.
- Existing catalog, order, status, refund, wallet, deposit, auth, and tenant
  isolation suites pass unchanged or with focused contract updates.
- Prisma schema validation/generation and migration dry-run checks are required
  during implementation planning, not during this specification-only pass.
- Tests use fakes/fixtures only. No live BulkFollows, SMMGEN, balance, refill,
  cancel, or order operation is permitted.

## 22. Explicit Deferred Work

- Prisma schema implementation and migration files.
- BulkFollows offering backfill and production rollout.
- Provider registry/credential administration endpoints and UI.
- Provider offering mapping and manual-selection administration UI.
- Refactoring `OrderService` and `OrderRepository` to resolve offerings.
- Implementing the provider-neutral order request and adapter interfaces.
- BulkFollows adapter extraction and status mapper relocation.
- Custom Comments customer API, Angular form, validation UX, and submission.
- Normalized customer catalog capability DTO changes.
- SMMGEN catalog importer and order/status/refill/cancel/balance adapter.
- Automatic routing policies, provider failover, priority, and cost-based
  selection.
- Favorites entity, endpoints, UI, and current-availability resolution.
- Secret-manager integration if the existing deployment boundary is insufficient.
- Changes to Feature 012 or any frontend redesign.

## Required Design Coverage

The following decisions are part of this specification and are intentionally
kept together so they can be reviewed before planning:

### Provider Availability

An offering is unavailable when its provider is disabled, its imported service
is absent or invalid, its normalized contract is unsupported, or administration
has disabled the mapping. The MasterService remains intact. Customer ordering
fails closed until an administrator selects a valid offering; no alternate
offering is chosen automatically.

### Explicit Provider Routing

Provider selection is platform-managed and explicit for the first version.
There is no cheapest-provider routing, ranking, load balancing, failover, or
cross-provider retry after an ambiguous submission. TenantServiceOverride
controls commercial tenant availability and price, not provider identity.

### Provider Resolution During Order Creation

The backend resolves tenant, MasterService, tenant override, selected offering,
normalized capability, and immutable price/cost inputs before wallet/provider
side effects. The request contains MasterService identity and provider-neutral
inputs only. The selected offering is recorded before an accepted external
result can be associated with the order.

### Provider Status Routing for Existing Orders

Status, refill, cancel, and reconciliation resolve the adapter from the order's
historical private binding. They never follow the MasterService's current
selection. This preserves provider A after a later switch to provider B.

### Refill/Cancel Future Compatibility

The adapter boundary exposes operation support as capabilities rather than
requiring every provider to implement every operation. Refill, refill status,
cancel, balance, and service synchronization remain deferred, but their future
requests must use historical bindings and must not leak provider names to
customers.

### Provider Cost and Customer Price Snapshots

Order creation snapshots the resolved tenant/customer selling price and
currency, plus provider cost/currency where the existing financial model
requires it. Later provider rate synchronization changes only current offering
metadata. It never recalculates historical orders, wallet movements, or
customer charges.

### Platform, Tenant, and Customer Responsibilities

- Platform administrators own provider configuration, credentials,
  synchronization, mapping, availability, and explicit offering selection.
- Tenant administrators retain only the existing tenant-scoped commercial
  controls and cannot read provider credentials or raw infrastructure data.
- Customers select MasterServices and provider-neutral inputs only.

### Failure Scenarios

1. **No active provider offering**: reject before wallet or provider side
   effects; keep the MasterService available for later administration.
2. **Offering disabled**: fail closed with a sanitized business error.
3. **Provider service disappeared after synchronization**: mark the offering
   unavailable; do not delete MasterService or remap silently.
4. **Unsupported provider type**: reject as unsupported; never use Standard.
5. **Unknown provider type**: reject as invalid/unsupported; never infer from
   title, description, category, or provider name.
6. **MasterService disabled for tenant**: tenant-scoped lookup rejects the
   order without revealing another tenant's service.
7. **Quantity outside structured constraints**: reject before monetary writes.
8. **Custom Comments empty**: reject before monetary writes.
9. **Custom Comments below effective minimum**: reject using normalized
   quantity/comment-count constraints.
10. **Custom Comments above effective maximum**: reject using normalized
    quantity/comment-count constraints.
11. **Provider rejects order**: preserve the existing explicit rejection,
    refund, and history policy through the selected adapter.
12. **Provider timeout or ambiguous result**: retain the existing uncertain
    state and debit policy; do not retry through any provider.
13. **Mapping changes after order creation**: existing order continues with
    its historical provider binding; only new orders use the new selection.
14. **Provider rate changes after order creation**: update current offering
    facts only; preserve historical price/cost snapshots.
15. **Credentials missing**: mark the provider operation unavailable and do
    not create a provider side effect.
16. **Credentials invalid**: return a sanitized operational failure, never
    reveal the secret or raw provider response, and do not fail over.
17. **Cross-tenant service/order access**: return the existing scoped not-found
    or authorization behavior without leaking existence.

## Custom Comments Decisions Requiring Evidence

The current repository proves that order creation accepts only
`serviceId`, `target`, and `quantity`, while its BulkFollows path currently
accepts only structured `Default` records. The inspected code does not prove a
BulkFollows Custom Comments request contract, comment-count semantics, blank
line policy, trimming policy, duplicate policy, or authoritative bounds.

Therefore this specification makes the following safe design recommendation,
pending provider-contract approval:

- customer-facing input should be target plus comments, not a blindly required
  quantity;
- internal canonical input should be an ordered list of validated comment
  strings plus the normalized target;
- blank-line handling, trimming, duplicate allowance, maximum size, and
  quantity/comment-count semantics must be explicit in the selected offering's
  normalized contract;
- if the provider contract defines quantity as comment count, effective
  quantity is derived after normalization and is the quantity used for bounds,
  pricing, wallet debit, and the private order snapshot;
- if the provider contract requires an independent quantity, it must be
  provided and validated; the backend must not derive or invent it;
- if neither interpretation is proven by structured provider metadata, the
  offering is not purchasable.

Until that evidence is approved, no implementation may silently choose between
entered and derived quantity.

## Conflicts, Risks, and Decisions Requiring Approval

### Conflicts and risks discovered

1. `MasterService.provenanceRef` currently encodes one provider relationship,
   while the goal requires many provider offerings. Treating it as the new
   routing source would lose multi-provider capability.
2. `OrdenProveedor` is currently one-to-one and stores provider origin as a
   string. It lacks a stable offering/provider-service foreign-key snapshot.
3. `Orden.cantidad` remains the effective quantity whenever the normalized
  contract makes it deterministic. A private structured input snapshot can
  preserve comments and optional direct quantity without making the existing
  field nullable solely for Custom Comments.
4. Current public catalog and order repository logic reads BulkFollows raw JSON
   for bounds and metadata. Removing that path immediately risks breaking
   existing services; a compatibility normalizer and staged migration are
   required.
5. Current `OrderService` owns BulkFollows submission and status mapping. A
   provider adapter extraction must preserve ambiguous-outcome, idempotency,
   refund, and monotonic-status behavior.
6. The exact BulkFollows Custom Comments contract and its min/max semantics are
   not established by the inspected code. Implementation must not assume that
   comments count, quantity, or provider field names are interchangeable.
7. The repository has a historical Feature 010 sequencing gap while Features
   011 and 012 already exist. This spec uses 013 to avoid modifying existing
   feature artifacts.

### Proposed minimal data-model evolution

- Preserve `MasterService`, `ProviderService`, `TenantServiceOverride`,
  `Orden`, and `OrdenProveedor` as the existing domain records.
- Add one private MasterService-to-ProviderService offering association with
  normalized capability, availability, and explicit manual selection.
- Add nullable historical offering/provider-service/capability snapshot linkage
  to `OrdenProveedor` while retaining legacy provider fields.
- Add a structured private order-input snapshot capable of target, optional
  quantity, and comments while preserving existing Standard quantity data.
- Keep `MasterService.provenanceRef` and existing raw ProviderService payloads
  for migration/backward compatibility; the explicit offering relation is
  authoritative for new orders.
- Add a provider registry only if adapter/configuration lookup cannot safely
  use the existing provider-origin value.

### Decisions requiring human approval before planning

1. The authoritative BulkFollows Custom Comments input contract, including
  whether quantity is required or derived, what min/max measure applies,
  blank-line and trimming behavior, duplicate policy, pricing quantity, and
  the exact provider field names.
2. The exact schema placement and field shape of the preferred private
  structured JSON order-input snapshot on existing persistence, subject to
  preserving deterministic `Orden.cantidad` and historical compatibility.

## Stop Conditions

Stop implementation without proceeding if any proposed change would:

- modify Feature 012 or redesign the frontend;
- expose provider infrastructure to a customer or tenant API;
- require a live provider request or real order;
- silently choose, fail over, or retry another provider;
- infer capability from title/description text;
- reinterpret or delete historical provider/order data;
- bypass existing tenant, role, wallet, idempotency, or authentication
  boundaries.
