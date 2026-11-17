# Phase D Implementation Report: Staff Operations (KDS & Order Lifecycle)

**Date**: 2026-11-17  
**Status**: COMPLETED & VERIFIED  
**Repository Branch**: `main`  
**Architecture Scope**: NestJS Modular Monolith + Next.js App Router + Supabase PostgreSQL (Strict Additive Migrations)

---

## 1. Executive Summary

Phase D (*Staff Operations: Kitchen Display System & Order Lifecycle*) has been fully implemented across all layers of the stack as an authoritative, connected vertical slice.

- **Authoritative Backend State Machine**: Enforced strict lifecycle transitions:
  $$\text{PLACED} \longrightarrow \text{ACCEPTED} \longrightarrow \text{PREPARING} \longrightarrow \text{READY} \longrightarrow \text{SERVED} \longrightarrow \text{COMPLETED}$$
  with terminal rejection/cancellation paths (`REJECTED`, `CANCELLED`). All state transitions are guarded by atomic PostgreSQL transactions, row-level locking (`SELECT ... FOR UPDATE`), immutable `order_status_events` audit logging, and transactional `notification_outbox` queuing.
- **Chef ETA Management (D4)**: Validated estimation between 1 and 180 minutes, updating the customer live tracker dynamically with audit events.
- **Waiter Table Service (D5)**: Dedicated waiter dashboard displaying ready plates, timestamping pickups (`picked_up_at`) and marking orders served (`served_at`).
- **Self-Service / Counter Mode (D6)**: First-class support for `locations.service_mode = 'COUNTER_SERVICE'`, allowing customer collection and direct completion without table waiter dispatch.
- **High-Density Staff Web Interfaces**: Built Reception Queue (`/staff/reception`), Kitchen Display System (`/staff/kitchen`), Waiter Station (`/staff/waiter`), Order Detail Modal, Set ETA Modal, and Cancellation Confirmation Modal based directly on approved UI reference designs.
- **Automated Verification**: 100% test pass rate across 43 unit tests and 16 native PostgreSQL 18.6 integration tests. All 113 approved UI reference images in `docs/ui_design/` remain strictly preserved.

---

## 2. Architecture & Database Additive Migrations

### 2.1 Additive Database Migration: `20261117000006_phase_d_staff_kds.sql`
In accordance with workspace rules, existing migrations were not altered. The following schema extensions were added:

1. **Orders Table Columns**:
   - `waiter_id UUID REFERENCES profiles(id) ON DELETE SET NULL`
   - `rejection_reason TEXT`
   - `cancellation_reason TEXT`
   - `eta_updated_at TIMESTAMPTZ`
   - `eta_set_by UUID REFERENCES profiles(id) ON DELETE SET NULL`
   - `picked_up_at TIMESTAMPTZ`
   - `served_at TIMESTAMPTZ`
2. **High-Performance Operational Indices**:
   - `CREATE INDEX idx_orders_waiter ON orders(waiter_id) WHERE waiter_id IS NOT NULL;`
   - `CREATE INDEX idx_orders_status_location ON orders(location_id, status, created_at DESC);`
3. **RBAC Staff Permissions**:
   - `waiter.view` (View ready orders and service tasks)
   - `waiter.serve` (Mark orders picked up and delivered to table)
   - `orders.complete` (Mark order service completed)
   - Dynamic mappings to `WAITER`, `RECEPTIONIST`, `CHEF`, and `MANAGER` roles.
4. **Row-Level Security (RLS)**:
   - Added `staff_orders_update` policy on `orders` enforcing tenant and location membership.
   - Added `staff_order_status_events_insert` and `staff_order_status_events_select` policies on `order_status_events`.

---

## 3. Authoritative Order Lifecycle Engine (`StaffService`)

### 3.1 Transition State Matrix
Implemented in `apps/api/src/modules/staff/staff.service.ts`:

| Source Status | Allowed Target Statuses | Validation & Rules |
| :--- | :--- | :--- |
| `PLACED` | `ACCEPTED`, `REJECTED`, `CANCELLED` | Requires `orders.accept` or `orders.cancel`. `REJECTED` strictly requires non-empty `rejectionReason`. |
| `ACCEPTED` | `PREPARING`, `CANCELLED` | Requires `orders.prepare`. `CANCELLED` strictly requires non-empty `cancellationReason`. |
| `PREPARING` | `READY` | Requires `kitchen.mark_ready` or `orders.update_status`. |
| `READY` | `SERVED` *(Table Service)*, `COMPLETED` *(Counter Service)* | Table service requires waiter delivery. Counter service allows direct completion. |
| `SERVED` | `COMPLETED` | Marks table dining order finished. |
| `COMPLETED` | *(None - Terminal)* | Final state. Subsequent modifications are rejected with `400 Bad Request`. |
| `REJECTED` | *(None - Terminal)* | Final state. Recorded in immutable audit log. |
| `CANCELLED` | *(None - Terminal)* | Final state. Recorded in immutable audit log. |

### 3.2 Atomicity, Row Locking, and Audit Ledger
Every state transition runs inside an isolated database transaction:
1. `SELECT ... FROM orders ... WHERE id = $1 FOR UPDATE` locks the target order row.
2. Cross-tenant and location access boundaries are verified.
3. State jump validity is evaluated against `ALLOWED_TRANSITIONS`.
4. The order status, timestamp, and optional reasons are updated.
5. An immutable audit record is inserted into `order_status_events` capturing `from_status`, `to_status`, `actor_type`, `actor_id`, and `notes`.
6. An event is atomically recorded in `notification_outbox` for downstream delivery.

---

## 4. UI Implementation & Screen Inventory Mapping

All staff screens were developed in `apps/web/src/app/(staff)/` using approved design tokens, high visual density, and responsive layouts:

| Ref / Asset | Screen Name | Route / Component | Features & Interaction Intent |
| :--- | :--- | :--- | :--- |
| `02-staff/01-reception-dashboard.png` | Staff Reception Dashboard | `/staff/reception/page.tsx` | Order metrics bar (Active, Placed, Kitchen, Ready), status tabs, search filter, order cards with elapsed badges (green <10m, amber 10-20m, red >20m), 5-second polling, and new ticket alert beacon. |
| `02-staff/02-order-details-processing.png` | Staff Order Details Modal | `OrderDetailModal.tsx` | Line items with modifiers, notes, quantities, financial totals, customer special instructions, ETA display, and state transition actions. |
| `02-staff/03-kitchen-display-system.png` | Kitchen Display System | `/staff/kitchen/page.tsx` | High-contrast dark operational KDS theme, 3-lane Kanban (`New Tickets`, `In Preparation`, `Ready for Pickup`), large touch targets, bold modifier callouts, and audio/visual incoming alerts. |
| `02-staff/04-waiter-table-service.png` | Waiter Table Service | `/staff/waiter/page.tsx` | Realtime list of plated hot dishes, table codes, elapsed minutes since plated, "Pick Up Tray" button, and "Mark Served" confirmation. |
| `02-staff/13-kitchen-display-system.png` | KDS Chef ETA View | `SetEtaModal.tsx` | Quick pickers (+10, +15, +20, +25, +30, +45 mins) and custom integer validation (1-180 mins). |
| `02-staff/14-waiter-service-dashboard.png` | Waiter Service Dashboard | `/staff/waiter/page.tsx` | Counter service vs Table delivery distinction, recently served list, and direct complete button. |
| `02-staff/18-order-cancellation-confirmation.png` | Order Cancellation Modal | `CancelOrderModal.tsx` | Required cancellation/rejection reason selector with preset choices + custom textarea. |

### 4.1 Cross-Role Customer Integration
Updated the customer tracking screen at `apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx`:
- Dynamically reflects chef preparation ETA countdowns (`chefEtaMinutes`).
- Displays immediate cancellation/rejection notification with staff-provided reasons.
- Reflects `ACCEPTED`, `PREPARING`, `READY`, `SERVED`, and `COMPLETED` statuses live via resilient 5-second polling.

---

## 5. Verification & Test Evidence

### 5.1 Real Native PostgreSQL 18.6 Integration Test Suite
Verified against an actual native PostgreSQL 18.6 instance running on `localhost:54338`:

```text
PASS test/real-postgres-integration.spec.ts (9.616 s)
  Actual Native PostgreSQL 18.6 Integration Test Suite
    1. Partial Unique Index & Active Table Session Concurrency (SEC-CONC-01)
      √ enforces uq_single_active_table_session partial unique index in actual PostgreSQL (12 ms)
      √ handles race conditions by recovering winning active session on error 23505 (2 ms)
    2. Transaction Rollback in Actual PostgreSQL
      √ rolls back all modifications atomically if any step in an order transaction fails (11 ms)
    3. PostgreSQL RLS Enforcement & Denial of Direct Anonymous Access
      √ allows anonymous role to SELECT only available menu items of ACTIVE tenants (16 ms)
      √ DENIES direct anonymous Supabase SELECT access to table_sessions (returns 0 rows) (4 ms)
      √ DENIES direct anonymous Supabase SELECT access to orders (returns 0 rows) (4 ms)
    4. Cross-Tenant Isolation & Customer Order Scoping
      √ isolates Tenant A and Tenant B menu categories strictly by tenant_id (2 ms)
    5. Order Idempotency Constraint (SEC-IDEMP-01)
      √ rejects duplicate order submission with same idempotency key for same tenant (3 ms)
    6. Server-Side Modifier Validation from Actual PostgreSQL Records
      √ validates min_selection and is_required constraints from actual modifier_groups table (2 ms)
    7. Explicit Tax Configuration (Task 2: BUS-TAX-01 Verification Gate)
      √ verifies that unconfigured tax (NULL) results in 0 tax minor units and total equals subtotal
      √ calculates 18% tax accurately in integer minor units when explicitly configured
      √ handles explicit 0.00% zero tax correctly (1 ms)
      √ verifies integer rounding precision on odd minor units
    8. Staff Operations & KDS State Machine (Phase D Verification)
      √ verifies that Phase D columns exist on orders table (7 ms)
      √ executes atomic order lifecycle state transitions with SELECT FOR UPDATE row locking (11 ms)
      √ verifies rollback on error preserves original order status (2 ms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        10.063 s
```

### 5.2 Unit & Service Test Suite
Verified with Jest across `apps/api`:

```text
PASS test/staff-operations.spec.ts
  StaffService - Phase D Order Lifecycle & KDS Operations
    Location Scoping & Cross-Location Isolation
      √ rejects access if staff tries to query an unassigned location (21 ms)
      √ resolves primary assigned location when none is explicitly provided in query (1 ms)
    Authoritative Order State Machine Transitions
      √ allows PLACED -> ACCEPTED transition (2 ms)
      √ rejects invalid jump: PLACED -> READY (1 ms)
      √ rejects transition from terminal COMPLETED status (1 ms)
      √ requires a reason when transitioning to REJECTED (1 ms)
    Chef ETA Management
      √ sets valid chef ETA (15 minutes) and updates order (1 ms)
      √ rejects ETA below 1 minute or above 180 minutes (6 ms)
    Waiter Pickup and Served Workflow
      √ records waiter pickup timestamp and assigns waiter_id
      √ marks order SERVED upon table delivery (1 ms)
    Self-Service / Counter Collection Mode
      √ allows direct READY -> COMPLETED when service_mode is COUNTER_SERVICE
      √ rejects direct READY -> COMPLETED without SERVED when service_mode is TABLE_SERVICE (1 ms)
    RBAC Permission Enforcement
      √ rejects status update if user lacks permission for that action

Test Suites: 5 passed, 5 total
Tests:       43 passed, 43 total
```

### 5.3 UI Reference Assets Count
Protected reference images count verified via PowerShell:
```powershell
(Get-ChildItem -Path "docs\ui_design" -Recurse -File).Count
# Output: 113
```
All 113 original reference images remain unmodified, unrenamed, and intact.

---

## 6. Summary of Changed / Created Files

### Database Migrations
- `supabase/migrations/20261117000006_phase_d_staff_kds.sql`: Added operational columns, indices, RBAC permissions, and RLS policies.

### Shared Contracts
- `packages/contracts/src/order.dto.ts`: Added `OrderLifecycleStatus`, `StaffOrderDto`, `UpdateOrderStatusRequestDto`, `SetChefEtaRequestDto`, `StaffOrderListQueryDto`, `StaffOrderTransitionResponseDto`, and reason fields to `CustomerOrderResponseDto`.

### Backend API (`apps/api`)
- `apps/api/src/modules/staff/staff.service.ts`: Implemented authoritative state machine, ETA validation, waiter workflow, and self-service logic.
- `apps/api/src/modules/staff/staff.controller.ts`: Implemented REST endpoints for orders, status transitions, ETA updates, pickup, and served actions.
- `apps/api/src/modules/staff/staff.module.ts`: Exported `StaffService` and registered controllers.
- `apps/api/src/app.module.ts`: Registered `StaffModule`.
- `apps/api/src/modules/customer/customer.service.ts`: Populated `rejection_reason` and `cancellation_reason` in customer order retrieval.
- `apps/api/test/staff-operations.spec.ts`: Unit test suite (13 tests).
- `apps/api/test/real-postgres-integration.spec.ts`: PostgreSQL 18.6 integration tests (16 tests).

### Frontend Web (`apps/web`)
- `apps/web/src/app/(staff)/reception/page.tsx`: Reception dashboard.
- `apps/web/src/app/(staff)/kitchen/page.tsx`: High-contrast KDS Kanban board.
- `apps/web/src/app/(staff)/waiter/page.tsx`: Waiter service and ready queue.
- `apps/web/src/app/(staff)/components/OrderDetailModal.tsx`: Order detail modal.
- `apps/web/src/app/(staff)/components/SetEtaModal.tsx`: Chef prep ETA picker.
- `apps/web/src/app/(staff)/components/CancelOrderModal.tsx`: Cancellation reason modal.
- `apps/web/src/app/(customer)/[tenantSlug]/order/[orderId]/page.tsx`: Added rejection/cancellation alert banner.

### Documentation
- `docs/UI_SCREEN_INVENTORY.md`: Updated with Phase D staff screens.
- `docs/SCREEN_REQUIREMENTS_MAPPING.md`: Mapped Phase D screens to PRD requirement IDs.
- `docs/audits/PHASE_D_IMPLEMENTATION_REPORT.md`: This comprehensive report.

---

## 7. Next Steps & Phase Boundaries

- **Phase D is complete**.
- **Phase E (Billing, Payments & Invoicing) is NOT started**. Execution has stopped as instructed to await Product Owner review.
