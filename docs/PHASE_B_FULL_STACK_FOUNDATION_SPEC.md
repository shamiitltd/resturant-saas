# Phase B — Full-Stack Foundation Specification

## 1. Supabase Auth Architecture & Session Flow
- **Source of Truth**: Supabase Auth manages all user credentials, password hashing, email/password verification, OTP, session tokens, and JWT issuance.
- **No Custom Parallel Auth**: The platform does not implement a parallel password hashing or custom JWT issuance system.
- **Next.js to NestJS Session Flow**:
  1. The browser / Next.js client interacts with Supabase Auth (via `@supabase/supabase-js` or `@supabase/ssr`) to sign in and obtain a Supabase access token (JWT).
  2. The JWT is transmitted to the NestJS API via the standard `Authorization: Bearer <supabase_jwt>` header.
  3. The NestJS backend validates the JWT cryptographically using the project's `SUPABASE_JWT_SECRET` (or Supabase public keys/JWKS) via a dedicated Passport/JWT Strategy (`SupabaseAuthStrategy`).
  4. The NestJS backend extracts the verified `sub` (Supabase Auth `user_id`) from the validated token. It queries the local `tenant_memberships`, `membership_roles`, and `location_memberships` tables to build the trusted, immutable `TenantContext`.

## 2. Database Connection & RLS Security
- **Connection Strategy**:
  - NestJS connects to Supabase PostgreSQL using connection pooling (via standard PostgreSQL client with prepared statements).
  - The ORM choice remains explicitly **OPEN** (ADR-03). A clean, lightweight repository pattern with typed SQL ensures no lock-in.
- **Service-Role Boundary & Tenant Isolation**:
  - **Critical Rule**: A privileged `service-role` connection bypasses PostgreSQL Row-Level Security (RLS). The application code **never assumes** RLS protects privileged queries.
  - Every tenant-owned database query executed by NestJS explicitly includes `WHERE tenant_id = :tenant_id` (and `location_id = :location_id` for branch-scoped operations).
  - Client-supplied `tenant_id`, `location_id`, roles, or permissions in request bodies or query params are **never trusted**.
  - Row-Level Security policies are strictly defined in migrations `00001_core_schema.sql` and `00002_rls_policies.sql` to protect all direct/user-scoped database operations.

## 3. Controlled Owner Registration Workflow
- **Atomicity**: Tenant provisioning and owner registration must execute in a single ACID database transaction:
  1. Insert into `tenants` (generating `id` and validating unique `slug`).
  2. Insert into `locations` (default primary branch with timezone and address).
  3. Insert into `profiles` (binding `user_id` from Supabase Auth).
  4. Insert into `tenant_memberships` (status `ACTIVE`).
  5. Assign the immutable platform default `OWNER` role to this membership.
  6. Insert default branch assignment in `location_memberships`.
  7. Record an entry in `audit_logs`.
- **Abuse & Escalation Safeguards**:
  - Public registration can only create a tenant and assign the `OWNER` role to the registering user for that specific new tenant.
  - Users cannot register themselves as `SUPER_ADMIN` or assign arbitrary existing tenant memberships.
  - Strict input validation prevents slug collision, invalid characters, and duplicate registrations.

## 4. Phase B Super Admin Scope Boundary
- Phase B implements:
  - Super Admin role definition in seed data (`PLATFORM_ADMIN`).
  - Protected Super Admin route shell in Next.js `(admin)`.
  - Backend authorization guard ensuring only verified platform administrators can access `/v1/platform/*`.
- Phase B **defers** the full tenant lifecycle dashboard, billing operations, and system maintenance interfaces to later vertical slices.

## 5. Phase B Full-Stack Execution Checklist
- [x] Step 1: Initialize Git repository and verify root configuration.
- [x] Step 2: Configure monorepo workspace (`pnpm-workspace.yaml`, `turbo.json`, root `package.json`).
- [x] Step 3: Author authoritative Supabase SQL migrations (`00001_core_schema.sql`, `00002_rls_policies.sql`, `seed.sql`).
- [x] Step 4: Create shared contracts package (`packages/contracts`) with typed DTOs and interfaces.
- [x] Step 5: Create shared UI package (`packages/ui`) with verified design tokens (`#08172F`, `#002CE8`, `#EF5301`, `#005CFE`).
- [x] Step 6: Scaffold NestJS modular monolith (`apps/api`) with Auth, Tenant, and RBAC modules.
- [x] Step 7: Implement automated negative cross-tenant isolation tests (`T-01`, `T-02`).
- [x] Step 8: Scaffold Next.js application (`apps/web`) with route groups `(auth)`, `(customer)`, `(staff)`, `(owner)`, `(admin)`.
- [x] Step 9: Implement and connect live authentication screens matching references:
  - `05-authentication/01-login.png` (`/login`)
  - `05-authentication/02-owner-registration.png` (`/register`)
  - `05-authentication/05-email-otp-verification.png` (`/verify-otp`)
  - `05-authentication/06-select-restaurant-outlet.png` (`/select-outlet`)
  - `05-authentication/07-access-denied.png` (`/access-denied`)
- [x] Step 10: Run linting, type checks, build, and automated test suite.
