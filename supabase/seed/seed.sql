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

-- 5. Seed Tables, QR Tokens and Initial Table Session for Tenant A (Spice Garden)
INSERT INTO restaurant_tables (id, tenant_id, location_id, table_code, label, capacity, status)
VALUES 
    ('t1111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'T-01', 'Table 1 (Indoor Garden)', 4, 'AVAILABLE'),
    ('t1111111-1111-1111-1111-111111111102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'T-02', 'Table 2 (Window Booth)', 2, 'AVAILABLE')
ON CONFLICT DO NOTHING;

INSERT INTO qr_tokens (id, tenant_id, location_id, table_id, token_hash, raw_token, status)
VALUES 
    ('q1111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111101', 'hash_demo_spice_table_1', 'demo-spice-table-1', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- 6. Seed Menu Categories & Items for Spice Garden
INSERT INTO menu_categories (id, tenant_id, location_id, name, slug, description, display_order, is_active)
VALUES 
    ('c1111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'Signature Starters', 'starters', 'Crispy appetizers & clay oven bites', 1, true),
    ('c1111111-1111-1111-1111-111111111102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'Curries & Mains', 'mains', 'Authentic slow-simmered regional delicacies', 2, true),
    ('c1111111-1111-1111-1111-111111111103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'Artisan Beverages', 'beverages', 'Cooling coolers and freshly brewed drinks', 3, true)
ON CONFLICT DO NOTHING;

-- Modifiers
INSERT INTO modifier_groups (id, tenant_id, name, min_selection, max_selection, is_required)
VALUES 
    ('g1111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Spice Preference', 1, 1, true),
    ('g1111111-1111-1111-1111-111111111102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Optional Add-ons', 0, 2, false)
ON CONFLICT DO NOTHING;

INSERT INTO item_modifiers (id, group_id, name, price_minor, is_available, display_order)
VALUES 
    ('m1111111-1111-1111-1111-111111111101', 'g1111111-1111-1111-1111-111111111101', 'Mild', 0, true, 1),
    ('m1111111-1111-1111-1111-111111111102', 'g1111111-1111-1111-1111-111111111101', 'Medium Spice', 0, true, 2),
    ('m1111111-1111-1111-1111-111111111103', 'g1111111-1111-1111-1111-111111111101', 'Fiery Hot', 0, true, 3),
    ('m1111111-1111-1111-1111-111111111104', 'g1111111-1111-1111-1111-111111111102', 'Extra Garlic Butter', 4000, true, 1),
    ('m1111111-1111-1111-1111-111111111105', 'g1111111-1111-1111-1111-111111111102', 'Grated Truffle Cheese', 7500, true, 2)
ON CONFLICT DO NOTHING;

-- Menu Items
INSERT INTO menu_items (id, tenant_id, location_id, category_id, name, description, base_price_minor, currency, is_available, is_vegetarian, preparation_time_minutes, display_order)
VALUES 
    ('i1111111-1111-1111-1111-111111111101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111101', 'Smoked Paneer Tikka', 'Charcoal-grilled cottage cheese with bell peppers and roasted cumin marinade', 38000, 'INR', true, true, 15, 1),
    ('i1111111-1111-1111-1111-111111111102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111101', 'Crispy Lotus Stem Honey Chilli', 'Wok-tossed lotus root slices glazed with mountain honey and toasted sesame', 34000, 'INR', true, true, 12, 2),
    ('i1111111-1111-1111-1111-111111111103', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111102', 'Old Delhi Butter Dal Makhani', 'Slow-cooked black lentils simmered for 24 hours with churned white butter', 42000, 'INR', true, true, 20, 1),
    ('i1111111-1111-1111-1111-111111111104', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111103', 'Alphonso Mango Lassi', 'Chilled yogurt smoothie whipped with ratnagiri mango pulp and cardamom', 19000, 'INR', true, true, 5, 1)
ON CONFLICT DO NOTHING;

-- Link Modifiers to Paneer Tikka
INSERT INTO item_modifier_groups (item_id, group_id)
VALUES 
    ('i1111111-1111-1111-1111-111111111101', 'g1111111-1111-1111-1111-111111111101'),
    ('i1111111-1111-1111-1111-111111111101', 'g1111111-1111-1111-1111-111111111102')
ON CONFLICT DO NOTHING;
