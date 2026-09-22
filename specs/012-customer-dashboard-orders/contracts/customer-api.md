# Customer API Contract Inventory

This document records verified existing contracts used by the customer experience. It is an inventory, not authorization to create new endpoints.

## Authentication

- `POST /auth/login`
  - Request: `{ email, password }`
  - Response: `{ usuario: { id, tiendaId, nombre, email, rol }, accessToken, refreshToken }`
- `POST /auth/register`
  - Request: `{ nombre, email, password }`
  - Response: same auth response shape.
- `POST /v1/auth/refresh`
  - Request: `{ refreshToken }`
  - Response: `{ accessToken, refreshToken }`
  - Security: refresh-token rotation and session validation.
- `POST /v1/auth/logout`
  - Request: `{ refreshToken }`
  - Response: `204`; active matching session is revoked.

## Public catalog

- `GET /v1/catalog/services?page&limit&socialNetwork&categoryId`
  - Response: `{ items, facets, pagination }`.
  - Item: `{ id, title, description, socialNetwork, categoryId, category: { id, name, description }, sellingPrice: { amount, currency }, minQuantity, maxQuantity }`.
  - `category` is resolved from the current `Category` record through `MasterService.categoryId`; snapshots are not authoritative for this response.
  - `facets.platforms` contains `{ key, label, serviceCount }` and `facets.categories` contains `{ id, name, description, platformKey, serviceCount }`.
  - Facets are calculated from all eligible services for the configured tenant before request filters and pagination are applied. Eligibility includes active status, visibility, tenant-disabled overrides, and the applicable commercial catalog rules.
  - `socialNetwork` and `categoryId` remain supported as internal exact filters; customer UI inputs must be derived from facets and must not expose these IDs.
  - `minQuantity` and `maxQuantity` are authoritative integer response values sourced from the existing backend service/order configuration. They are documented as response fields in Swagger; they do not add request validation to this response DTO.
- `GET /v1/catalog/services/:id`
  - Response: one public catalog service.
  - The same authoritative `minQuantity` and `maxQuantity` response fields apply.

## Customer orders

All order endpoints require `Authorization: Bearer <accessToken>` and are scoped to the authenticated principal's tenant and user.

- `GET /v1/orders?page&limit&status`
  - Response: `{ items, pagination }`.
- `GET /v1/orders/:id`
  - Response: `{ id, serviceId, target, quantity, totalPrice: { amount, currency }, status, createdAt }`.
- `POST /v1/orders`
  - Required header: `Idempotency-Key` matching the existing key format.
  - Request: `{ serviceId, target, quantity }`.
  - Responses: `201` created, `200` replay/known result, or `202` provider result not yet confirmed.
  - Do not retry blindly after an unknown result.

## Customer wallet

All wallet endpoints require the same bearer authentication and tenant/user scope.

- `GET /v1/wallet`
  - Response: `{ balance: { amount, currency } }`.
- `GET /v1/wallet/movements?page&limit&type`
  - Response: `{ items, pagination }`.
  - Item: `{ id, type, amount, balanceAfter, description, createdAt }`.

## Verified gaps

- No customer profile/account GET contract was found; only auth-response user fields are available.
- No tenant support configuration contract was found.
- Public catalog category labels and tenant-aware facets are sourced from current catalog/category records; order creation remains authoritative for final quantity validation.
- No new endpoint should be added solely to satisfy a visual dashboard placeholder. Each gap must be resolved in planning by either an approved backend capability addition or an honest unavailable state.
