# Implementation Plan: Customer Dashboard and Order Experience

**Branch**: `012-customer-dashboard-orders` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-customer-dashboard-orders/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Extend the existing authenticated Angular `/cuenta` shell into a customer area that consumes the verified tenant-aware catalog, order, and wallet contracts. Reuse the existing auth lifecycle, guards, interceptor, refresh rotation, translations, themes, and responsive white-label architecture. Keep missing profile/support/quantity-bound data honest unless a separately approved backend capability is required.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript strict mode; Angular 22 standalone frontend; NestJS backend; Prisma/MySQL persistence

**Primary Dependencies**: Angular Router/HttpClient/Reactive Forms, Transloco, RxJS, NestJS, class-validator, Swagger, Prisma; no new major dependency planned

**Storage**: Existing MySQL/Prisma domain tables; tenant-namespaced browser session storage currently uses `sessionStorage`

**Testing**: Existing Angular Vitest test builder; backend Jest unit/contract/integration tests; manual responsive/browser validation from quickstart

**Target Platform**: Responsive browser application and existing NestJS API

**Project Type**: Full-stack web application with tenant-aware API

**Performance Goals**: Preserve existing endpoint pagination and avoid loading unbounded services, orders, or wallet movements; customer navigation should remain responsive on supported mobile and desktop viewports

**Constraints**: No provider calls from frontend; no fabricated financial/catalog data; preserve tenant/user scoping, refresh rotation, logout revocation, idempotent order creation, friendly translated errors, and 200% zoom accessibility

**Scale/Scope**: One authenticated customer area with dashboard, catalog, new order, orders, wallet, support, profile summary, and login persistence option; Google/Apple remain out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Specification before implementation**: PASS. Approved scope is defined in `spec.md`; no production implementation is part of this plan.
- **II. Human architecture decisions**: PASS. Plan reuses Angular/Nest/Prisma patterns and does not add a framework, provider, microservice, or new auth system. Any approved backend gap will be explicitly documented before implementation.
- **III. Tenant isolation**: PASS. Existing catalog resolves the configured tenant; order and wallet guards scope by authenticated `tenantId` and `userId`. Tests must preserve these filters.
- **IV. White-label configuration**: PASS. Runtime tenant config, theme, locale, support availability, and existing visual language remain the source of presentation configuration.
- **V/VI. Local curated catalog**: PASS. Frontend consumes only the local public catalog; provider payloads remain backend-only. Quantity-bound gap is recorded, not fabricated.
- **VII. Secure provider integration**: PASS. No frontend provider access is planned.
- **VIII. Financial/order integrity**: PASS. Use integer minor units, server price/balance, existing idempotency key, 201/200/202 semantics, and no blind retries after unknown provider result.
- **IX. API compatibility**: PASS with verification gate. Existing DTOs and Swagger-decorated routes are authoritative; no new endpoint is assumed. Any approved capability addition must update DTO, Swagger, contract tests, and migration strategy.

## Project Structure

### Documentation (this feature)

```text
specs/012-customer-dashboard-orders/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   └── modules/
│       ├── auth/
│       ├── catalog/
│       ├── orders/
│       └── wallets/
└── test/
  ├── contract/
  ├── integration/
  └── unit/

frontend/
├── src/
│   └── app/
│       ├── core/auth/
│       ├── core/config/
│       ├── features/account/
│       ├── features/auth/
│       ├── features/services/
│       ├── layouts/
│       └── shared/
└── public/
  ├── config/
  └── i18n/
```

**Structure Decision**: Extend the existing `frontend/src/app/features/account` area with lazy child routes and typed HTTP services for verified backend contracts. Add only the smallest backend changes required by an explicitly approved gap; otherwise render unavailable states. Keep auth behavior in `frontend/src/app/core/auth`, domain API modules aligned with `backend/src/modules/{catalog,orders,wallets}`, and contract tests under existing backend/frontend test locations.

## Phase 0: Research findings and implementation gates

1. Verify the contract inventory in [research.md](research.md) against current controller, DTO, guard, repository, and frontend implementation before coding.
2. Treat these as explicit gaps: public quantity bounds, customer profile retrieval beyond auth response, and tenant support configuration.
3. For each gap, choose only after product/architecture approval between an existing verified source, an approved backend contract addition, or an honest unavailable state. Do not invent DTOs or routes in implementation.
4. Confirm session-persistence policy before changing storage. Preserve refresh rotation, clear-session, logout revocation, and interceptor retry semantics.

## Phase 1: Design decisions

- Model remote resources with explicit loading/ready/empty/unavailable/submitting/pending states.
- Use server integer amounts and currencies for all price/balance displays; avoid frontend financial recomputation beyond presentation of a confirmed server total.
- Generate a unique valid `Idempotency-Key` for a new order and disable repeated submit while pending. Do not automatically retry a request whose result is unknown.
- Keep `/cuenta` protected by `authGuard`; use nested lazy routes for `resumen`, `nueva-orden`, `ordenes`, `servicios`, `saldo`, `soporte`, and profile/logout controls only where the route behavior is approved.
- Translate errors by stable frontend error categories, never raw backend messages.

## Phase 2: Implementation sequence

1. Normalize BulkFollows taxonomy at backend import/staging before customer-facing curation; resolve canonical categories idempotently and publish only supported normalized platforms.
2. Add typed frontend API adapters for catalog, orders, and wallet based exactly on [contracts/customer-api.md](contracts/customer-api.md), with tenant/auth interceptor reuse.
2. Replace placeholder `/cuenta` cards and links with real summary/catalog/order/wallet states and lazy child screens; preserve existing theme, locale, icons, and responsive SCSS.
3. Add the new-order form using public catalog service selection, target URL, integer quantity, server-confirmed price, client-side validation, idempotency header, and 201/200/202 handling.
4. Add orders and wallet list/balance screens with ownership-safe empty/unavailable states and pagination.
5. Resolve the three documented gaps explicitly before implementation of dependent UI: quantity bounds, account profile retrieval, and tenant support configuration. If no approved capability is added, keep the corresponding UI honest and unavailable.
6. Extend login with the optional persistence choice only after confirming storage/security behavior; test browser restart, refresh rotation, logout, and refresh failure.
7. Add/extend backend and frontend contract, unit, integration, and component tests for tenant/user isolation, idempotency, financial display, error mapping, and responsive/accessibility states.

## Validation gates

- No implementation starts until the gap decisions and persistence policy are approved.
- Before completion, run frontend tests/build, backend contract/integration tests, `git diff --check`, and the manual scenarios in [quickstart.md](quickstart.md).
- Constitution Check must be repeated after Phase 1 design; any backend contract addition must be documented and reviewed as an architectural/API change.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | No constitution violations identified. |
