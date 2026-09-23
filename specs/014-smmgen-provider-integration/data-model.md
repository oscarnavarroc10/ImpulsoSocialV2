# Feature 014 Data Model

## Existing Records Reused

| Record                          | Feature 014 use                                                                                                                                 | Privacy / mutation rule                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ProviderService`               | One SMMGEN service keyed by `providerOrigin = smmgen` and private external ID. Store sanitized structured source facts in existing JSON fields. | Never expose provider origin, external ID, raw payload, or rate publicly. Upsert is idempotent by `(providerOrigin, externalId)`. |
| `MasterService`                 | Stable local commercial identity selected by customers.                                                                                         | SMMGEN metadata never overwrites curated title, description, category, visibility, or tenant price.                               |
| `MasterServiceProviderOffering` | Explicit SMMGEN-to-MasterService mapping, normalized capability contract, enablement, availability, and selection.                              | Multiple mappings are allowed; at most one selected offering is used for new orders. No automatic matching.                       |
| `TenantServiceOverride`         | Existing tenant enablement and selling price projection.                                                                                        | Provider replacement does not duplicate or bypass tenant configuration.                                                           |
| `Orden`                         | Existing customer price, effective quantity, state, idempotency key/fingerprint, and private input snapshot.                                    | Preserve Standard fingerprint and wallet transaction semantics. Public DTOs remain provider-neutral.                              |
| `OrdenProveedor`                | Historical SMMGEN origin, external order ID, offering/provider-service IDs, capability/version snapshots, request/response private records.     | Resolve later status/compatibility operations from this binding; never follow current selection.                                  |
| `HistorialOrden`                | Existing lifecycle audit trail for accepted, rejected, uncertain, status, and refund transitions.                                               | Store sanitized origins/statuses only.                                                                                            |
| `SyncJob`                       | Existing synchronization lifecycle and sanitized summary.                                                                                       | Failed or incomplete sync cannot trigger mass disappearance disablement.                                                          |

## Normalized Capability

`Default` becomes:

```text
capabilityKey: STANDARD
contractVersion: smmgen-default-v1
requiredFields: [target, quantity]
quantityMode: required
targetKind: link
min/max: verified positive safe integers
supportedOperations: [create, status]
validationStatus: supported
```

`Custom Comments` becomes `CUSTOM_COMMENTS` with `validationStatus: unsupported` until a future approved contract defines quantity, pricing, bounds, canonical comments, and exact request fields. Unknown, malformed, contradictory, or incomplete types are unsupported and cannot be selected for purchase.

## State Rules

1. A service may be imported and normalized without being mapped to a local `MasterService`.
2. A mapped offering is orderable only when it is enabled, available, selected, tenant-eligible, and has a supported Standard contract.
3. A complete successful SMMGEN snapshot marks absent offerings unavailable. No incomplete or uncertain snapshot changes disappearance state.
4. Selection changes affect new orders only.
5. Accepted orders retain private offering/provider/capability snapshots even if current offering metadata changes or disappears.
6. Accepted/rejected/uncertain provider results use the existing order state and wallet/refund policies; no retry or alternate offering is attempted.

## No Schema Change

No new entity, field, enum, index, or migration is required. `backend/prisma/schema.prisma` already provides provider-origin uniqueness, offering selection/availability, historical provider/offering/capability snapshots, private order input, idempotency, status history, and sync jobs. The Feature 013 migration `backend/prisma/migrations/20260922190000_add_provider_agnostic_offerings` must remain untouched. A discovered persistence gap requires a separately approved additive migration decision before implementation.
