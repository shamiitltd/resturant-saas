-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE C.1 SECURITY & RELIABILITY REMEDIATION
-- Migration: 20261117000004_phase_c1_remediations.sql
-- ==============================================================================

-- 1. SEC-CONC-01: Partial Unique Index to enforce single active session per physical table
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_table_session
    ON table_sessions(table_id) WHERE (status = 'OPEN');

-- 2. BUS-TAX-01: Add configurable tax_rate_percent to tenants (default 5.00 for existing dine-in records)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00;

-- 3. SEC-RLS-01: Correct Public Menu RLS Policies with Tenant Verification
DROP POLICY IF EXISTS "public_menu_categories_select" ON menu_categories;
DROP POLICY IF EXISTS "public_menu_items_select" ON menu_items;
DROP POLICY IF EXISTS "public_modifier_groups_select" ON modifier_groups;
DROP POLICY IF EXISTS "public_item_modifier_groups_select" ON item_modifier_groups;
DROP POLICY IF EXISTS "public_item_modifiers_select" ON item_modifiers;

-- Public menu categories: Must be active and belong to an active tenant
CREATE POLICY "public_menu_categories_select" ON menu_categories
    FOR SELECT USING (
        is_active = true AND
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = menu_categories.tenant_id AND t.status = 'ACTIVE'
        )
    );

-- Public menu items: Must be available and belong to an active tenant
CREATE POLICY "public_menu_items_select" ON menu_items
    FOR SELECT USING (
        is_available = true AND
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = menu_items.tenant_id AND t.status = 'ACTIVE'
        )
    );

-- Public modifier groups: Must belong to an active tenant
CREATE POLICY "public_modifier_groups_select" ON modifier_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = modifier_groups.tenant_id AND t.status = 'ACTIVE'
        )
    );

-- Public item modifier mappings: Must map to an available item in an active tenant
CREATE POLICY "public_item_modifier_groups_select" ON item_modifier_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM menu_items mi
            JOIN tenants t ON t.id = mi.tenant_id
            WHERE mi.id = item_modifier_groups.item_id AND t.status = 'ACTIVE' AND mi.is_available = true
        )
    );

-- Public item modifiers: Must be available and belong to an active tenant's modifier group
CREATE POLICY "public_item_modifiers_select" ON item_modifiers
    FOR SELECT USING (
        is_available = true AND
        EXISTS (
            SELECT 1 FROM modifier_groups mg
            JOIN tenants t ON t.id = mg.tenant_id
            WHERE mg.id = item_modifiers.group_id AND t.status = 'ACTIVE'
        )
    );

-- 4. Customer Table Session Read Access
DROP POLICY IF EXISTS "customer_table_sessions_select" ON table_sessions;
CREATE POLICY "customer_table_sessions_select" ON table_sessions
    FOR SELECT USING (
        status = 'OPEN' AND
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = table_sessions.tenant_id AND t.status = 'ACTIVE'
        )
    );

-- 5. Customer & Staff Orders Policy
DROP POLICY IF EXISTS "staff_orders_select" ON orders;
CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (
        is_platform_admin() OR
        is_member_of_tenant(tenant_id) OR
        EXISTS (
            SELECT 1 FROM table_sessions ts
            WHERE ts.id = orders.table_session_id AND ts.status = 'OPEN'
        )
    );
