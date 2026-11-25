# UI Screen Inventory

Status: Inventory scaffold for the 113 approved numbered references. Preserve every existing reference asset. Do not infer missing filenames or module mappings.

## Required columns
Reference number | Existing image filename/path | Module | Role | Route | PRD requirement IDs | Data/API dependencies | Implementation status | QA status

## Reference coverage
References 001–103: map the existing image files to their original reference numbers from the current approved UI-design collection. Do not rename or overwrite images during mapping.

References 104–113 (confirmed from the current design sequence):

| Ref | Screen | Role/module | Suggested image filename |
|---:|---|---|---|
| 104 | Reservation Rules, Policies & Automated Reminders | Owner / Reservations | `45-reservation-rules-policies-reminders.png` |
| 105 | Reservation Details, Guest Profile & Booking History | Owner / Reservations | `46-reservation-details-guest-profile-history.png` |
| 106 | Reservation Cancellation, Modification & Refund Workflow | Owner / Reservations | `47-reservation-cancellation-modification-refund.png` |
| 107 | Reservation Analytics & Occupancy Reports | Owner / Analytics | `48-reservation-analytics-occupancy-reports.png` |
| 108 | Reports & Analytics Business Dashboard | Owner / Analytics | `49-owner-reports-analytics-business-dashboard.png` |
| 109 | Sales Analytics & Revenue Breakdown | Owner / Analytics | `50-sales-analytics-revenue-breakdown.png` |
| 110 | Order Analytics & Fulfilment Performance | Owner / Analytics | `51-order-analytics-fulfilment-performance.png` |
| 111 | Menu Performance & Item Profitability Analytics | Owner / Analytics | `52-menu-performance-item-profitability.png` |
| 112 | Inventory & Food Cost Analytics | Owner / Analytics | `53-inventory-food-cost-analytics.png` |
| 113 | Outlet Comparison & Multi-Branch Performance | Owner / Analytics | `54-outlet-comparison-multi-branch-performance.png` |

## Mapping rules
- The suggested names above are logical names from the handoff, not proof that the files already exist under those names.
- Keep original reference assets intact. If you copy them into the repo, retain the original filename or add a mapping entry; never overwrite a different file.
- Mark a screen `Not started`, `In progress`, `Implemented`, `Visual QA passed`, or `Accepted`.
- **Full-Stack Development Rule**: A screen cannot transition to `Implemented` or `Accepted` with mock data or client-only fixtures. Full backend API, DB migrations, RLS, and tests must be in place.
- **Reference Anomalies & Boundaries**:
  - `02-staff/17-future-split-bill.png`: Preserved as reference asset, but **STRICTLY OUT OF CURRENT IMPLEMENTATION SCOPE** per ADR-003. Split billing must not be implemented.
  - `02-staff/15-website-visual-editor.png`: Verified exact byte-for-byte duplicate (SHA256: `46A0E82D...`) of `03-owner/15-website-visual-editor.png`. Implementation belongs exclusively to Owner CMS (`FR-OWN-05`).

## Implemented Authentication Screens (Phase B Full-Stack Foundation)
| Ref/Asset | Screen Name | Role | Route | Backend API Dependency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `05-authentication/01-login.png` | Staff & Owner Login | Auth Shell | `/login` | Supabase Auth + `GET /v1/auth/me` | **Implemented** |
| `05-authentication/02-owner-registration.png` | Owner & Tenant Onboarding | Owner | `/register` | Supabase Auth + `POST /v1/auth/register-owner` | **Implemented** |
| `05-authentication/05-email-otp-verification.png` | Email OTP Verification | Auth Shell | `/verify-otp` | Supabase Auth `verifyOtp` | **Implemented** |
| `05-authentication/06-select-restaurant-outlet.png` | Select Restaurant & Outlet | Multi-Role | `/select-outlet` | `GET /v1/auth/me`, `POST /v1/auth/select-outlet` | **Implemented** |
| `05-authentication/07-access-denied.png` | 403 Forbidden Access Denied | Shell | `/access-denied` | Client-side error boundary + RBAC guards | **Implemented** |

## Implemented Customer QR Menu & Ordering Screens (Phase C & C.1)
| Ref/Asset | Screen Name | Role | Route | Backend API Dependency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `01-customer/01-landing-table-selection.png` | QR Token Resolver & Table Activation | Diner | `/table/[qrToken]` | `POST /v1/customer/table-sessions/resolve-qr` | **Implemented** |
| `01-customer/02-digital-menu-browsing.png` | Digital Customer Menu | Diner | `/[tenantSlug]/menu` | `GET /v1/customer/menu` | **Implemented** |
| `01-customer/03-item-detail-customization.png` | Item Detail & Modifiers Modal | Diner | Modal in `/[tenantSlug]/menu` | `GET /v1/customer/menu` | **Implemented** |
| `01-customer/04-order-cart-review.png` | Diner Cart & Bill Breakdown | Diner | `/[tenantSlug]/cart` | `POST /v1/customer/orders` | **Implemented** |
| `01-customer/05-order-status-tracking.png` | Live Kitchen Tracker & Consolidated Bill | Diner | `/[tenantSlug]/order/[orderId]` | `GET /v1/customer/orders/:orderId` | **Implemented** |

## Implemented Staff Operations & KDS Screens (Phase D)
| Ref/Asset | Screen Name | Role | Route | Backend API Dependency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `02-staff/01-reception-dashboard.png` | Staff Reception Dashboard | Receptionist / Manager | `/staff/reception` | `GET /v1/staff/orders`, `PATCH /v1/staff/orders/:id/status` | **Implemented** |
| `02-staff/02-order-details-processing.png` | Staff Order Detail & Actions Modal | Staff | Modal in `/staff/reception` | `GET /v1/staff/orders/:id`, `PATCH /v1/staff/orders/:id/status` | **Implemented** |
| `02-staff/03-kitchen-display-system.png` | Kitchen Display System (KDS) Lanes | Chef / Kitchen Staff | `/staff/kitchen` | `GET /v1/staff/orders`, `PATCH /v1/staff/orders/:id/status` | **Implemented** |
| `02-staff/04-waiter-table-service.png` | Waiter Table Service & Ready Queue | Waiter / Runner | `/staff/waiter` | `GET /v1/staff/orders`, `PATCH /v1/staff/orders/:id/pickup`, `PATCH /v1/staff/orders/:id/served` | **Implemented** |
| `02-staff/13-kitchen-display-system.png` | KDS High-Contrast Cooking View | Kitchen Staff | `/staff/kitchen` | `GET /v1/staff/orders`, `PATCH /v1/staff/orders/:id/eta` | **Implemented** |
| `02-staff/14-waiter-service-dashboard.png` | Waiter Service Dashboard | Waiter | `/staff/waiter` | `GET /v1/staff/orders`, `PATCH /v1/staff/orders/:id/served` | **Implemented** |
| `02-staff/18-order-cancellation-confirmation.png` | Order Cancellation / Rejection Modal | Staff | Reusable Staff Modal | `PATCH /v1/staff/orders/:id/status` | **Implemented** |

## Implemented Restaurant Billing & Payment Verification Screens (Phase E)
| Ref/Asset | Screen Name | Role | Route | Backend API Dependency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `02-staff/05-billing-invoices.png` | Billing & Invoices Workspace | Receptionist / Manager / Owner | `/staff/billing` | `GET /v1/staff/billing/queue`, `POST /v1/staff/bills/:id/payments` | **Implemented** |
| `02-staff/15-table-session-multiple-orders.png` | Table Session Multi-Order Consolidated View | Receptionist / Manager / Owner | `/staff/billing` | `GET /v1/staff/billing/queue`, `POST /v1/staff/table-sessions/:id/bills` | **Implemented** |
| `02-staff/16-consolidated-bill-payment-verification.png` | Consolidated Bill & Restaurant UPI QR Verification | Receptionist / Manager / Owner | `/staff/billing` | `POST /v1/staff/table-sessions/:id/bills`, `POST /v1/staff/payments/:id/verify` | **Implemented** |
| `02-staff/19-payment-verification-invoice-printing.png` | Payment Verification Stepper & Invoice Preview Modal | Receptionist / Manager / Owner | Modal in `/staff/billing` | `POST /v1/staff/payments/:id/verify`, `GET /v1/staff/bills/:id` | **Implemented** |
| `03-owner/11-restaurant-profile-settings.png` | Branch Billing & UPI Payment Settings | Owner / Manager | `/owner/settings` | `GET /v1/owner/payment-settings`, `PUT /v1/owner/payment-settings` | **Implemented** |
| `03-owner/23-branch-specific-configuration.png` | Outlet Payment & Tax Configuration | Owner / Manager | `/owner/settings` | `GET /v1/owner/payment-settings`, `PUT /v1/owner/payment-settings` | **Implemented** |
| `01-customer/04-order-tracking-desktop.png` | Customer Consolidated Bill & UPI Reference Submission | Diner | `/[tenantSlug]/order/[orderId]` | `GET /v1/customer/sessions/:token/bill`, `POST /v1/customer/sessions/:token/bill/payment-reference` | **Implemented** |
