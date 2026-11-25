-- ==============================================================================
-- RESTAURANT SAAS PLATFORM - PHASE E RESTAURANT BILLING & PAYMENT VERIFICATION
-- Migration: 20261117000007_phase_e_billing_payments.sql
-- ==============================================================================

-- 1. Restaurant Payment Settings (Branch-level direct UPI QR / payment instructions)
-- Strictly separate from company SaaS subscription billing (ADR-07, FR-PAY-02, FR-PAY-06)
CREATE TABLE IF NOT EXISTS restaurant_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    upi_id VARCHAR(128),
    display_name VARCHAR(255),
    qr_asset_url TEXT,
    instructions TEXT,
    accepted_methods JSONB NOT NULL DEFAULT '["RESTAURANT_UPI_QR","CASH","CARD","OTHER"]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_settings_tenant_location UNIQUE (tenant_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_settings_location ON restaurant_payment_settings(location_id, is_active);

-- 2. Restaurant Bills (Consolidated table-session bills per ADR-003)
CREATE TABLE IF NOT EXISTS restaurant_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    table_session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    bill_number VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'UNPAID'
        CHECK (status IN ('UNPAID', 'PAYMENT_REPORTED', 'VERIFIED_PAID', 'VOIDED')),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal_minor INT NOT NULL CHECK (subtotal_minor >= 0),
    tax_minor INT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    tax_rate_percent NUMERIC(5,2),
    discount_minor INT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
    total_minor INT NOT NULL CHECK (total_minor >= 0),
    notes TEXT,
    void_reason TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    voided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bill_number_tenant UNIQUE (tenant_id, bill_number)
);

-- Enforce at most one non-voided consolidated bill per table session (ADR-003)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_bill_per_session
    ON restaurant_bills(table_session_id)
    WHERE (table_session_id IS NOT NULL AND status != 'VOIDED');

CREATE INDEX IF NOT EXISTS idx_restaurant_bills_location_status
    ON restaurant_bills(location_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_bills_tenant_created
    ON restaurant_bills(tenant_id, created_at DESC);

-- 3. Bill Orders Join Table (Preserves multiple independent orders/KOTs & future split-bill compatibility)
CREATE TABLE IF NOT EXISTS bill_orders (
    bill_id UUID NOT NULL REFERENCES restaurant_bills(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bill_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_orders_order ON bill_orders(order_id);

-- 4. Bill Lines (Immutable snapshots copied from persisted order_items)
CREATE TABLE IF NOT EXISTS bill_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES restaurant_bills(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    item_name_snapshot VARCHAR(255) NOT NULL,
    unit_price_minor INT NOT NULL CHECK (unit_price_minor >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    line_total_minor INT NOT NULL CHECK (line_total_minor >= 0),
    selected_modifiers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill ON bill_lines(bill_id);

-- 5. Restaurant Payments (Diner-to-restaurant payment recording & staff verification)
-- Separate from SaaS company payment_gateway_events / subscription_payments (FR-PAY-06, FR-PAY-07)
CREATE TABLE IF NOT EXISTS restaurant_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL REFERENCES restaurant_bills(id) ON DELETE CASCADE,
    amount_minor INT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    method VARCHAR(32) NOT NULL
        CHECK (method IN ('RESTAURANT_UPI_QR', 'CASH', 'CARD', 'OTHER')),
    status VARCHAR(32) NOT NULL DEFAULT 'PAYMENT_REPORTED'
        CHECK (status IN ('UNPAID', 'PAYMENT_REPORTED', 'VERIFIED_PAID', 'REJECTED', 'VOIDED')),
    customer_reference VARCHAR(128),
    reported_by_type VARCHAR(32) NOT NULL
        CHECK (reported_by_type IN ('CUSTOMER_GUEST', 'TENANT_USER')),
    reported_by_id UUID,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_restaurant_payment_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_payments_bill
    ON restaurant_payments(bill_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_payments_location_status
    ON restaurant_payments(location_id, status, created_at DESC);

-- 6. Billing Permissions & Role Mappings
INSERT INTO permissions (id, code, module, description)
VALUES
    ('22222222-2222-2222-2222-222222222218', 'billing.void', 'billing', 'Void unpaid or erroneous restaurant bills')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'RECEPTIONIST' AND p.code IN ('billing.view', 'billing.create', 'billing.verify_payment')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('MANAGER', 'OWNER') AND p.module = 'billing'
ON CONFLICT DO NOTHING;

-- 7. Row-Level Security (Strict Tenant Isolation; No direct anonymous access)
ALTER TABLE restaurant_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_payment_settings_select" ON restaurant_payment_settings;
CREATE POLICY "staff_payment_settings_select" ON restaurant_payment_settings
    FOR SELECT USING (is_platform_admin() OR is_member_of_tenant(tenant_id));

DROP POLICY IF EXISTS "staff_payment_settings_modify" ON restaurant_payment_settings;
CREATE POLICY "staff_payment_settings_modify" ON restaurant_payment_settings
    FOR ALL USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
    WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));

DROP POLICY IF EXISTS "staff_restaurant_bills_select" ON restaurant_bills;
CREATE POLICY "staff_restaurant_bills_select" ON restaurant_bills
    FOR SELECT USING (is_platform_admin() OR is_member_of_tenant(tenant_id));

DROP POLICY IF EXISTS "staff_restaurant_bills_modify" ON restaurant_bills;
CREATE POLICY "staff_restaurant_bills_modify" ON restaurant_bills
    FOR ALL USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
    WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));

DROP POLICY IF EXISTS "staff_bill_orders_all" ON bill_orders;
CREATE POLICY "staff_bill_orders_all" ON bill_orders
    FOR ALL USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
    WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));

DROP POLICY IF EXISTS "staff_bill_lines_all" ON bill_lines;
CREATE POLICY "staff_bill_lines_all" ON bill_lines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM restaurant_bills b
            WHERE b.id = bill_lines.bill_id
              AND (is_platform_admin() OR is_member_of_tenant(b.tenant_id))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM restaurant_bills b
            WHERE b.id = bill_lines.bill_id
              AND (is_platform_admin() OR is_member_of_tenant(b.tenant_id))
        )
    );

DROP POLICY IF EXISTS "staff_restaurant_payments_all" ON restaurant_payments;
CREATE POLICY "staff_restaurant_payments_all" ON restaurant_payments
    FOR ALL USING (is_platform_admin() OR is_member_of_tenant(tenant_id))
    WITH CHECK (is_platform_admin() OR is_member_of_tenant(tenant_id));
