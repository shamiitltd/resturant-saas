# Phase C Independent Code, Security & Architecture Audit
**Customer QR Menu & Ordering Vertical Slice**
**Date:** November 17, 2026  
**Audit Scope:** Repository Source Code, Database Migrations, RLS Policies, API Implementation, Frontend Components, and Automated Tests.  
**Mode:** READ-ONLY Deep Inspection.

---

## 1. Executive Verdict

### **VERDICT: PASS WITH CONDITIONS**

The Phase C vertical slice successfully implements the functional customer dining journey: high-entropy QR token resolution, dynamic category/menu retrieval, food customization modal with modifier calculation, local draft cart isolation, server-side price recalculation, atomic order transaction submission, multi-order table session aggregation (ADR-003), and live order tracking with polling recovery.

However, the audit revealed **2 Critical security/architectural flaws** and **5 High/Medium gaps** that must be resolved before Phase D (Kitchen Display System & Order Lifecycle) commences. Specifically, order status endpoints lack authorization verification, table session creation contains a concurrency race condition without database unique constraints, PostgreSQL RLS policies lack tenant scoping for public catalogs and omit table policies, Supabase Realtime is non-functional over WebSocket due to missing publication configuration (relying entirely on the 5-second polling fallback), and the outbox pattern is write-only with no publisher process.

---

## 2. Verified Implementation Inventory

The following components were verified through direct line-by-line inspection of repository source files:

| Layer | Component | File Path & Verified Lines | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Database** | Core Tables (`restaurant_tables`, `qr_tokens`, `table_sessions`, `menu_categories`, `menu_items`, `modifier_groups`, `item_modifiers`, `orders`, `order_items`, `order_status_events`, `notification_outbox`) | [supabase/migrations/20261117000003_customer_ordering.sql:7-187](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L7-L187) | **Verified** |
| **Database** | Seed Data (Demo Restaurant "Spice Garden", Table "T-01", Active QR Token, Starters/Mains/Biryani categories and items) | [supabase/seed/seed.sql:1-125](file:///d:/Github/resturant_saas/supabase/seed/seed.sql#L1-L125) | **Verified** |
| **Contracts** | Shared Menu DTOs (`MenuItemDto`, `ModifierGroupDto`, `PublicMenuResponseDto`) | [packages/contracts/src/menu.dto.ts:1-47](file:///d:/Github/resturant_saas/packages/contracts/src/menu.dto.ts#L1-L47) | **Verified** |
| **Contracts** | Shared Order DTOs (`CreateCustomerOrderRequestDto`, `CustomerOrderResponseDto`, `TableSessionOrdersSummaryDto`) | [packages/contracts/src/order.dto.ts:1-75](file:///d:/Github/resturant_saas/packages/contracts/src/order.dto.ts#L1-L75) | **Verified** |
| **Backend API** | Customer Controller (`/v1/public/table/resolve-qr`, `/v1/public/menu/:tenantSlug`, `/v1/customer/orders`, `/v1/customer/orders/:orderId`, `/v1/customer/sessions/:sessionToken/orders`) | [apps/api/src/modules/customer/customer.controller.ts:1-38](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.controller.ts#L1-L38) | **Verified** |
| **Backend API** | Customer Service (QR Resolution, Menu Retrieval, Price Recalculation, Idempotency, Atomic Order Transaction, Session Aggregation) | [apps/api/src/modules/customer/customer.service.ts:1-611](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L1-L611) | **Verified** |
| **Frontend UI** | Table QR Scan Landing Page (`/table/[qrToken]`) | [apps/web/src/app/(customer)/table/[qrToken]/page.tsx:1-105](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/table/[qrToken]/page.tsx#L1-L105) | **Verified** |
| **Frontend UI** | Customer Digital Menu (`/[tenantSlug]/menu`) | [apps/web/src/app/(customer)/[tenantSlug]/menu/page.tsx:1-395](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/menu/page.tsx#L1-L395) | **Verified** |
| **Frontend UI** | Food Details & Modifiers Customization Modal | [apps/web/src/app/(customer)/components/FoodDetailsModal.tsx:1-255](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/components/FoodDetailsModal.tsx#L1-L255) | **Verified** |
| **Frontend UI** | Customer Cart & Checkout Screen (`/[tenantSlug]/cart`) | [apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx:1-321](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx#L1-L321) | **Verified** |
| **Frontend UI** | Live Order & Session Tracking Screen (`/[tenantSlug]/order/[orderId]`) | [apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx:1-342](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx#L1-L342) | **Verified** |
| **Frontend UI** | Local Draft Cart & Table Session State Provider | [apps/web/src/lib/customer-cart.tsx:1-235](file:///d:/Github/resturant_saas/apps/web/src/lib/customer-cart.tsx#L1-L235) | **Verified** |

---

## 3. Audit 1 — QR Token Security

### Findings
1. **Raw Token Storage and Direct Querying (SEC-QR-01)**:
   - *Location:* [supabase/migrations/20261117000003_customer_ordering.sql:28-29](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L28-L29), [apps/api/src/modules/customer/customer.service.ts:57](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L57)
   - *Detail:* The schema defines both `token_hash VARCHAR(128)` and `raw_token VARCHAR(128)`. However, `customer.service.ts` queries `WHERE qt.raw_token = $1` directly using the cleartext token string. The `token_hash` column is left unused. If the database is read-compromised, all table QR codes are immediately exposed in plaintext.
2. **Missing Inactive / Out-of-Service Table Status Enforcement (SEC-QR-02)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:68-76](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L68-L76)
   - *Detail:* While `resolveQrToken` explicitly checks `row.qr_status !== 'ACTIVE'`, `row.expires_at`, `row.tenant_status !== 'ACTIVE'`, and `row.location_status !== 'ACTIVE'`, it **fails to inspect `row.table_status`**. Even if staff mark a physical table as `OUT_OF_SERVICE` or `INACTIVE`, scanning its QR code still succeeds and opens a dining session.
3. **Bearer Session Token Exposed in GET Path Parameter (SEC-QR-03)**:
   - *Location:* [apps/api/src/modules/customer/customer.controller.ts:34-37](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.controller.ts#L34-L37)
   - *Detail:* `GET /api/v1/customer/sessions/:sessionToken/orders` places the secret bearer credential `sessionToken` directly in the URL path. URL path parameters are routinely logged in plaintext by reverse proxies (NGINX, Cloudflare), web servers, and browser history. Bearer session tokens should be transferred via headers (`X-Session-Token` or `Authorization: Bearer <token>`).
4. **Token Generation Endpoint Missing (SEC-QR-04)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts)
   - *Detail:* There is currently no administrative service or API endpoint to generate, rotate, or revoke QR tokens programmatically; only static seed tokens exist.

---

## 4. Audit 2 — Table Session Concurrency

### Findings
1. **Concurrency Race on Active Table Session Creation (SEC-CONC-01 — CRITICAL)**:
   - *Location:* [supabase/migrations/20261117000003_customer_ordering.sql:39-53](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L39-L53), [apps/api/src/modules/customer/customer.service.ts:79-82, 592-610](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L79-L82)
   - *Detail:* In `table_sessions`, there is **no database-level unique constraint** enforcing that a table may only have one `OPEN` session at a time. The table only has `idx_table_sessions_active ON table_sessions(table_id, status)` (a non-unique index).
   - In `customer.service.ts`:
     ```typescript
     let session = await this.getActiveTableSession(row.table_id);
     if (!session) {
       session = await this.createTableSession(row.tenant_id, row.location_id, row.table_id);
     }
     ```
     This check-then-act pattern is vulnerable to a TOCTOU (Time of Check to Time of Use) race condition. If two diners scan the table QR code at the same instant:
     1. Diner A executes `getActiveTableSession` -> returns null.
     2. Diner B executes `getActiveTableSession` -> returns null.
     3. Diner A creates `table_session_A` (`OPEN`).
     4. Diner B creates `table_session_B` (`OPEN`).
     Both diners now have distinct active sessions for the exact same physical table. Subsequent orders will be split across two separate session bills, violating ADR-003.
   - *Required Fix:* Add a partial unique index in PostgreSQL:
     ```sql
     CREATE UNIQUE INDEX uq_single_active_table_session ON table_sessions(table_id) WHERE (status = 'OPEN');
     ```
     And implement atomic upsert / retry handling in `customer.service.ts`.
2. **Draft Cart Device Isolation (Verified)**:
   - *Location:* [apps/web/src/lib/customer-cart.tsx:55-75](file:///d:/Github/resturant_saas/apps/web/src/lib/customer-cart.tsx#L55-L75)
   - *Detail:* Draft cart items are held exclusively in browser `localStorage` keyed by `saas_customer_cart_${tenantSlug}`. Unsubmitted carts remain completely isolated between diners.

---

## 5. Audit 3 — Order Creation & Idempotency

### Findings
1. **Server-Side Price Recalculation (Verified Accurate & Tamper-Resistant)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:289-385](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L289-L385)
   - *Detail:* Zero trust is given to client inputs. `menu_items.base_price_minor` and `item_modifiers.price_minor` are fetched directly from database records in integer minor units (paise). Client totals, taxes, and prices are entirely ignored.
2. **Missing Modifier Group Cardinality & Required Selection Validation (SEC-VAL-01 — MEDIUM)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:334-366](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L334-L366)
   - *Detail:* When an order is placed, `customer.service.ts` verifies that each submitted modifier belongs to the item and is available. However, **it does not query `modifier_groups` to enforce `is_required`, `min_selection`, or `max_selection` constraints server-side**. If a user submits an item that requires a portion size selection (`is_required = true, min_selection = 1`) with zero modifiers, the backend silently accepts it. Validation is currently enforced only on the frontend modal.
3. **Idempotency Key Race Condition Handling (SEC-IDEMP-01 — MEDIUM)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:281-287, 391-410](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L281-L287)
   - *Detail:* Idempotency check occurs before transaction entry:
     ```typescript
     const existingOrder = await this.db.query(
       `SELECT id FROM orders WHERE tenant_id = $1 AND idempotency_key = $2`, ...
     );
     ```
     If two identical requests arrive simultaneously, both may pass the SELECT check, and both will attempt `INSERT INTO orders`. The second insert will collide with `CONSTRAINT uq_order_idempotency UNIQUE (tenant_id, idempotency_key)` and trigger a raw PostgreSQL error `23505` (`unique_violation`), causing an unhandled HTTP 500 error instead of catching `23505` and returning the existing order.
4. **Order Insertion Atomicity (Verified)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:389-457](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L389-L457)
   - *Detail:* Order header, item rows, order status event, and notification outbox record are committed within a single database transaction (`this.db.transaction`). Any failure triggers a complete rollback.

---

## 6. Audit 4 — Customer Authorization & Privacy

### Findings
1. **Missing Authorization on Customer Order Lookup (SEC-AUTH-01 — CRITICAL)**:
   - *Location:* [apps/api/src/modules/customer/customer.controller.ts:29-32](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.controller.ts#L29-L32), [apps/api/src/modules/customer/customer.service.ts:465-495](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L465-L495)
   - *Detail:* The endpoint `GET /api/v1/customer/orders/:orderId` performs:
     ```sql
     SELECT o.id, o.order_number, o.table_session_id, rt.table_code, ...
     FROM orders o WHERE o.id = $1
     ```
     There is **zero authorization verification**. The caller is not required to provide a `sessionToken`, a diner credential, or any tenant proof. Any anonymous user who knows or guesses a UUID can view order details, items ordered, special instructions, table codes, bill amounts, and the `tableSessionId`.
   - *Required Fix:* Require `sessionToken` validation (either as a header or query parameter) verifying that the requested `orderId` belongs to the caller's active `table_session_id`.
2. **Missing Rate Limiting & Abuse Protection (SEC-RATE-01 — HIGH)**:
   - *Location:* [apps/api/src/app.module.ts:1-22](file:///d:/Github/resturant_saas/apps/api/src/app.module.ts#L1-L22), [apps/api/src/main.ts:1-20](file:///d:/Github/resturant_saas/apps/api/src/main.ts#L1-L20)
   - *Detail:* Neither `@nestjs/throttler` nor reverse-proxy rate limiting middleware is configured. Anonymous public endpoints (`/v1/public/table/resolve-qr`, `/v1/public/menu/:tenantSlug`, `/v1/customer/orders`) can be flooded without restriction, allowing denial-of-service, automated QR token scanning, or order creation spam.
3. **Customer Contact Fields Collected but Dropped (GAP-DATA-01 — LOW)**:
   - *Location:* [apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx:64-65](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx#L64-L65), [packages/contracts/src/order.dto.ts:26-31](file:///d:/Github/resturant_saas/packages/contracts/src/order.dto.ts#L26-L31)
   - *Detail:* The cart UI collects optional `customerName` and `customerPhone`. However, these fields are not part of `CreateCustomerOrderRequestDto`, are not accepted by `CustomerService.createCustomerOrder`, and do not exist as columns in the `orders` table. They are silently discarded.

---

## 7. Audit 5 — PostgreSQL RLS & Tenant Isolation

### Findings
1. **Public Menu RLS Policies Lack Tenant Filtering (SEC-RLS-01 — HIGH)**:
   - *Location:* [supabase/migrations/20261117000003_customer_ordering.sql:204-209](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L204-L209)
   - *Detail:* The policies created are:
     ```sql
     CREATE POLICY "public_menu_categories_select" ON menu_categories FOR SELECT USING (is_active = true);
     CREATE POLICY "public_menu_items_select" ON menu_items FOR SELECT USING (is_available = true);
     CREATE POLICY "public_modifier_groups_select" ON modifier_groups FOR SELECT USING (true);
     ```
     If an anonymous client queries Supabase directly using the public API key (`anon`), these policies allow selecting menu items and categories **across all tenants in the entire database** without tenant scoping. While NestJS queries via SQL with `WHERE tenant_id = $1`, the underlying database RLS policy does not enforce tenant boundary isolation for public reads.
2. **Missing Customer RLS Policies on Sensitive Tables (SEC-RLS-02 — HIGH)**:
   - *Location:* [supabase/migrations/20261117000003_customer_ordering.sql:191-202, 211-216](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L191-L202)
   - *Detail:* RLS is enabled on `qr_tokens`, `table_sessions`, `order_status_events`, `notification_outbox`, `orders`, and `order_items`. However:
     - `qr_tokens`: 0 policies.
     - `table_sessions`: 0 policies.
     - `order_status_events`: 0 policies.
     - `notification_outbox`: 0 policies.
     - `orders`: only `staff_orders_select` exists (no INSERT policy, no customer SELECT policy).
     - `order_items`: only `staff_order_items_select` exists.
   - *Impact on Direct Supabase Access:* Any direct query by an anonymous Supabase client to create an order or read a table session is rejected with an RLS error. The only reason the application works is because NestJS connects as superuser `postgres`.
3. **Privileged Connection Bypasses RLS (ARCH-DB-01 — ARCHITECTURAL)**:
   - *Location:* [apps/api/src/database/database.service.ts:17-23](file:///d:/Github/resturant_saas/apps/api/src/database/database.service.ts#L17-L23)
   - *Detail:* NestJS connects using `DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres`. In PostgreSQL, the `postgres` superuser has `BYPASSRLS` privileges by default. NestJS never executes `SET LOCAL app.current_tenant_id` within transactions. Therefore, database-level RLS policies are **not active** on backend queries; tenant isolation currently relies solely on application-level `WHERE tenant_id = $1` filters in TypeScript code.

---

## 8. Audit 6 — Realtime and Outbox Reliability

### Findings
1. **Supabase Realtime WebSockets Inoperative for Orders (SEC-RT-01 — HIGH)**:
   - *Location:* [apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx:96-112](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx#L96-L112), [supabase/migrations/20261117000003_customer_ordering.sql](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql)
   - *Detail:* In Next.js, the order tracking screen subscribes to Supabase Realtime:
     ```typescript
     supabase.channel(`order-updates-${orderId}`).on('postgres_changes', {
       event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}`
     }, ...);
     ```
     For Supabase Realtime to broadcast row changes:
     1. The table must be added to the Supabase replication publication (`ALTER PUBLICATION supabase_realtime ADD TABLE orders;`). **This statement is absent from all migrations.**
     2. The subscribing role (`anon`) must satisfy SELECT RLS policies on the table. As noted in SEC-RLS-02, `orders` has no customer SELECT policy.
     As a result, Realtime events are never emitted or delivered.
   - *Mitigation:* The 5-second polling fallback implemented at lines 114-116 ensures order tracking updates still function in practice, but the WebSocket Realtime feature is non-functional.
2. **Notification Outbox is Write-Only — Publisher Unimplemented (ARCH-OUTBOX-01 — INCOMPLETE)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:441-454](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L441-L454)
   - *Detail:* In compliance with Audit 6 strict instructions: **The notification outbox publisher/worker is NOT implemented.** `CustomerService` inserts records with `status = 'PENDING'` into `notification_outbox`, but there is no background worker, cron task, BullMQ queue, or CDC listener reading or publishing these events. Outbox records accumulate indefinitely in `notification_outbox`.

---

## 9. Audit 7 — Business Rules & Frontend

### Findings
1. **Hardcoded 5% Tax Business Rule (BUS-TAX-01 — MEDIUM)**:
   - *Location:* [apps/api/src/modules/customer/customer.service.ts:383](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L383), [apps/web/src/lib/customer-cart.tsx:186](file:///d:/Github/resturant_saas/apps/web/src/lib/customer-cart.tsx#L186), [apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx:208](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx#L208)
   - *Detail:* GST/Tax is hardcoded as `0.05` (5%) across backend calculations, frontend cart context, and checkout UI labels. Restaurants with different tax slabs (e.g. 18% for air-conditioned establishments serving alcohol, 0% exempted items, or international jurisdictions) cannot configure custom tax rates. Tax rate must be loaded from `tenants.tax_rate_percent` or item-specific tax categories.
2. **UI Reference Alignment (Verified)**:
   - *Location:* `apps/web/src/app/(customer)/`
   - *Inspection vs References:*
     - `01-customer-menu-desktop.png`: Matched layout, header, table badge, veg toggle, category navigation pills, dish cards, and floating cart bar.
     - `02-food-details-desktop.png`: Matched modal overlay, portion radio group, add-on checkboxes, special instructions, stepper, and live calculation.
     - `03-cart-checkout-desktop.png`: Matched item list, modifier details, subtotal/tax/total payable summary, and order CTA.
     - `04-order-tracking-desktop.png`: Matched multi-step progress bar, status badges, Chef ETA banner, and consolidated session box (ADR-003).

---

## 10. Audit 8 — Phase Boundary Analysis

### Findings
- **Clean Phase Separation (Verified)**:
  - Phase C strictly limits its scope to customer ordering, session management, and customer tracking.
  - No premature Phase D kitchen operations were introduced:
    - Kitchen Display System (KDS) views are not implemented.
    - Kitchen Order Ticket (KOT) generation and routing logic are not implemented.
    - Chef order status transitions (`ACCEPTED`, `PREPARING`, `READY`, `SERVED`) have no API endpoints.
    - Waiter delivery workflows have no API endpoints.
  - The customer tracking screen can display `chef_eta_minutes` and status updates if updated in the database, but provides no mutating controls.

---

## 11. Audit 9 — Test Quality Evaluation

### Findings
1. **Mock-Only "Integration" and "E2E" Tests (TEST-MOCK-01 — HIGH)**:
   - *Location:* [apps/api/test/customer-session.e2e-spec.ts:10-21](file:///d:/Github/resturant_saas/apps/api/test/customer-session.e2e-spec.ts#L10-L21), [apps/api/test/isolation.e2e-spec.ts:10-21](file:///d:/Github/resturant_saas/apps/api/test/isolation.e2e-spec.ts#L10-L21)
   - *Detail:* Both test files named `.e2e-spec.ts` override `DatabaseService` using:
     ```typescript
     .overrideProvider(DatabaseService)
     .useValue(mockDbService)
     ```
     **There are ZERO tests executing against a real PostgreSQL instance.**
     As a consequence:
     - Real SQL syntax and foreign keys are not validated by the automated test suite.
     - Database unique constraints (`uq_order_idempotency`) are not tested.
     - PostgreSQL RLS policies are completely unexercised.
     - Transaction rollback behavior under database errors is unverified.
2. **Missing Concurrency & Race Tests (TEST-CONC-01 — MEDIUM)**:
   - There are no tests asserting behavior when two requests concurrently submit identical idempotency keys or scan the same table QR code simultaneously.

---

## 12. Comprehensive Finding Matrix

| Finding ID | Severity | Category | File & Line Reference | Summary Description |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-AUTH-01** | **CRITICAL** | Authorization | [customer.controller.ts:29-32](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.controller.ts#L29-L32) | `GET /v1/customer/orders/:orderId` has no authorization check; any UUID can be viewed anonymously. |
| **SEC-CONC-01** | **CRITICAL** | Data Integrity | [20261117000003_customer_ordering.sql:39-53](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L39-L53) | Missing partial unique constraint on `table_sessions(table_id) WHERE status = 'OPEN'`; concurrent scans create duplicate active sessions. |
| **SEC-RLS-01** | **HIGH** | Security / RLS | [20261117000003_customer_ordering.sql:204-209](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L204-L209) | Public RLS policies on `menu_categories` and `menu_items` lack `tenant_id` filtering, allowing cross-tenant catalog dumping. |
| **SEC-RLS-02** | **HIGH** | Security / RLS | [20261117000003_customer_ordering.sql:191-216](file:///d:/Github/resturant_saas/supabase/migrations/20261117000003_customer_ordering.sql#L191-L216) | Missing customer and insert RLS policies on `orders`, `table_sessions`, `qr_tokens`, and `order_items`. |
| **SEC-RT-01** | **HIGH** | Reliability | [order/[orderId]/page.tsx:96-112](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx#L96-L112) | Orders table not in `supabase_realtime` publication and lacks customer RLS; Realtime WebSocket is non-functional. |
| **ARCH-OUTBOX-01**| **HIGH** | Architecture | [customer.service.ts:441-454](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L441-L454) | Notification outbox publisher/worker is unimplemented; records accumulate without processing. |
| **SEC-RATE-01** | **HIGH** | Abuse Prevention | [apps/api/src/main.ts:1-20](file:///d:/Github/resturant_saas/apps/api/src/main.ts#L1-L20) | No rate limiting middleware on public QR resolution or order creation endpoints. |
| **TEST-MOCK-01** | **HIGH** | Quality | [customer-session.e2e-spec.ts:10-21](file:///d:/Github/resturant_saas/apps/api/test/customer-session.e2e-spec.ts#L10-L21) | "E2E" test suite mocks the entire database; zero automated tests run against real PostgreSQL. |
| **SEC-VAL-01** | **MEDIUM** | Validation | [customer.service.ts:334-366](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L334-L366) | Missing server-side enforcement of modifier group `is_required`, `min_selection`, and `max_selection`. |
| **SEC-IDEMP-01** | **MEDIUM** | Concurrency | [customer.service.ts:281-287](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L281-L287) | Concurrent duplicate submission triggers unhandled PostgreSQL `23505` error instead of returning existing order. |
| **SEC-QR-01** | **MEDIUM** | Security | [customer.service.ts:57](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L57) | Queries plaintext `raw_token` instead of checking SHA-256 `token_hash`. |
| **SEC-QR-02** | **MEDIUM** | Validation | [customer.service.ts:68-76](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L68-L76) | Fails to reject tables marked `OUT_OF_SERVICE` or `INACTIVE` during QR resolution. |
| **SEC-QR-03** | **MEDIUM** | Privacy | [customer.controller.ts:34-37](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.controller.ts#L34-L37) | `sessionToken` passed as URL path parameter rather than authorization header. |
| **BUS-TAX-01** | **MEDIUM** | Business Rules | [customer.service.ts:383](file:///d:/Github/resturant_saas/apps/api/src/modules/customer/customer.service.ts#L383) | Tax rate hardcoded as fixed 5% rather than dynamic tenant configuration. |
| **GAP-DATA-01** | **LOW** | Consistency | [cart/page.tsx:64-65](file:///d:/Github/resturant_saas/apps/web/src/app/(customer)/[tenantSlug]/cart/page.tsx#L64-L65) | Customer name and phone collected in UI but dropped by backend. |

---

## 13. Exact Reproduction Steps for Confirmed Issues

### Reproduction 1: Unauthorized Access to Order Details (SEC-AUTH-01)
1. Obtain any existing `orderId` (e.g. from seed or placed order).
2. Execute an anonymous GET request from an unauthenticated terminal:
   ```bash
   curl -X GET http://localhost:3001/api/v1/customer/orders/<orderId>
   ```
3. **Observed Behavior:** HTTP 200 OK returning full order details, items, special instructions, total bill, and `tableSessionId`.
4. **Expected Behavior:** HTTP 401/403 Forbidden unless caller supplies a valid `sessionToken` associated with the order's session.

### Reproduction 2: Table Session Concurrency Race (SEC-CONC-01)
1. Simulate two concurrent diners scanning Table T-01 simultaneously when no session is open:
   ```bash
   curl -X POST http://localhost:3001/api/v1/public/table/resolve-qr -d '{"qrToken":"demo-spice-table-1"}' &
   curl -X POST http://localhost:3001/api/v1/public/table/resolve-qr -d '{"qrToken":"demo-spice-table-1"}' &
   ```
2. **Observed Behavior:** If both requests execute `getActiveTableSession` before either completes `INSERT`, two distinct rows are inserted into `table_sessions` for the same table.
3. **Expected Behavior:** Database rejects the second insert with unique violation, and the application gracefully joins the winning active session.

### Reproduction 3: Bypassing Required Item Modifiers (SEC-VAL-01)
1. Identify a menu item requiring a portion modifier (`min_selection = 1, is_required = true`).
2. Post an order directly to `/api/v1/customer/orders` with `modifierIds: []`:
   ```bash
   curl -X POST http://localhost:3001/api/v1/customer/orders -H "Content-Type: application/json" \
     -d '{"sessionToken":"<valid_session>","idempotencyKey":"test-1","items":[{"itemId":"<item_uuid>","quantity":1,"modifierIds":[]}]}'
   ```
3. **Observed Behavior:** HTTP 201 Created. The order is submitted without the mandatory portion modifier.
4. **Expected Behavior:** HTTP 400 Bad Request: "Portion Size selection is required for item X".

---

## 14. Required Fixes Before Phase D

The following fixes are mandatory preconditions before beginning Phase D:

1. **Protect Order Lookup Endpoint (`SEC-AUTH-01`)**:
   - Update `GET /v1/customer/orders/:orderId` to accept `sessionToken` (via header `x-session-token` or query param) and verify that `orders.table_session_id` matches the session.
2. **Enforce Database-Level Active Table Session Uniqueness (`SEC-CONC-01`)**:
   - Add migration creating partial unique index:
     ```sql
     CREATE UNIQUE INDEX uq_single_active_table_session ON table_sessions(table_id) WHERE (status = 'OPEN');
     ```
   - Update `customer.service.ts` to handle concurrency conflicts gracefully.
3. **Validate Modifier Group Constraints Server-Side (`SEC-VAL-01`)**:
   - In `createCustomerOrder`, query `item_modifier_groups` and `modifier_groups` to validate that all required groups have at least `min_selection` and no group exceeds `max_selection`.
4. **Enforce Table Status in QR Resolution (`SEC-QR-02`)**:
   - Verify `row.table_status === 'AVAILABLE' || row.table_status === 'OCCUPIED'` in `resolveQrToken`; throw `ForbiddenException` if `OUT_OF_SERVICE` or `INACTIVE`.
5. **Handle Concurrent Idempotency Key Insertion (`SEC-IDEMP-01`)**:
   - Catch Postgres error code `23505` during `INSERT INTO orders` and fallback to `getOrderById` for the colliding idempotency key.
6. **Add Orders Table to Supabase Realtime Publication (`SEC-RT-01`)**:
   - Add migration statement:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE orders;
     ```

---

## 15. Items Safely Deferrable to Later Phases

| Item | Phase Target | Justification for Deferral |
| :--- | :--- | :--- |
| **Outbox Background Worker / Queue (`ARCH-OUTBOX-01`)** | Phase D / Phase E | Pending approval of ADR-06 (Redis / BullMQ / pg_boss strategy). Current polling fallback ensures customer tracking functions. |
| **Rate Limiting Middleware (`SEC-RATE-01`)** | Phase F | Can be applied globally across all API routes alongside production reverse proxy configuration. |
| **Dynamic Tenant Tax Schedules (`BUS-TAX-01`)** | Phase E (Billing & Payments) | 5% GST is standard for Indian restaurant dine-in; tenant-configurable multi-tax rates align with invoicing and settlement slice. |
| **QR Code Generation & Management UI (`SEC-QR-04`)** | Phase G (Owner Operations) | Physical table and QR code generation belongs in the owner restaurant settings slice. |
| **Customer Name & Phone Persistence (`GAP-DATA-01`)** | Phase E / Phase H | Guest dine-in does not strictly mandate customer contact capture. |

---

## 16. Final Phase C Exit-Criteria Checklist

- [x] **Database Migration & Tables**: Restaurant tables, QR tokens, sessions, categories, items, modifiers, orders, items, status events, outbox.
- [x] **QR Token Resolution**: Validates token, location, tenant, and resolves table session.
- [x] **Public Menu API**: Returns categorized items with modifier groups and verified integer minor unit pricing.
- [x] **Customer UI (Screens 01-04)**: Menu, Food Details Modal, Cart Checkout, and Live Order Tracking screens implemented matching UI design system.
- [x] **Server-Side Price Calculation**: Absolute server-side recalculation in minor units; zero trust in browser totals.
- [x] **Idempotent Order Submission**: Unique constraint on `(tenant_id, idempotency_key)` preventing duplicate orders.
- [x] **Table Session Multi-Order Grouping (ADR-003)**: Multiple independent orders attached to one session and consolidated onto one bill.
- [x] **Clean Phase Boundary**: No premature Kitchen Display System (Phase D) logic implemented.
- [x] **Asset Preservation**: All 113 UI reference assets under `docs/ui_design/` preserved untouched.
- [ ] **Security Remediation (Blocker)**: Order lookup authorization (`SEC-AUTH-01`) and session concurrency unique constraint (`SEC-CONC-01`) remediated.
- [ ] **Real PostgreSQL Integration Tests**: Automated tests executed against an active database container rather than 100% mocked providers.
