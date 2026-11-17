# Screen-to-Requirements Mapping

Use this document to connect every numbered UI reference to product behavior and backend scope. Do not invent requirement IDs. Copy exact IDs from PRD v1.1.

| Ref | Screen name | Role | Route | PRD requirement IDs | API/data dependencies | Permission scope | Status |
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
