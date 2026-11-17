-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - ROW LEVEL SECURITY (RLS) POLICIES
-- Migration: 20261117000002_rls_policies.sql
-- ==============================================================================

-- 1. Helper function: Get active tenant IDs for the current authenticated user
CREATE OR REPLACE FUNCTION get_user_active_tenants()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT tm.tenant_id
    FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.status = 'ACTIVE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Helper function: Check if current user is an active member of a specific tenant
CREATE OR REPLACE FUNCTION is_member_of_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = check_tenant_id
          AND tm.status = 'ACTIVE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Helper function: Check if current user holds the PLATFORM_ADMIN role
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM tenant_memberships tm
        JOIN membership_roles mr ON mr.membership_id = tm.id
        JOIN roles r ON r.id = mr.role_id
        WHERE tm.user_id = auth.uid()
          AND tm.status = 'ACTIVE'
          AND r.code = 'PLATFORM_ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- Enable Row Level Security on all core tables
-- ------------------------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Tenants Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "tenants_select_policy" ON tenants
    FOR SELECT
    USING (
        is_platform_admin() OR id IN (SELECT get_user_active_tenants())
    );

CREATE POLICY "tenants_insert_policy" ON tenants
    FOR INSERT
    WITH CHECK (
        is_platform_admin() OR auth.uid() IS NOT NULL
    );

CREATE POLICY "tenants_update_policy" ON tenants
    FOR UPDATE
    USING (
        is_platform_admin() OR (
            is_member_of_tenant(id) AND EXISTS (
                SELECT 1 FROM tenant_memberships tm
                JOIN membership_roles mr ON mr.membership_id = tm.id
                JOIN roles r ON r.id = mr.role_id
                WHERE tm.user_id = auth.uid() AND tm.tenant_id = tenants.id AND r.code = 'OWNER'
            )
        )
    );

-- ------------------------------------------------------------------------------
-- Locations Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "locations_select_policy" ON locations
    FOR SELECT
    USING (
        is_platform_admin() OR is_member_of_tenant(tenant_id)
    );

CREATE POLICY "locations_modify_policy" ON locations
    FOR ALL
    USING (
        is_platform_admin() OR (
            is_member_of_tenant(tenant_id) AND EXISTS (
                SELECT 1 FROM tenant_memberships tm
                JOIN membership_roles mr ON mr.membership_id = tm.id
                JOIN roles r ON r.id = mr.role_id
                WHERE tm.user_id = auth.uid() AND tm.tenant_id = locations.tenant_id AND r.code IN ('OWNER', 'MANAGER')
            )
        )
    );

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT
    USING (
        id = auth.uid() OR is_platform_admin() OR EXISTS (
            SELECT 1 FROM tenant_memberships tm1
            JOIN tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
            WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
        )
    );

CREATE POLICY "profiles_update_own_policy" ON profiles
    FOR UPDATE
    USING (id = auth.uid());

-- ------------------------------------------------------------------------------
-- Tenant Memberships Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "memberships_select_policy" ON tenant_memberships
    FOR SELECT
    USING (
        user_id = auth.uid() OR is_platform_admin() OR is_member_of_tenant(tenant_id)
    );

-- ------------------------------------------------------------------------------
-- Roles and Permissions Policies (Read-only for tenant members)
-- ------------------------------------------------------------------------------
CREATE POLICY "roles_select_policy" ON roles
    FOR SELECT
    USING (
        tenant_id IS NULL OR is_member_of_tenant(tenant_id) OR is_platform_admin()
    );

CREATE POLICY "permissions_select_policy" ON permissions
    FOR SELECT
    USING (true); -- Publicly viewable catalog of permissions

CREATE POLICY "role_permissions_select_policy" ON role_permissions
    FOR SELECT
    USING (true);

-- ------------------------------------------------------------------------------
-- Audit Logs Policies (Strictly append-only and viewable by authorized admins)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_logs_select_policy" ON audit_logs
    FOR SELECT
    USING (
        is_platform_admin() OR (
            is_member_of_tenant(tenant_id) AND EXISTS (
                SELECT 1 FROM tenant_memberships tm
                JOIN membership_roles mr ON mr.membership_id = tm.id
                JOIN roles r ON r.id = mr.role_id
                WHERE tm.user_id = auth.uid() AND tm.tenant_id = audit_logs.tenant_id AND r.code = 'OWNER'
            )
        )
    );

CREATE POLICY "audit_logs_insert_policy" ON audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
