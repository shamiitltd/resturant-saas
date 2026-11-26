-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE G: TABLE RESERVATIONS & WALK-IN WAITLIST
-- Migration: 20261117000009_phase_g_reservations_waitlist.sql
-- Covers: Owner & Staff Table Reservations, Time Slot Booking, Walk-in Waitlist
-- ==============================================================================

-- 1. Table Reservations Table
CREATE TABLE IF NOT EXISTS table_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    reservation_code VARCHAR(32) NOT NULL,
    guest_name VARCHAR(128) NOT NULL,
    guest_phone VARCHAR(32) NOT NULL,
    guest_email VARCHAR(255),
    party_size INT NOT NULL CHECK (party_size >= 1 AND party_size <= 40),
    reservation_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED'
        CHECK (status IN ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW')),
    source VARCHAR(32) NOT NULL DEFAULT 'STAFF'
        CHECK (source IN ('WEBSITE', 'PHONE', 'WALK_IN', 'STAFF', 'APP')),
    occasion VARCHAR(64),
    special_requests TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    seated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_lookup
    ON table_reservations(tenant_id, location_id, reservation_date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table
    ON table_reservations(table_id, reservation_date);

-- 2. Walk-in Waitlist Queue Table
CREATE TABLE IF NOT EXISTS table_waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    queue_number INT NOT NULL,
    guest_name VARCHAR(128) NOT NULL,
    guest_phone VARCHAR(32) NOT NULL,
    party_size INT NOT NULL CHECK (party_size >= 1 AND party_size <= 40),
    section_preference VARCHAR(64) DEFAULT 'ANY',
    status VARCHAR(32) NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'NOTIFIED', 'SEATED', 'CANCELLED', 'NO_SHOW')),
    estimated_wait_minutes INT DEFAULT 15,
    assigned_table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notified_at TIMESTAMPTZ,
    seated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_lookup
    ON table_waitlist(tenant_id, location_id, status, created_at);

-- 3. Row Level Security Policies
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_waitlist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'table_reservations' AND policyname = 'staff_reservations_manage'
    ) THEN
        CREATE POLICY "staff_reservations_manage" ON table_reservations
            FOR ALL
            USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
            WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'table_waitlist' AND policyname = 'staff_waitlist_manage'
    ) THEN
        CREATE POLICY "staff_waitlist_manage" ON table_waitlist
            FOR ALL
            USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
            WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));
    END IF;
END $$;

-- 4. Seed Essential Permissions for Reservations & Waitlist
INSERT INTO permissions (id, code, module, description)
VALUES
    ('22222222-2222-2222-2222-222222222220', 'reservations.view', 'reservations', 'View table reservations and waitlist'),
    ('22222222-2222-2222-2222-222222222221', 'reservations.manage', 'reservations', 'Create, seat, and cancel reservations or waitlist entries')
ON CONFLICT (code) DO NOTHING;

-- Grant to default Owner and Receptionist roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111102', id FROM permissions WHERE code IN ('reservations.view', 'reservations.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111104', id FROM permissions WHERE code IN ('reservations.view', 'reservations.manage')
ON CONFLICT DO NOTHING;
