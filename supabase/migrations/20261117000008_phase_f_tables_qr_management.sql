-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE F: OWNER TABLE & QR CODE MANAGEMENT
-- Migration: 20261117000008_phase_f_tables_qr_management.sql
-- PRD Requirements: FR-OWN-02, FR-ORD-01
-- ==============================================================================

-- 1. Additive table configuration columns on restaurant_tables
ALTER TABLE restaurant_tables
    ADD COLUMN IF NOT EXISTS section VARCHAR(64) NOT NULL DEFAULT 'Main Hall',
    ADD COLUMN IF NOT EXISTS table_type VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS allow_qr_ordering BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Tenant-scoped RLS policies for restaurant_tables & qr_tokens management
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'restaurant_tables' AND policyname = 'staff_tables_manage'
    ) THEN
        CREATE POLICY "staff_tables_manage" ON restaurant_tables
            FOR ALL
            USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
            WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'qr_tokens' AND policyname = 'staff_qr_tokens_select'
    ) THEN
        CREATE POLICY "staff_qr_tokens_select" ON qr_tokens
            FOR SELECT
            USING (is_platform_admin() OR is_member_of_tenant(tenant_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'qr_tokens' AND policyname = 'staff_qr_tokens_manage'
    ) THEN
        CREATE POLICY "staff_qr_tokens_manage" ON qr_tokens
            FOR ALL
            USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
            WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));
    END IF;
END $$;
