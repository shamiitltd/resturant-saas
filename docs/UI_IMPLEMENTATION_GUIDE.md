# UI Implementation Guide for Antigravity

## Goal
Reproduce the approved 113-screen design set in the single Next.js application. This is a frontend implementation handoff, not permission to change product requirements.

## Before each screen
1. Find the reference number and exact existing image.
2. Read its screen-inventory entry and linked PRD requirement IDs.
3. Identify role, route, layout, components, actions, data and permission boundaries.
4. List unresolved design/behavior questions before coding.

## Implementation approach
- Build design tokens and shared primitives first.
- Build shared role shells/navigation before individual pages.
- Implement one coherent module at a time.
- Use reusable components and typed API contracts.
- Keep fixtures clearly marked and isolated while backend APIs are unavailable.
- Do not make buttons decorative/inert; connect actions to real authorized operations or clearly mark the feature as not yet wired.

## Screen acceptance checklist
- Visual hierarchy and layout match reference.
- Correct role, route and navigation.
- Loading, empty, error, success, disabled and permission-denied states.
- Responsive desktop/tablet/mobile behavior.
- Keyboard accessibility, visible focus, labels and contrast.
- No client-side trust of tenant IDs, permissions, prices, totals or payment state.
- All displayed business data is from authorized APIs or explicitly labelled fixtures.
- Visual comparison and QA status recorded in the inventory.

## Preservation rule
Never delete, rename, overwrite or regenerate any existing UI reference asset. Add new files only; resolve filename collisions by preserving the original and reporting the conflict.
