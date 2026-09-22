# Data Model: Customer Dashboard and Order Experience

## Customer session

- **Source**: Existing auth response and frontend `SessionState`.
- **Fields**: `usuario.id`, `usuario.tiendaId`, `usuario.nombre`, `usuario.email`, `usuario.rol`, `accessToken`, `refreshToken`.
- **Lifecycle**: login/register creates a session; refresh rotates the refresh token; logout revokes the active refresh session; refresh failure clears local credentials.
- **Persistence preference**: Existing storage boundary plus a boolean login preference. The plan must preserve tenant namespacing and clear all credential stores on logout/failure.

## Catalog service

- **Source**: `GET /v1/catalog/services` and `GET /v1/catalog/services/:id`.
- **Fields**: `id`, `title`, `description`, `socialNetwork`, internal `categoryId`, commercial `category.id/name/description`, `sellingPrice.amount`, `sellingPrice.currency`, `minQuantity`, `maxQuantity`.
- **Relationships**: Tenant-resolved public visibility; order creation references `serviceId`.
- **Catalog facets**: The same response provides tenant-scoped platform facets and platform-category facets with service counts calculated across all eligible services, independently of the current page.
- **Validation**: Only services returned by the public catalog can be selected. No provider payloads are exposed.
- **Customer navigation**: The UI selects platform and category from facets, then requests services with internal exact filters. It never asks the customer to type a social network or category ID and does not infer categories from service copy.

## Customer order

- **Source**: `GET /v1/orders`, `GET /v1/orders/:id`, `POST /v1/orders`.
- **Fields**: `id`, `serviceId`, `target`, `quantity`, `totalPrice.amount`, `totalPrice.currency`, `status`, `createdAt`.
- **Create input**: `serviceId`, `target` URL, integer `quantity`, required `Idempotency-Key` header.
- **Relationships**: Owned by authenticated `userId` and `tenantId`; linked to a local service and wallet charge.
- **State handling**: 201/200 can represent a created or replayed result; 202 represents an accepted/unknown provider submission and must remain visibly pending/unconfirmed.

## Wallet balance

- **Source**: `GET /v1/wallet`.
- **Fields**: `balance.amount`, `balance.currency` in integer minor units.
- **Validation**: Missing wallet is unavailable; zero is distinct from missing.
- **Relationship**: Scoped to authenticated `userId`, `tenantId`, and tenant currency.

## Wallet movement

- **Source**: `GET /v1/wallet/movements`.
- **Fields**: `id`, `type`, `amount`, `balanceAfter`, `description`, `createdAt`, pagination.
- **Validation**: Use server-provided integer amounts and currency; do not recompute financial history in the frontend.

## Account summary

- **Source**: `usuario` in the existing auth response.
- **Fields available**: ID, tenant ID, name, email, role.
- **Known limitation**: No separate account/profile retrieval contract was verified. Additional profile data must be unavailable rather than fabricated.

## Tenant support configuration

- **Intended source**: Existing tenant-aware configuration only if a verified contract supplies support data.
- **Current verified fields**: No backend support fields/DTO/controller were found.
- **UI state**: `configured` only when real support configuration is supplied; otherwise `unavailable`.

## UI resource state

Every remote customer resource uses one of:

- `loading`
- `ready` with verified data
- `empty` with a successful response containing no items
- `unavailable` with a recoverable error or missing verified contract
- `submitting` for order creation
- `pending` when order creation returns an unknown/202 state

Raw backend errors are mapped to translated customer-facing messages.
