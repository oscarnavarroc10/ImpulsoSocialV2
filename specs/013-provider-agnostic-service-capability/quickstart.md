# Feature 013 Planning Validation Guide

This guide defines implementation-time validation scenarios. It does not authorize schema changes, migrations, provider calls, or application implementation during planning.

## Prerequisites

- Node.js and repository dependencies installed.
- A disposable local MySQL/MariaDB test database configured through the existing backend test setup.
- No provider credentials required. Use fake catalog/order transports and fixtures.
- Do not populate or print `.env` secrets.

## Phase checks

### 1. Schema and migration safety

Run from `backend/` after implementation:

```sh
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

Expected: additive schema applies to a disposable database; existing `provenanceRef`, Standard orders, `OrdenProveedor` rows, and tenant overrides remain readable.

### 2. Capability normalization

```sh
npm test -- --runInBand test/contract/catalog/bulkfollows-client.spec.ts test/unit/catalog
```

Expected: verified BulkFollows `Default` maps to `STANDARD`; malformed/unknown types fail closed; no test fixture performs HTTP. Custom Comments remains unsupported without verified contract evidence.

### 3. New-order resolution

```sh
npm test -- --runInBand test/unit/orders/order.service.spec.ts test/contract/orders
```

Expected: selected platform-global offering is used; absent/disabled/unavailable/ambiguous offering fails before wallet/provider side effects; concurrent selection changes never leave more than one `isSelected = true` offering per MasterService; no failover occurs; Standard pricing and the existing Standard request fingerprint representation remain unchanged.

### 4. Historical routing and dynamic idempotency

Add focused fixtures for provider A -> provider B selection change and replay:

- Existing order status lookup continues to use provider A.
- New order uses provider B only after explicit selection.
- Same idempotency key plus changed target, capability, comments, or effective quantity conflicts.
- Existing Standard requests continue to use the pre-feature fingerprint representation; dynamic normalized inputs use a versioned canonical representation only for capabilities that define those inputs.
- Same canonical dynamic input replays without a second provider attempt.
- Unknown provider result remains uncertain and is never retried through another provider.

### 5. Public contract and tenant isolation

```sh
npm test -- --runInBand test/contract/catalog/public-catalog.controller.spec.ts test/unit/catalog/public-catalog.service.spec.ts
```

Expected: only MasterService identity, curated metadata, commercial price, and safe normalized capability fields are visible. Provider origin, external IDs, costs, raw payloads, credentials, offering IDs, and routing state are absent. Tenant enablement and price remain scoped.

## Completion gate

Implementation is not complete until focused tests, full backend tests, migration verification, and `git diff --check` pass. Live BulkFollows/SMMGEN calls, real orders, credential inspection, Favorites, provider Admin UI, tenant-specific routing, and Feature 012 UI changes are prohibited.
