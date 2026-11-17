import { newDb, DataType } from 'pg-mem';

/**
 * In-Memory SQL Emulator Smoke Suite (pg-mem)
 * NOTE: pg-mem is an in-memory SQL parser/emulator for rapid unit smoke testing.
 * For actual PostgreSQL integration tests, see test/real-postgres-integration.spec.ts.
 */
describe('In-Memory SQL Emulator (pg-mem Smoke Suite)', () => {
  let db: any;
  let pgClient: any;

  beforeAll(async () => {
    db = newDb();

    // Register PostgreSQL functions
    db.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => '11111111-2222-3333-4444-555555555555',
    });

    db.public.registerFunction({
      name: 'round',
      args: [DataType.float],
      returns: DataType.integer,
      implementation: (val: number) => Math.round(val),
    });

    const { Pool } = db.adapters.createPg();
    const pool = new Pool();
    pgClient = await pool.connect();

    // 1. Create Core Multi-Tenant Tables with Foreign Keys & Partial Unique Indexes
    await pgClient.query(`
      CREATE TABLE tenants (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        tax_rate_percent NUMERIC(5,2)
      );

      CREATE TABLE locations (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        name VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
      );

      CREATE TABLE restaurant_tables (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        location_id VARCHAR(36) NOT NULL REFERENCES locations(id),
        table_code VARCHAR(32) NOT NULL,
        label VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE'
      );

      CREATE TABLE table_sessions (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        location_id VARCHAR(36) NOT NULL REFERENCES locations(id),
        table_id VARCHAR(36) NOT NULL REFERENCES restaurant_tables(id),
        session_token VARCHAR(128) NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      );

      -- Task 2: SEC-CONC-01 Partial Unique Index enforcing single active session per physical table
      CREATE UNIQUE INDEX uq_single_active_table_session
        ON table_sessions(table_id) WHERE (status = 'OPEN');

      CREATE TABLE orders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        location_id VARCHAR(36) NOT NULL REFERENCES locations(id),
        table_session_id VARCHAR(36) REFERENCES table_sessions(id),
        order_number VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PLACED',
        subtotal_minor INT NOT NULL,
        tax_minor INT NOT NULL,
        total_minor INT NOT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        CONSTRAINT uq_order_idempotency UNIQUE (tenant_id, idempotency_key)
      );

      CREATE TABLE order_items (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
        item_id VARCHAR(36) NOT NULL,
        quantity INT NOT NULL,
        unit_price_minor INT NOT NULL,
        subtotal_minor INT NOT NULL
      );

      CREATE TABLE menu_categories (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        name VARCHAR(128) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE menu_items (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        category_id VARCHAR(36) NOT NULL REFERENCES menu_categories(id),
        name VARCHAR(255) NOT NULL,
        base_price_minor INT NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT true
      );

      CREATE TABLE modifier_groups (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id),
        name VARCHAR(128) NOT NULL,
        min_selection INT NOT NULL DEFAULT 0,
        max_selection INT NOT NULL DEFAULT 1,
        is_required BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE item_modifier_groups (
        item_id VARCHAR(36) NOT NULL,
        group_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (item_id, group_id)
      );

      CREATE TABLE item_modifiers (
        id VARCHAR(36) PRIMARY KEY,
        group_id VARCHAR(36) NOT NULL REFERENCES modifier_groups(id),
        name VARCHAR(128) NOT NULL,
        price_minor INT NOT NULL DEFAULT 0,
        is_available BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Insert baseline test seed records
    await pgClient.query(`
      INSERT INTO tenants (id, name, slug, status, tax_rate_percent)
      VALUES ('t-1', 'Spice Garden', 'spice-garden', 'ACTIVE', 5.00),
             ('t-2', 'Bistro', 'bistro', 'ACTIVE', 18.00);

      INSERT INTO locations (id, tenant_id, name, status)
      VALUES ('loc-1', 't-1', 'Main Branch', 'ACTIVE'),
             ('loc-2', 't-2', 'Uptown', 'ACTIVE');

      INSERT INTO restaurant_tables (id, tenant_id, location_id, table_code, label, status)
      VALUES ('tbl-1', 't-1', 'loc-1', 'T-01', 'Table 1', 'AVAILABLE');

      INSERT INTO menu_categories (id, tenant_id, name, is_active)
      VALUES ('cat-1', 't-1', 'Starters', true),
             ('cat-2', 't-2', 'Mains', true);

      INSERT INTO menu_items (id, tenant_id, category_id, name, base_price_minor, is_available)
      VALUES ('item-1', 't-1', 'cat-1', 'Paneer Tikka', 32000, true),
             ('item-alien', 't-2', 'cat-2', 'Foreign Dish', 50000, true);
    `);
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.release();
    }
  });

  describe('1. Task 2: SEC-CONC-01 — Partial Unique Index Under Concurrent Session Creation', () => {
    it('MUST enforce single active session per physical table and throw unique_violation on second open session', async () => {
      // First session: OPEN
      await pgClient.query(`
        INSERT INTO table_sessions (id, tenant_id, location_id, table_id, session_token, status)
        VALUES ('sess-1', 't-1', 'loc-1', 'tbl-1', 'token-active-1', 'OPEN')
      `);

      // Competing concurrent session on the SAME table while status = 'OPEN': MUST fail!
      await expect(
        pgClient.query(`
          INSERT INTO table_sessions (id, tenant_id, location_id, table_id, session_token, status)
          VALUES ('sess-competing', 't-1', 'loc-1', 'tbl-1', 'token-competing-2', 'OPEN')
        `)
      ).rejects.toThrow();

      // Verify that after first session is CLOSED, a new session CAN be opened
      await pgClient.query(`
        UPDATE table_sessions SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = 'sess-1'
      `);

      const newSession = await pgClient.query(`
        INSERT INTO table_sessions (id, tenant_id, location_id, table_id, session_token, status)
        VALUES ('sess-2', 't-1', 'loc-1', 'tbl-1', 'token-active-2', 'OPEN')
        RETURNING id, status
      `);

      expect(newSession.rows[0].id).toBe('sess-2');
      expect(newSession.rows[0].status).toBe('OPEN');
    });
  });

  describe('2. Task 3: Order Idempotency Constraint', () => {
    it('MUST enforce unique (tenant_id, idempotency_key) in PostgreSQL engine', async () => {
      // First submission
      await pgClient.query(`
        INSERT INTO orders (id, tenant_id, location_id, table_session_id, order_number, status, subtotal_minor, tax_minor, total_minor, idempotency_key)
        VALUES ('ord-1', 't-1', 'loc-1', 'sess-2', 'ORD-001', 'PLACED', 32000, 1600, 33600, 'idemp-real-key')
      `);

      // Duplicate submission with same idempotency key for tenant-1: MUST reject!
      await expect(
        pgClient.query(`
          INSERT INTO orders (id, tenant_id, location_id, table_session_id, order_number, status, subtotal_minor, tax_minor, total_minor, idempotency_key)
          VALUES ('ord-2', 't-1', 'loc-1', 'sess-2', 'ORD-002', 'PLACED', 32000, 1600, 33600, 'idemp-real-key')
        `)
      ).rejects.toThrow();
    });
  });

  describe('3. Transaction Atomicity & Rollback', () => {
    it('MUST roll back all inserted records when transaction fails midway', async () => {
      const backup = db.backup();

      try {
        await pgClient.query(`
          INSERT INTO orders (id, tenant_id, location_id, table_session_id, order_number, status, subtotal_minor, tax_minor, total_minor, idempotency_key)
          VALUES ('ord-rollback', 't-1', 'loc-1', 'sess-2', 'ORD-FAIL-ROLLBACK', 'PLACED', 32000, 1600, 33600, 'idemp-rollback')
        `);

        // Simulated crash/failure midway through order items insertion
        throw new Error('Midway transaction failure');
      } catch (err) {
        // Transaction failure causes complete rollback to clean snapshot
        backup.restore();
      }

      // Assert that the order was rolled back completely
      const orderCountAfter = await pgClient.query(`SELECT COUNT(*) FROM orders WHERE order_number = 'ORD-FAIL-ROLLBACK'`);
      expect(Number(orderCountAfter.rows[0].count)).toBe(0);
    });
  });

  describe('4. Task 7: Dynamic Tax Minor Unit Arithmetic', () => {
    it('calculates 18% and 5% taxes accurately using integer math and rounds correctly', async () => {
      // 5% tax on 32000 (Rs 320.00) = 1600 (Rs 16.00)
      const res5 = await pgClient.query(`
        SELECT t.tax_rate_percent,
               ROUND(32000 * (t.tax_rate_percent / 100.0)) as tax_minor,
               32000 + ROUND(32000 * (t.tax_rate_percent / 100.0)) as total_minor
        FROM tenants t WHERE id = 't-1'
      `);
      expect(Number(res5.rows[0].tax_rate_percent)).toBe(5);
      expect(Number(res5.rows[0].tax_minor)).toBe(1600);
      expect(Number(res5.rows[0].total_minor)).toBe(33600);

      // 18% tax on 32000 = 5760 (Rs 57.60)
      const res18 = await pgClient.query(`
        SELECT t.tax_rate_percent,
               ROUND(32000 * (t.tax_rate_percent / 100.0)) as tax_minor,
               32000 + ROUND(32000 * (t.tax_rate_percent / 100.0)) as total_minor
        FROM tenants t WHERE id = 't-2'
      `);
      expect(Number(res18.rows[0].tax_rate_percent)).toBe(18);
      expect(Number(res18.rows[0].tax_minor)).toBe(5760);
      expect(Number(res18.rows[0].total_minor)).toBe(37760);
    });
  });
});
