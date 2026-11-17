-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - CUSTOMER QR MENU & ORDERING SCHEMA
-- Migration: 20261117000003_customer_ordering.sql
-- ==============================================================================

-- 1. Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_code VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, OCCUPIED, RESERVED, INACTIVE
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_location_table_code UNIQUE (tenant_id, location_id, table_code)
);

CREATE INDEX IF NOT EXISTS idx_tables_location ON restaurant_tables(location_id, status);

-- 2. Secure Revocable QR Tokens
CREATE TABLE IF NOT EXISTS qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    raw_token VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    expires_at TIMESTAMPTZ,
    rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_lookup ON qr_tokens(raw_token, status);

-- 3. Table Sessions (Visit grouping for multiple independent customer orders)
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    session_token VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- OPEN, CLOSING, CLOSED
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_active ON table_sessions(table_id, status);

-- 4. Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant ON menu_categories(tenant_id, display_order);

-- 5. Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price_minor INT NOT NULL CHECK (base_price_minor >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_vegetarian BOOLEAN NOT NULL DEFAULT false,
    preparation_time_minutes INT NOT NULL DEFAULT 15,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_cat ON menu_items(category_id, is_available);

-- 6. Modifier Groups & Modifiers
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0,
    max_selection INT NOT NULL DEFAULT 1,
    is_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_modifier_groups (
    item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, group_id)
);

CREATE TABLE IF NOT EXISTS item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    price_minor INT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
    is_available BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0
);

-- 7. Orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    order_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PLACED', -- PLACED, ACCEPTED, PREPARING, READY, SERVED, COMPLETED, REJECTED, CANCELLED
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal_minor INT NOT NULL,
    tax_minor INT NOT NULL DEFAULT 0,
    discount_minor INT NOT NULL DEFAULT 0,
    total_minor INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    source_channel VARCHAR(32) NOT NULL DEFAULT 'QR_DINE_IN',
    fulfilment_type VARCHAR(32) NOT NULL DEFAULT 'DINE_IN',
    chef_eta_minutes INT,
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(table_session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_location_status ON orders(location_id, status);

-- 8. Order Items (Immutable Price and Modifier Snapshots)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES menu_items(id),
    item_name_snapshot VARCHAR(255) NOT NULL,
    unit_price_minor INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal_minor INT NOT NULL,
    notes TEXT,
    selected_modifiers JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 9. Order Status Events
CREATE TABLE IF NOT EXISTS order_status_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_events ON order_status_events(order_id, occurred_at ASC);

-- 10. Notification Outbox
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON notification_outbox(status, created_at ASC);

-- ------------------------------------------------------------------------------
-- Row-Level Security for Phase C Tables
-- ------------------------------------------------------------------------------
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- Public can view active menu categories and items for the restaurant
CREATE POLICY "public_menu_categories_select" ON menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "public_menu_items_select" ON menu_items FOR SELECT USING (is_available = true);
CREATE POLICY "public_modifier_groups_select" ON modifier_groups FOR SELECT USING (true);
CREATE POLICY "public_item_modifier_groups_select" ON item_modifier_groups FOR SELECT USING (true);
CREATE POLICY "public_item_modifiers_select" ON item_modifiers FOR SELECT USING (is_available = true);

-- Staff with location membership can view/manage their location's tables and orders
CREATE POLICY "staff_tables_select" ON restaurant_tables FOR SELECT USING (is_platform_admin() OR is_member_of_tenant(tenant_id));
CREATE POLICY "staff_orders_select" ON orders FOR SELECT USING (is_platform_admin() OR is_member_of_tenant(tenant_id));
CREATE POLICY "staff_order_items_select" ON order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (is_platform_admin() OR is_member_of_tenant(o.tenant_id)))
);
