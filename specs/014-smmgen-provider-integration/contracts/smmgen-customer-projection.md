# SMMGEN Customer Projection

Feature 014 does not add a provider-specific public endpoint or frontend contract. Existing catalog and order contracts continue to use the local `MasterService`.

## Allowed Catalog Projection

For a tenant-eligible MasterService with one valid selected available Standard offering, the existing public catalog may expose only:

- MasterService ID, curated title/description, category, social network, visibility-derived eligibility.
- Tenant-resolved selling price and currency.
- Provider-neutral Standard capability, target requirement, quantity requirement, and verified bounds.
- Existing safe provider-neutral compatibility fields where the established contract requires them. Existing BulkFollows-only metadata helpers must not be reused to expose SMMGEN fields.

## Forbidden Projection

The following never cross the public boundary or appear in customer errors:

- SMMGEN name/origin, service ID, order ID, rate, provider cost, API URL, API key, raw payload, request/response JSON, routing/selection state, provider health, or private snapshots.
- Custom Comments fields or semantics not approved by a future specification.

An unsupported, disabled, unavailable, missing, or ambiguously selected offering is not orderable. The system returns the existing sanitized not-found/validation/unavailable behavior and does not select another provider. Custom Comments is not orderable in Feature 014.

## Authorization And Tenant Rules

Catalog and order queries retain the authenticated tenant and user filters. Platform-level curation/selection remains behind existing catalog authorization; tenant administrators do not receive credentials or provider routing controls. A cross-tenant lookup uses existing scoped not-found/authorization behavior without revealing provider existence.
