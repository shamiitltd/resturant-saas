-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - BASELINE SEED DATA
-- Seed: seed.sql
-- ==============================================================================

-- 1. Insert Standard System Roles (tenant_id IS NULL)
INSERT INTO roles (id, tenant_id, code, name, description, is_system_role)
VALUES 
    ('11111111-1111-1111-1111-111111111101', NULL, 'PLATFORM_ADMIN', 'Platform Super Admin', 'Full SaaS platform administrative authority', true),
    ('11111111-1111-1111-1111-111111111102', NULL, 'OWNER', 'Restaurant Owner', 'Full control over restaurant tenant and operations', true),
    ('11111111-1111-1111-1111-111111111103', NULL, 'MANAGER', 'Branch Manager', 'Supervisory operational control for assigned locations', true),
    ('11111111-1111-1111-1111-111111111104', NULL, 'RECEPTIONIST', 'Receptionist / Cashier', 'Order reception, table session coordination and billing', true),
    ('11111111-1111-1111-1111-111111111105', NULL, 'CHEF', 'Kitchen Chef', 'KDS ticket management, order preparation, and chef ETA updates', true),
    ('11111111-1111-1111-1111-111111111106', NULL, 'WAITER', 'Service Staff', 'Waiter pickup tasks and table delivery', true)
ON CONFLICT DO NOTHING;

-- 2. Insert Standard Permission Keys
INSERT INTO permissions (id, code, module, description)
VALUES
    -- Orders
    ('22222222-2222-2222-2222-222222222201', 'orders.view', 'orders', 'View location orders'),
    ('22222222-2222-2222-2222-222222222202', 'orders.create', 'orders', 'Submit new customer order'),
    ('22222222-2222-2222-2222-222222222203', 'orders.accept', 'orders', 'Accept incoming kitchen order'),
    ('22222222-2222-2222-2222-222222222204', 'orders.update_status', 'orders', 'Update order lifecycle status'),
    ('22222222-2222-2222-2222-222222222205', 'orders.cancel', 'orders', 'Cancel / void an order'),
    -- Kitchen
    ('22222222-2222-2222-2222-222222222206', 'kitchen.view', 'kitchen', 'Access KDS display'),
    ('22222222-2222-2222-2222-222222222207', 'kitchen.set_eta', 'kitchen', 'Set estimated preparation time'),
    ('22222222-2222-2222-2222-222222222208', 'kitchen.mark_ready', 'kitchen', 'Mark KOT ready for serving'),
    -- Billing
    ('22222222-2222-2222-2222-222222222209', 'billing.view', 'billing', 'View table bills and receipts'),
    ('22222222-2222-2222-2222-222222222210', 'billing.create', 'billing', 'Generate consolidated bill'),
    ('22222222-2222-2222-2222-222222222211', 'billing.verify_payment', 'billing', 'Manually verify restaurant payment receipt'),
    -- Menu & Settings
    ('22222222-2222-2222-2222-222222222212', 'menu.manage', 'menu', 'Create and modify menu items, prices, and categories'),
    ('22222222-2222-2222-2222-222222222213', 'staff.manage', 'staff', 'Invite, configure, and deactivate staff memberships'),
    ('22222222-2222-2222-2222-222222222214', 'platform.manage_tenants', 'platform', 'Platform Super Admin tenant management')
ON CONFLICT (code) DO NOTHING;

-- 3. Map Owner Role to All Tenant Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '11111111-1111-1111-1111-111111111102', id
FROM permissions
WHERE module != 'platform'
ON CONFLICT DO NOTHING;

-- Map Super Admin to Platform Permissions
INSERT INTO role_permissions (role_id, permission_id)
VALUES ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222214')
ON CONFLICT DO NOTHING;

-- Map Chef to Kitchen Permissions
INSERT INTO role_permissions (role_id, permission_id)
VALUES 
    ('11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222201'),
    ('11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222203'),
    ('11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222206'),
    ('11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222207'),
    ('11111111-1111-1111-1111-111111111105', '22222222-2222-2222-2222-222222222208')
ON CONFLICT DO NOTHING;

-- 4. Synthetic Isolated Test Tenants for Negative Tests (T-01, T-02)
-- Tenant A: Spice Garden
INSERT INTO tenants (id, slug, name, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'spice-garden', 'Spice Garden Restaurant', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, tenant_id, code, name, timezone, service_mode, status)
VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'main-outlet', 'Spice Garden Downtown', 'Asia/Kolkata', 'TABLE_SERVICE', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- Tenant B: Urban Bistro
INSERT INTO tenants (id, slug, name, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'urban-bistro', 'Urban Bistro Cafe', 'ACTIVE')
ON CONFLICT DO NOTHING;

INSERT INTO locations (id, tenant_id, code, name, timezone, service_mode, status)
VALUES ('b1111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'main-outlet', 'Urban Bistro Uptown', 'Asia/Kolkata', 'TABLE_SERVICE', 'ACTIVE')
ON CONFLICT DO NOTHING;
