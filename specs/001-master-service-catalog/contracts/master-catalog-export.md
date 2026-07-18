# Contract: Master Catalog Export (summary)

Purpose: Define the contract used by tenant-generation pipelines to consume a published master snapshot.

Producer: Catalog service (platform backend)
Consumer: Tenant catalog generator (internal service)

Input: Request for a published snapshot ID or the latest published snapshot for a market/tenant.

Output: JSON document containing an array of `MasterService` entries with the following fields per entry (tenant-sensitive overrides applied by snapshot generation):

- `masterId` (string)
- `title` (string)
- `description` (string)
- `categories` (array of category objects: id, name)
- `socialNetworks` (array of strings)
- `sellingPrice` (object: amount_minor, currency)
- `status` (string)

Exclusions: The export MUST NOT include `providerId`, `rawPayload`, or any provider-only metadata.

Versioning: The contract is versioned; snapshots include a `contractVersion` field. Breaking changes require a new contract version and migration strategy.

Errors: Standardized error model with `code`, `message`, and `details`.

Security: Only authorized internal consumers (tenant pipelines) may request exports; exports are signed or produced into secured storage accessible by consumers.
