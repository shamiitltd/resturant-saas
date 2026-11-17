# Screen-to-Requirements Mapping

Use this document to connect every numbered UI reference to product behavior and backend scope. Do not invent requirement IDs. Copy exact IDs from PRD v1.1.

## Phase B: Core Authentication & Access Control Mapping
| Asset Path | Screen Name | Role | Route | PRD Requirement IDs | API / Data Dependencies | Permission Scope | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `05-authentication/01-login.png` | Staff & Owner Login | Auth Shell | `/login` | `FR-STA-01`, `FR-SA-01` | Supabase Auth, `GET /v1/auth/me` | Public / Authenticated | **Implemented** |
| `05-authentication/02-owner-registration.png` | Owner & Tenant Onboarding | Owner | `/register` | `FR-TEN-01`, `FR-TEN-04`, `FR-TEN-05` | Supabase Auth, `POST /v1/auth/register-owner` | Public | **Implemented** |
| `05-authentication/05-email-otp-verification.png` | Email OTP Verification | Auth Shell | `/verify-otp` | `FR-STA-01`, `NFR-05` | Supabase Auth `verifyOtp` | Public | **Implemented** |
| `05-authentication/06-select-restaurant-outlet.png` | Select Restaurant & Outlet | Multi-Role | `/select-outlet` | `FR-TEN-02`, `FR-STA-02` | `GET /v1/auth/me`, `POST /v1/auth/select-outlet` | Authenticated Staff/Owner | **Implemented** |
| `05-authentication/07-access-denied.png` | 403 Forbidden Access Denied | Shell | `/access-denied` | `NFR-01`, `BR-02` | Client-side error boundary + RBAC guards | Authenticated | **Implemented** |

---

## 113 UI References Traceability Matrix
|---:|---|---|---|---|---|---|---|
| 001–103 | Populate from the existing approved screen references | Pending mapping | Pending | Pending | Pending | Tenant/location/role-specific | Not started |
| 104 | Reservation Rules, Policies & Automated Reminders | Owner | Pending | Pending mapping | Reservation rules, notification templates and delivery logs | Tenant + authorized location scope | Not started |
| 105 | Reservation Details, Guest Profile & Booking History | Owner | Pending | Pending mapping | Reservations, guest profile, visits and history | Tenant + authorized location scope | Not started |
| 106 | Reservation Cancellation, Modification & Refund Workflow | Owner | Pending | Pending mapping | Reservation changes, policy evaluation, refund records | Restricted staff/owner permissions | Not started |
| 107 | Reservation Analytics & Occupancy Reports | Owner | Pending | Pending mapping | Reservation status events, capacity and occupancy | Tenant + location scope | Not started |
| 108 | Reports & Analytics Business Dashboard | Owner | Pending | Existing analytics requirements to map | Sales, orders, guests, occupancy and cost sources | Tenant-wide owner permission | Not started |
| 109 | Sales Analytics & Revenue Breakdown | Owner | Pending | Existing sales/payment requirements to map | Completed orders, discounts, taxes, refunds and payment records | Financial reporting permission | Not started |
| 110 | Order Analytics & Fulfilment Performance | Owner | Pending | Existing order/operations requirements to map | Order events, KOT timestamps, fulfilment targets | Tenant + location scope | Not started |
| 111 | Menu Performance & Item Profitability Analytics | Owner | Pending | Existing menu/analytics requirements to map | Order lines, recipe/BOM and ingredient costs | Tenant + location scope | Not started |
| 112 | Inventory & Food Cost Analytics | Owner | Pending | Existing inventory/integration requirements to map | Stock ledger, purchases, consumption, wastage and recipes | Tenant + location scope | Not started |
| 113 | Outlet Comparison & Multi-Branch Performance | Owner | Pending | Existing multi-location/analytics requirements to map | Cross-location aggregates under tenant scope | Tenant-wide owner permission | Not started |

A screen cannot be marked complete until the exact requirement IDs, route, API/data dependencies and authorization scope are filled in.
