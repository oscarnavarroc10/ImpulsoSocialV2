# Customer Catalog Capability Contract

## Scope

Additive extension to the existing versioned public catalog contract. Customers continue selecting a `MasterService` and never select a provider, offering, provider service ID, or routing policy.

## Safe capability projection

When a tenant-eligible MasterService has a valid selected offering, the API may expose a normalized capability projection:

```json
{
  "capability": "STANDARD",
  "input": {
    "target": "required",
    "quantity": "required"
  },
  "quantity": { "min": 100, "max": 10000 }
}
```

For unresolved or unsupported Custom Comments, the service must be non-orderable. It must not expose provider type codes, provider origin, external IDs, provider cost, raw payload, credentials, or routing configuration. The exact DTO field names remain subject to existing API naming conventions during implementation.
The implementation projects capability data only from a valid selected offering. Offering IDs,
provider identity, routing state, provider costs, raw payloads, credentials, and private snapshots
remain internal and are excluded from the customer contract.

## Compatibility

Existing fields `id`, curated copy, category/network, selling price, `minQuantity`, `maxQuantity`, and safe service metadata remain stable. Capability is optional and additive. Provider disappearance may remove order eligibility or capability projection but must not remove the MasterService identity from internal data or future Favorite references.

## Error behavior

Unsupported, unknown, unavailable, or ambiguously selected offerings return the existing sanitized business error behavior. No provider-specific error body crosses the public boundary.
