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
