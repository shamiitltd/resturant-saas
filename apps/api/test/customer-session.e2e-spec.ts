import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('Customer Session & Ordering Flow E2E (ADR-003, QR & Price Invariants)', () => {
  let app: INestApplication;

  const mockDbService = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue(mockDbService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/public/table/resolve-qr', () => {
    it('returns table and session token on valid QR scan', async () => {
      mockDbService.query
        // 1. QR lookup
        .mockResolvedValueOnce({
          rows: [
            {
              qr_id: 'qr-uuid-1',
              qr_status: 'ACTIVE',
              expires_at: null,
              tenant_id: 'tenant-spice-garden',
              tenant_slug: 'spice-garden',
              tenant_name: 'Spice Garden',
              tenant_status: 'ACTIVE',
              location_id: 'loc-downtown',
              location_name: 'Downtown Flagship',
              location_status: 'ACTIVE',
              table_id: 'table-uuid-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              table_status: 'AVAILABLE',
            },
          ],
          rowCount: 1,
        })
        // 2. Active session lookup (none)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // 3. Create table session
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sess-uuid-1',
              session_token: 'sess_live_12345',
            },
          ],
          rowCount: 1,
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/public/table/resolve-qr')
        .send({ qrToken: 'demo-spice-table-1' })
        .expect(200);

      expect(response.body).toEqual({
        tenantId: 'tenant-spice-garden',
        tenantSlug: 'spice-garden',
        tenantName: 'Spice Garden',
        locationId: 'loc-downtown',
        locationName: 'Downtown Flagship',
        tableId: 'table-uuid-1',
        tableCode: 'T-01',
        tableLabel: 'Table 1',
        tableSessionId: 'sess-uuid-1',
        sessionToken: 'sess_live_12345',
        currency: 'INR',
      });
    });

    it('rejects expired or revoked QR token with 403', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-revoked',
            qr_status: 'REVOKED',
            expires_at: null,
            tenant_id: 'tenant-1',
            tenant_slug: 'spice-garden',
            tenant_name: 'Spice Garden',
            tenant_status: 'ACTIVE',
            location_id: 'loc-1',
            location_name: 'Downtown',
            location_status: 'ACTIVE',
            table_id: 'table-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            table_status: 'AVAILABLE',
          },
        ],
        rowCount: 1,
      });

      await request(app.getHttpServer())
        .post('/api/v1/public/table/resolve-qr')
        .send({ qrToken: 'revoked-token' })
        .expect(403);
    });
  });

  describe('GET /api/v1/public/menu/:tenantSlug', () => {
    it('returns published categories and items with verified price minor units', async () => {
      mockDbService.query
        // 1. Tenant lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'tenant-spice-garden', name: 'Spice Garden', slug: 'spice-garden', tax_rate_percent: '5.00' }],
          rowCount: 1,
        })
        // 2. Categories lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'cat-starters', name: 'Starters', slug: 'starters', description: 'Fresh appetizers' }],
          rowCount: 1,
        })
        // 3. Items lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-paneer',
              category_id: 'cat-starters',
              name: 'Paneer Tikka',
              description: 'Clay-oven charred cottage cheese',
              base_price_minor: 32000,
              currency: 'INR',
              image_url: null,
              is_available: true,
              is_vegetarian: true,
              preparation_time_minutes: 15,
            },
          ],
          rowCount: 1,
        })
        // 4. Modifiers lookup
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        });

      const res = await request(app.getHttpServer())
        .get('/api/v1/public/menu/spice-garden')
        .expect(200);

      expect(res.body.tenantSlug).toBe('spice-garden');
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].items[0].name).toBe('Paneer Tikka');
      expect(res.body.categories[0].items[0].basePriceMinor).toBe(32000);
      expect(res.body.categories[0].items[0].isVegetarian).toBe(true);
      expect(res.body.taxRatePercent).toBe(5);
    });
  });

  describe('Task 1: SEC-AUTH-01 — GET /api/v1/customer/orders/:orderId (Authorization)', () => {
    it('rejects order retrieval with 401 Unauthorized when session credential header is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/customer/orders/order-uuid-123')
        .expect(401);
    });

    it('rejects order retrieval with 403 Forbidden when session token is invalid', async () => {
      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // session not found

      await request(app.getHttpServer())
        .get('/api/v1/customer/orders/order-uuid-123')
        .set('x-session-token', 'invalid-token')
        .expect(403);
    });

    it('returns order details when valid matching session token is provided', async () => {
      mockDbService.query
        // 1. Session check
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sess-uuid-1',
              tenant_id: 'tenant-1',
              session_status: 'OPEN',
              tenant_status: 'ACTIVE',
            },
          ],
          rowCount: 1,
        })
        // 2. Order check: WHERE o.id = $1 AND o.table_session_id = $2
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-uuid-123',
              order_number: 'ORD-123456',
              table_session_id: 'sess-uuid-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              status: 'PLACED',
              currency: 'INR',
              subtotal_minor: 32000,
              tax_minor: 1600,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 33600,
              chef_eta_minutes: null,
              special_instructions: null,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // 3. Order items
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/customer/orders/order-uuid-123')
        .set('x-session-token', 'sess_live_12345')
        .expect(200);

      expect(res.body.orderId).toBe('order-uuid-123');
      expect(res.body.tableSessionId).toBe('sess-uuid-1');
      expect(res.body.status).toBe('PLACED');
    });
  });

  describe('GET /api/v1/customer/sessions/:sessionToken/orders (ADR-003 Consolidated Session)', () => {
    it('returns consolidated totals aggregating multiple independent orders for the session', async () => {
      mockDbService.query
        // 1. Session lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sess-uuid-1',
              status: 'OPEN',
              table_code: 'T-01',
              table_label: 'Table 1',
              tax_rate_percent: '5.00',
            },
          ],
          rowCount: 1,
        })
        // 2. Orders query (order-1 and order-2)
        .mockResolvedValueOnce({
          rows: [{ id: 'order-1' }, { id: 'order-2' }],
          rowCount: 2,
        })
        // Order 1 header
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-1',
              order_number: 'ORD-001',
              table_session_id: 'sess-uuid-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              status: 'SERVED',
              currency: 'INR',
              subtotal_minor: 32000,
              tax_minor: 1600,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 33600,
              chef_eta_minutes: null,
              special_instructions: null,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // Order 1 items
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Order 2 header
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-2',
              order_number: 'ORD-002',
              table_session_id: 'sess-uuid-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              status: 'PREPARING',
              currency: 'INR',
              subtotal_minor: 25000,
              tax_minor: 1250,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 26250,
              chef_eta_minutes: 10,
              special_instructions: null,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // Order 2 items
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/customer/sessions/sess_live_12345/orders')
        .expect(200);

      expect(res.body.tableSessionId).toBe('sess-uuid-1');
      expect(res.body.orders).toHaveLength(2);
      expect(res.body.consolidatedSubtotalMinor).toBe(57000); // 32000 + 25000
      expect(res.body.consolidatedTaxMinor).toBe(2850); // 1600 + 1250
      expect(res.body.consolidatedTotalMinor).toBe(59850); // 33600 + 26250
    });
  });
});
