# Quickstart: Customer Dashboard and Order Experience

## Prerequisites

- Node.js and npm installed.
- Backend database configured according to the repository README.
- `DEFAULT_TENANT_SLUG` points to an active tenant with at least one visible catalog service.
- Provider configuration is available for order creation tests.
- A customer account with a wallet exists, or the test explicitly covers missing-wallet behavior.

## Start the applications

From the repository root:

```bash
cd backend
npm install
npm run start:dev
```

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open the frontend URL printed by Angular.

## Validation scenarios

1. **Authentication and route guard**
   - Open `/cuenta` while signed out.
   - Confirm the existing guard routes to `/login` with a safe return URL.
   - Sign in and confirm `/cuenta` loads the authenticated shell.
   - Log out and confirm the protected route is no longer accessible.

2. **Contract-backed service browsing**
   - Open Servicios from `/cuenta`.
   - Confirm the initial choices are the real platforms from `facets.platforms`, with no typed network or category-ID input.
   - Select a platform, then a commercial category from `facets.categories`, and confirm services are requested with the corresponding internal filters.
   - Confirm displayed service identity, current category name/description, network, description, price, quantity bounds, and pagination match `GET /v1/catalog/services`.
   - Verify facets include eligible services outside the current page and counts exclude hidden or tenant-disabled services.
   - Use an empty catalog and a failed request to verify distinct empty and unavailable states.
   - Confirm no provider payload or fabricated service is shown.

3. **New order and idempotency**
   - Select a real catalog service and enter an HTTPS target plus an integer quantity.
   - Verify local target/quantity validation and the server-backed price display.
   - Submit with one idempotency key and confirm the returned order.
   - Repeat the same confirmation/key and verify replay behavior rather than a duplicate order.
   - Simulate a 202 response and confirm the UI says pending/unconfirmed rather than completed.
   - Test insufficient balance, unavailable provider, invalid target, and out-of-range quantity as friendly recoverable errors.

4. **Orders**
   - Open Mis órdenes and verify `GET /v1/orders` results belong to the authenticated customer and active tenant.
   - Test no orders, failed loading, pagination, and status filter behavior.

5. **Wallet**
   - Open Mi saldo and verify the integer amount/currency from `GET /v1/wallet`.
   - Verify `GET /v1/wallet/movements` history and pagination.
   - Test missing wallet and empty movements separately; never display missing balance as zero.

6. **Account and support gaps**
   - Verify profile shows only fields from the auth response.
   - Verify no unverified profile endpoint is called.
   - Verify support uses a verified tenant configuration when available, otherwise shows the honest unavailable state.

7. **Session persistence**
   - Sign in with “Mantener mi sesión iniciada” unchecked and restart the browser context.
   - Sign in with it checked and restart the browser context.
   - Verify both behaviors use the existing refresh, rotation, logout, guard, interceptor, and clear-session flow.
   - Confirm logout clears every credential storage location selected by the implementation.

8. **Responsive and localization checks**
   - Check 320x568, 768x1024, and 1440x900 at 200% zoom.
   - Repeat key screens in `es-MX` and `en`, light and dark themes.
   - Verify keyboard focus, labels, errors, loading announcements, and no overlapping navigation.

## Automated checks

From `frontend`:

```bash
npm test -- --watch=false
npm run build
```

From the repository root:

```bash
git diff --check
```

Backend contract and integration tests should cover tenant/user isolation, order idempotency, wallet ownership, refresh rotation, and friendly error mapping before implementation is considered complete.
