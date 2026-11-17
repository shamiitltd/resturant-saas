# Phase C — Customer QR Menu & Ordering Vertical Slice Plan

## 1. Scope & Business Invariants
- **Vertical Slice**: Customer QR token resolution -> digital menu browsing -> modal item customizer with modifiers -> cart & checkout -> server-side atomic price calculation & idempotent order placement -> live order status tracking with reconnect recovery.
- **Table Session Invariant**: One active `table_session` groups multiple independent customer orders (`orders` and `order_items`). Consolidated billing remains the default for the session. No split billing.
- **Zero Client Trust**: Browser-supplied prices, totals, taxes, discounts, `tenant_id`, `location_id`, or `table_id` are never trusted. All resolved server-side from the high-entropy QR token and current database pricing snapshots.

## 2. Full-Stack Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE C: CUSTOMER ORDERING VERTICAL SLICE                │
├───────────────────────┬───────────────────────────────┬─────────────────────┤
│   Next.js Frontend    │          NestJS API           │     Supabase DB     │
│      (apps/web)       │          (apps/api)           │     (PostgreSQL)    │
├───────────────────────┼───────────────────────────────┼─────────────────────┤
│ • /table/[qrToken]    │ • POST /v1/public/table/      │ • 20261117000003_   │
│   (QR landing & resol)│   resolve-qr                  │   customer_ordering │
│ • /menu (01-menu.png) │ • GET /v1/public/menu/        │ • restaurant_tables │
│ • Food details modal  │   {tenantSlug}                │ • qr_tokens         │
│   (02-details.png)    │ • POST /v1/customer/orders    │ • table_sessions    │
│ • Cart & checkout     │   (Idempotency + Price recalc)│ • menu_categories   │
│   (03-checkout.png)   │ • GET /v1/customer/orders/:id │ • menu_items        │
│ • Order tracking      │ • GET /v1/customer/sessions/  │ • modifier_groups   │
│   (04-tracking.png)   │   :token/orders (All session) │ • orders            │
│ • Realtime reconnect  │ • Notification outbox event   │ • order_items       │
└───────────────────────┴───────────────────────────────┴─────────────────────┘
```

## 3. Execution Sequence
1. Database Schema (`supabase/migrations/20261117000003_customer_ordering.sql` & `seed.sql` update).
2. Shared Contracts (`packages/contracts/src/order.dto.ts`, `menu.dto.ts`).
3. Backend NestJS Modules (`MenuModule`, `TableSessionModule`, `OrderModule` with atomic transactional checkout and idempotency lock).
4. Automated Unit & Integration Tests (Price tampering rejection, duplicate submission idempotency, invalid modifier rejection, multiple orders per session).
5. Frontend Next.js Screens (`01-customer/01-customer-menu-desktop.png`, `02-food-details-desktop.png`, `03-cart-checkout-desktop.png`, `04-order-tracking-desktop.png`).
6. Monorepo Turborepo Build & End-to-End Verification.
