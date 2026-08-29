# Feature Specification: Customer Order Read API

**Feature Branch**: `feature/005-order-status`  
**Status**: Approved — optimized first slice

## Goal

Let an authenticated customer list and inspect only their own local orders. This
slice exposes the order status already stored by Feature 004. It performs no
BulkFollows request and no monetary write.

## Public API

### List customer orders

```http
GET /v1/orders?page=1&limit=20&status=enviadaProveedor
Authorization: Bearer <access-token>
```

Response:

```json
{
  "items": [
    {
      "id": "cm...",
      "serviceId": "cms...",
      "target": "https://www.instagram.com/example/",
      "quantity": 1000,
      "totalPrice": { "amount": 15000, "currency": "MXN" },
      "status": "enviadaProveedor",
      "createdAt": "2026-08-29T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Get one customer order

```http
GET /v1/orders/:id
Authorization: Bearer <access-token>
```

Returns the same safe order shape. A nonexistent order or an order belonging to
another user or tenant returns the same HTTP 404 response.

## Requirements

- **FR-001**: Both endpoints MUST reuse `OrderAuthenticationGuard`; tenant and
  user come only from the verified principal.
- **FR-002**: Every repository query MUST include both `tiendaId` and
  `usuarioId`.
- **FR-003**: List pagination uses `page=1`, `limit=20`, maximum `limit=100`.
  Invalid values return HTTP 400.
- **FR-004**: Optional `status` accepts only an existing `EstadoOrden` value.
- **FR-005**: Results are ordered by `creadaEn DESC`, then `id DESC`.
- **FR-006**: The response may contain only `id`, `serviceId`, `target`,
  `quantity`, `totalPrice`, `status`, and `createdAt`, plus list pagination.
- **FR-007**: Responses MUST NOT expose provider identity/order ID, provider
  cost/currency, request payload/response, `idempotencyKey`,
  `requestFingerprint`, error internals, wallet data, or history rows.
- **FR-008**: Existing `POST /v1/orders` behavior and tests MUST remain
  unchanged.
- **FR-009**: Swagger MUST document bearer authentication, query parameters,
  response DTOs, HTTP 200/400/401, and detail HTTP 404.

## Acceptance Scenarios

1. A customer with several orders receives only orders matching their persisted
   tenant and user.
2. Pagination and an optional exact status filter return the correct total and
   stable order.
3. Accessing another customer's or tenant's order returns 404 without revealing
   that it exists.
4. Recursive response assertions find none of the forbidden private fields.
5. No list/detail request calls BulkFollows or changes orders, wallet balances,
   movements, histories, or sessions.

## Out of Scope

- `action=status` or any BulkFollows status request.
- Status mutation, polling, cron, reconciliation, refunds, refill, cancellation.
- Wallet endpoints, deposits, admin operations, schema changes, or migrations.
- Order history rows, provider records, frontend work, or refactoring auth.

Provider refresh will be added only after the exact authenticated BulkFollows
status contract is supplied. It must not be guessed in this slice.

