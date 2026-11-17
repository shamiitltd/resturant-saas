-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE D STAFF OPERATIONS & KDS
-- Migration: 20261117000006_phase_d_staff_kds.sql
-- ==============================================================================

-- 1. Additive Operational Columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_updated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS eta_set_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id) WHERE waiter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_location ON orders(location_id, status, created_at DESC);

-- 2. Insert Staff Permissions for Waiter and Order Completion
INSERT INTO permissions (id, code, module, description)
VALUES
    ('22222222-2222-2222-2222-222222222215', 'waiter.view', 'waiter', 'View ready orders and service tasks'),
    ('22222222-2222-2222-2222-222222222216', 'waiter.serve', 'waiter', 'Mark orders picked up and delivered to table'),
    ('22222222-2222-2222-2222-222222222217', 'orders.complete', 'orders', 'Mark order service completed')
ON CONFLICT (code) DO NOTHING;

-- 3. Map Role Permissions dynamically when roles exist
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'WAITER' AND p.code IN ('orders.view', 'orders.update_status', 'waiter.view', 'waiter.serve')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'RECEPTIONIST' AND p.code IN (
    'orders.view', 'orders.accept', 'orders.update_status', 'orders.cancel',
    'billing.view', 'billing.create', 'billing.verify_payment', 'orders.complete'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'CHEF' AND p.code IN ('orders.update_status', 'orders.cancel')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'MANAGER' AND p.module IN ('orders', 'kitchen', 'billing', 'waiter')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'OWNER' AND p.module IN ('waiter', 'orders')
ON CONFLICT DO NOTHING;

-- 4. Staff Order Update & Status Event RLS Policies
DROP POLICY IF EXISTS "staff_orders_update" ON orders;
CREATE POLICY "staff_orders_update" ON orders
    FOR UPDATE USING (
        is_platform_admin() OR is_member_of_tenant(tenant_id)
    );

DROP POLICY IF EXISTS "staff_order_events_insert" ON order_status_events;
CREATE POLICY "staff_order_events_insert" ON order_status_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_id AND (is_platform_admin() OR is_member_of_tenant(o.tenant_id))
        )
    );

DROP POLICY IF EXISTS "staff_order_events_select" ON order_status_events;
CREATE POLICY "staff_order_events_select" ON order_status_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_id AND (is_platform_admin() OR is_member_of_tenant(o.tenant_id))
        )
    );
