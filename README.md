# Restaurant SaaS — Documentation Update v1.1

This package updates the documentation baseline after the Product Owner's approvals dated 17 November 2026. It is designed to be merged into the existing repository without replacing UI reference assets.

## Included
- `docs/RESTAURANT_SAAS_PRD_v1.1.txt`
- `docs/RESTAURANT_SAAS_TRD_v1.1.txt`
- `docs/RESTAURANT_SAAS_END_TO_END_WORKFLOW_v1.3.txt`
- `AGENTS.md`
- Three accepted ADRs
- UI design system, inventory, implementation guide and requirement mapping

## Non-destructive merge instructions
1. Back up or commit the current repository before applying this package.
2. Copy the updated PRD/TRD/workflow and `AGENTS.md` into their documented locations. Keep the old versions in version control/history; do not overwrite the old versioned PRD/TRD filenames.
3. Add the new ADR and UI documentation files.
4. Preserve the existing `docs/ui-design/` directory and every image inside it. This package intentionally contains no replacement UI screenshots.
5. Merge the UI documentation into the existing docs tree. Do not extract with a delete/clean operation.
6. Review `UI_SCREEN_INVENTORY.md` and map references 001–103 from the existing collection. References 104–113 are listed from the latest design sequence.
7. Update repository links/paths only after confirming the actual existing folder structure.

## Approved decisions
- NestJS + TypeScript modular monolith.
- One Next.js application with customer, staff, owner and Super Admin route groups.
- Table session groups multiple independent orders; consolidated bill default; future split-bill compatibility only.

## Still OPEN
ORM/DB access strategy, background queue/Redis, tax/invoicing, SaaS payment gateway, subscription packaging, hosting/capacity/SLA, cancellation/refund authority, retention/privacy, marketplace route/provider/financial reconciliation and other previously open decisions.
