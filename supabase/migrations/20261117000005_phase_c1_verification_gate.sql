-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE C.1 VERIFICATION GATE
-- Migration: 20261117000005_phase_c1_verification_gate.sql
-- ==============================================================================

-- 1. Remove implicit 5.00 tax default; unconfigured tax is represented as NULL
ALTER TABLE tenants ALTER COLUMN tax_rate_percent DROP DEFAULT;
ALTER TABLE tenants ALTER COLUMN tax_rate_percent DROP NOT NULL;

-- 2. Revoke broad public/anonymous policies on sensitive customer tables
-- A custom x-session-token header validated by NestJS does not establish a PostgreSQL RLS role.
-- Therefore, direct anonymous Supabase access must NOT have SELECT on table_sessions or orders.
DROP POLICY IF EXISTS "customer_table_sessions_select" ON table_sessions;
DROP POLICY IF EXISTS "orders_select_policy" ON orders;

-- Reinstate strict staff & platform-admin only RLS policies for table_sessions
CREATE POLICY "staff_table_sessions_select" ON table_sessions
    FOR SELECT USING (
        is_platform_admin() OR is_member_of_tenant(tenant_id)
    );

-- Reinstate strict staff & platform-admin only RLS policies for orders
CREATE POLICY "staff_orders_select" ON orders
    FOR SELECT USING (
        is_platform_admin() OR is_member_of_tenant(tenant_id)
    );

-- 3. Allow public reading of ACTIVE tenant public profile for menu resolution & catalog subqueries
DROP POLICY IF EXISTS "public_active_tenants_select" ON tenants;
CREATE POLICY "public_active_tenants_select" ON tenants
    FOR SELECT USING (status = 'ACTIVE');
