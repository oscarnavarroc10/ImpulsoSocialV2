# Tasks: Customer Order Read API

**Scope**: Implement only T001–T004. Do not execute Spec Kit commands or begin
provider status synchronization.

- [ ] **T001 — DTO contract**: Add validated `page`, `limit`, and optional
  `status` query DTOs plus paginated response DTOs; document every existing
  `EstadoOrden` value — `application/dto/order.dto.ts`

- [ ] **T002 — Scoped read flow**: Add safe repository/service list and detail
  methods and guarded `GET /v1/orders` plus `GET /v1/orders/:id`; scope every
  query by principal tenant/user, use `creadaEn DESC, id DESC`, and return
  uniform 404 — `order.repository.ts`, `order.service.ts`,
  `order.controller.ts`

- [ ] **T003 — Focused proof**: Extend the existing order unit/contract specs to
  prove tenant/user isolation, pagination, filter, stable order, uniform 404,
  recursive private-field exclusion, zero provider calls/writes, Swagger, and
  unchanged POST behavior — existing two order spec files only

- [ ] **T004 — Validation and stop**: Run build, focused ESLint, and the three
  focused order suites from `plan.md`; run the full Jest suite only after they
  pass; mark T001–T004 complete, report exact files/counts, and stop.

## Definition of Done

- Both GET endpoints are authenticated and tenant/user isolated.
- Pagination/filtering are validated and stable.
- Only the approved safe order fields are returned.
- No provider or money operation occurs.
- Existing order creation remains unchanged.
- No migration, dependency, extra module, or unrelated edit exists.

