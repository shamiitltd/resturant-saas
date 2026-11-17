# ADR-003: Table Session and Consolidated Billing Default

- Status: Accepted / Approved by Product Owner
- Date: 17 November 2026

## Decision
One active table session may group multiple independent customer-submitted orders/KOTs. Consolidated table billing is the default. The data model must remain extensible for future split-bill support without major redesign.

## Context
In TRD Table 37, table session and billing behavior was listed under 'ADR-08 Table session'. It has been formalized in this repository under the accepted file `ADR-003-table-session-consolidated-billing.md`.

> **Critical Distinction**: This accepted decision (`ADR-003`) addresses table sessions and consolidated billing ONLY. It must **NOT** be confused with TRD Table 37 'ADR-03 Database access / ORM strategy' (Drizzle vs SQLAlchemy/other), which remains explicitly **OPEN**.

## Explicit scope boundary
Split billing is not authorized for current implementation. Do not implement individual customer bills, item-level splitting, partial settlements or complex split-payment workflows without a separate approval.

## Consequences
- Orders remain independent records with their own status history and immutable line-item snapshots.
- A bill can aggregate eligible orders linked to the active table session.
- Draft carts remain private to their originating browser/session unless shared-cart behavior is separately approved.
- Avoid a schema that assumes one order equals exactly one bill.
