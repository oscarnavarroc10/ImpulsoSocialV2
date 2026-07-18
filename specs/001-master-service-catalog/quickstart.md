# Quickstart: Validate Master Catalog end-to-end

Prerequisites: Platform dev environment, access to secure provider credentials for BulkFollows, and a test tenant.

Steps:

1. Run an on-demand provider sync (or simulate with sample provider payloads). Verify the job completes.
2. Inspect the staging area and review a sample staged service. Approve one service into the master catalog.
3. Set `Default Selling Price` for the approved master service and verify `Provider Cost` is stored.
4. Publish a master snapshot for a test market/tenant.
5. Request an export of the published snapshot and validate the exported JSON contains master entries, correct sellingPrice fields, and no `providerId` or `rawPayload`.
6. Generate a tenant catalog from the snapshot and verify that the tenant inherits the `Default Selling Price`. Optionally set a Tenant Selling Price override and confirm generated catalog reflects the override.
7. Verify audit logs contain entries for import, approval, publish, and export actions with actor and timestamp.

Expected outcomes: Services are ingested, curated, published, and exported according to spec constraints; monetary values are accurate and tenant overrides apply as expected.
