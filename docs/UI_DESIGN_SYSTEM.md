# Restaurant SaaS UI Design System

Status: Working handoff — derive exact tokens from the approved 113 screen references; do not invent a replacement visual identity.

## Source of truth
The approved numbered screen images are the visual source of truth. Inspect them before implementing. If an image is missing or its reference number cannot be matched, record the gap instead of guessing.

## Verified Color Tokens from Reference Image Audit
Visual inspection and color sampling of the approved 113 reference images established that the platform employs distinct role-based palette accents rather than a single generic indigo:
- **Restaurant Operations (Customer, Staff, Owner)**:
  - Customer Primary Accent: `#DE5803` – `#E05A04` (Warm culinary orange).
  - Staff Operational Accent: `#EF5301` – `#EE5402` (High-visibility red-orange for KDS, timers, status alerts).
  - Owner Management Accent: `#FD5001` (Restaurant vibrant orange) with `#FEDFCE` (Soft peach card/badge tint).
  - Surface Backgrounds: Crisp clean whites and light slate `#F8FAFC` to `#FFFFFF`.
- **Platform Super Admin**:
  - Primary Platform Accent: `#005CFE` (Enterprise royal blue).
  - Surface Backgrounds: `#FFFFFF` and neutral grey canvas `#F8FAFC`.
- **Authentication Shell**:
  - Left Branded Sidebar: Deep dark navy `#08172F`.
  - Primary Action / Buttons: Electric Blue `#002CE8`.
  - Form Surfaces: Clean white `#FFFFFF` with neutral borders `#E2E8F0`.

## Full-Stack Vertical Slice Principle
Frontend screens must never be developed in isolation with mocked data. Every screen module must be delivered as a coherent full-stack vertical slice including:
1. Next.js UI screen and components matching the approved reference.
2. NestJS modular monolith API controllers, DTOs, and services.
3. Supabase database migrations, tables, constraints, and RLS policies.
4. Verified server-side authentication and TenantContext authorization.
5. Automated positive and negative cross-tenant test coverage.

## Tokens to extract and standardize
- Brand and semantic colors (primary, secondary, success, warning, danger, neutral, surface, border, text).
- Typography scale, weights, line heights and numeric/data typography.
- Spacing scale, radii, borders, shadows and elevation.
- Desktop/tablet/mobile breakpoints and content widths.
- Icon family, sizes and usage rules.
- Focus, hover, active, disabled, loading and validation states.

## Shared component inventory
Buttons, icon buttons, inputs, selects, date/time pickers, textareas, checkboxes, radio groups, tabs, badges, cards, metric cards, data tables, filters, pagination, dialogs, drawers, dropdowns, tooltips, alerts, toasts, charts, empty states, skeletons, status timelines, navigation/sidebar, top bars, breadcrumbs and responsive page shells.

## Role shells
- Customer: mobile-first menu, cart, checkout, order tracking and engagement flows.
- Staff: fast operational queue/KDS/reception/waiter workflows with clear status and elapsed-time visibility.
- Owner: desktop-first business configuration and analytics, responsive at narrower widths.
- Super Admin: tenant lifecycle, plans/entitlements and platform operations.

## Quality requirements
Use semantic HTML, keyboard support, visible focus, accessible labels, sufficient contrast and announced status changes. Every interactive screen needs loading, empty, error, success and permission-denied states.
