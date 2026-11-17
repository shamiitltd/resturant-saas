# Restaurant SaaS — Antigravity Workspace Instructions

## Mandatory source documents
Read these before every implementation task:
1. `docs/RESTAURANT_SAAS_PRD_v1.1.txt` — product behavior and acceptance criteria.
2. `docs/RESTAURANT_SAAS_TRD_v1.1.txt` — architecture, data, APIs, security and delivery constraints.
3. `docs/RESTAURANT_SAAS_END_TO_END_WORKFLOW_v1.3.txt` — end-to-end workflow companion.
4. `docs/UI_DESIGN_SYSTEM.md`, `docs/UI_SCREEN_INVENTORY.md`, `docs/UI_IMPLEMENTATION_GUIDE.md`, and `docs/SCREEN_REQUIREMENTS_MAPPING.md` for frontend work.
5. Relevant accepted ADRs in `docs/adr/`.

## Approved architecture decisions
- Backend: NestJS + TypeScript modular monolith (ADR-001 approved).
- Frontend: one Next.js application with customer, staff, owner and platform Super Admin route groups (ADR-002 approved).
- Table sessions: one active session may group multiple independent submitted orders/KOTs; consolidated bill is the default. Preserve future split-bill compatibility, but do not implement split billing in the current scope (ADR-003 approved).
- Database direction: Supabase PostgreSQL/Auth/Realtime/Storage. SQL migrations are authoritative.
- ORM/database access strategy remains OPEN (ADR-03); background queue/Redis strategy remains OPEN (ADR-06). Do not silently choose either.

## UI reference preservation — NON-NEGOTIABLE
- The existing `docs/ui-design/` directory and all 113 numbered reference images are protected assets.
- Never delete, clean, recreate, rename, overwrite, optimize in-place, or regenerate any existing reference image.
- Documentation-only updates must not modify `docs/ui-design/`.
- If an archive or generated output contains a matching image path, do not overwrite it. Report the collision and preserve the existing file.
- New images may be added only as new files after explicit Product Owner direction; do not replace references implicitly.
- Before implementation, inspect the exact reference image and its inventory entry. Do not guess the mapping.

## UI implementation rules
- Match the approved reference: visual hierarchy, layout, typography, colors, spacing, component density and interaction intent.
- Use the documented design tokens and shared components. Avoid duplicate one-off components.
- Use one Next.js app with role-specific route groups/layouts; do not scaffold separate frontends per role.
- Customer experience is mobile-first. Staff, owner and Super Admin dashboards must be responsive across desktop, tablet and mobile.
- Implement loading, empty, error, disabled, success and permission-denied states.
- Meet accessibility basics: semantic structure, keyboard access, visible focus, labels, contrast and announced status changes.
- Do not make primary controls inert. Clearly label mock data and isolate fixtures while APIs are pending. Never present fixtures as live production data.
- Frontend route visibility is not authorization. Enforce permissions and tenant/location boundaries in backend and database layers.

## Security and domain invariants
- Every tenant-owned record and operation is tenant-scoped; branch operations also enforce location scope.
- Derive trusted TenantContext from verified authentication and server-side resolution; never trust client-supplied tenant IDs, roles, prices, taxes, totals, payment states or entitlements.
- Enforce Supabase RLS and backend authorization. Add negative cross-tenant tests.
- Never expose Supabase service-role/database secrets in browser code.
- Persist business state before realtime notifications; clients must recover from persisted state after reconnect.
- Use transactions and idempotency for order creation, webhooks, reward issuance/redemption and retry-sensitive actions.
- Store money as integer minor units with explicit currency; no binary floating-point bill arithmetic.
- Diner payments go directly to the restaurant. SaaS subscription payments go to the platform company. Marketplace settlements remain a separate financial domain.
- Customer-entered UPI references/screenshots are unverified metadata; only authorized staff can verify against the restaurant's payment channel.
- Never execute owner-provided arbitrary HTML, JavaScript or CSS. Use schema-validated allowlisted content blocks.
- Do not invent provider APIs, credentials, tax rules, gateway behavior or marketplace integration behavior.

## Required implementation routine
1. Read relevant PRD/TRD/workflow sections and requirement IDs.
2. Inspect repository structure, existing code, tests, migrations and package configuration.
3. Inspect the matching UI reference and screen-inventory entry for frontend work.
4. Check accepted ADRs and identify unresolved decisions that block the task.
5. Present a small plan and impacted files before broad changes.
6. Implement one coherent vertical slice only.
7. Add success, failure, authorization, idempotency and tenant-isolation tests as applicable.
8. Run formatting, lint, type checks, tests, migration checks and build.
9. Perform visual, responsive and accessibility checks for UI changes.
10. Update implementation status and report files changed, commands run, failures and skips.

## Change safety
- Do not delete or overwrite existing files/assets unless the Product Owner explicitly approves the exact targets.
- Do not run destructive migrations, reset non-local data or deploy to production without explicit approval.
- Keep changes additive where practical. If a generated archive conflicts with existing files, preserve the existing files and report the conflict.
- Implement only the requested phase; do not build the whole platform in one pass.

## Source-of-truth order
1. Latest explicit Product Owner instruction.
2. Accepted ADRs and approved change records.
3. PRD for product behavior.
4. TRD for technical constraints.
5. Workflow and UI design handoff.
6. Existing implementation/tests, unless they conflict with approved requirements.

If PRD and TRD conflict, stop the affected task and report the conflict. Never silently resolve it by guessing.
