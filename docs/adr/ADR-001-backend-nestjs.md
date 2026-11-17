# ADR-001: Backend Framework — NestJS

- Status: Accepted / Approved by Product Owner
- Date: 17 November 2026

## Decision
Use NestJS with TypeScript for the backend, organized as a modular monolith.

## Context
The platform needs explicit module boundaries, validation, authentication/authorization integration, background processing and testable business services.

## Consequences
- Backend modules remain within one modular monolith initially.
- REST contracts remain explicit and versionable.
- Supabase PostgreSQL remains the database direction and SQL migrations remain authoritative.
- This decision does not select an ORM or background queue. Those remain separate OPEN decisions.
