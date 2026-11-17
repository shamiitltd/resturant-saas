# ADR-002: Frontend Topology — Single Next.js Application

- Status: Accepted / Approved by Product Owner
- Date: 17 November 2026

## Decision
Use one Next.js application with role-specific route groups/layouts for customer, staff, restaurant owner and platform Super Admin experiences.

## Consequences
- Shared design tokens, components, navigation primitives and API clients can be reused.
- Customer pages are mobile-first; operational dashboards are responsive.
- Route groups are not a security boundary. Backend authorization and tenant/location scoping are mandatory.
