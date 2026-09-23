# Feature 014 Planning Validation Guide

This guide is for the future implementation and review of Feature 014. It intentionally uses no SMMGEN credentials, live URL, network access, real provider order, provider balance, or production database.

## Prerequisites

- Node.js and the repository's backend dependencies installed.
- A disposable MariaDB/MySQL test database only for existing integration tests.
- Sanitized SMMGEN-shaped fixtures and fake catalog/order transports supplied by tests.
- No `SMMGEN_API_KEY` is required for the fixture suite; tests must prove that missing credentials do not create a live request.

## Focused Checks

From `backend/` after implementation:

```sh
npm test -- --runInBand test/unit/catalog/capability-normalizer.spec.ts test/unit/orders/canonical-order-input.spec.ts test/unit/orders/historical-binding.spec.ts
npm test -- --runInBand test/unit/orders/order.service.spec.ts test/unit/orders/bulkfollows-order.adapter.spec.ts
npm test -- --runInBand test/contract/catalog/bulkfollows-client.spec.ts test/contract/orders/bulkfollows-order.client.spec.ts
npm test -- --runInBand test/integration/catalog/sync-idempotency.spec.ts test/integration/catalog/provider-replacement.spec.ts
npm run build
npm run lint -- --no-fix
```

The exact new SMMGEN test paths should follow the existing catalog/order naming and use fake transports; no test may invoke the default network transport.

## Required Fixture Scenarios

1. `Default` with valid structured metadata normalizes to Standard; order input maps `link` from target and `quantity` from quantity.
2. `Custom Comments`, unknown types, malformed types, contradictory bounds, missing type, and invalid identifiers remain unsupported and produce no wallet, order, or provider side effect.
3. A selected available Standard offering executes through one fake adapter attempt and preserves the existing `[serviceId, target, quantity]` fingerprint.
4. Accepted, rejected, and uncertain fake results preserve existing order and refund behavior; uncertain results never become success and never retry.
5. Offering A is used by an accepted order, then selection changes to B; status and compatibility operations still resolve A.
6. A complete successful catalog fixture reconciles disappeared offerings to unavailable. Failed, malformed, partial, timed-out, and uncertain fixtures leave prior availability unchanged.
7. Two tenants verify catalog, price, order, and configuration isolation. Public responses contain no SMMGEN identity, external IDs, costs, raw payloads, credentials, or routing state.
8. Existing BulkFollows Standard, Custom Comments rejection, wallet/refund, idempotency, and public catalog tests remain green.

## Completion Gate

A reviewer can validate the fixture-only Standard catalog-to-order flow in under five minutes. Before implementation is accepted, `npm run build`, focused tests, the full backend test suite, and `git diff --check` must pass. No migration is expected; if schema verification discovers a missing field, stop and document a separate additive migration decision instead of editing Feature 013.

## Implemented Fixture Path

From `backend/`, with `SMMGEN_API_KEY`, `SMMGEN_API_URL`, and provider credentials unset:

```sh
PATH=/opt/homebrew/bin:$PATH npm test -- --runInBand test/unit/catalog/smmgen-capability-normalizer.spec.ts test/unit/orders/smmgen-order.adapter.spec.ts
```

The tests inject recorded response transports and never call the default network transport. A five-minute review path is: normalize the sanitized `Default` fixture, verify the `Custom Comments` fixture is unsupported, submit a Standard request through the fake adapter, inspect the sanitized outcome, and run the complete-snapshot reconciliation tests. `CATALOG_PROVIDER_ORIGIN=smmgen` selects the backend client only for an explicitly configured local test process; it does not provide credentials or enable production routing.
