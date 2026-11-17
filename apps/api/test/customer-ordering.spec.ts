import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CustomerService } from '../src/modules/customer/customer.service.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('CustomerService (Phase C.1 Security & Reliability Remediations)', () => {
  let customerService: CustomerService;
  let mockDbService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };

    mockDbService = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => cb(mockClient)),
    };

    customerService = new CustomerService(mockDbService as unknown as DatabaseService);
  });

  describe('Task 6: SEC-QR-02 — Table, Location & Tenant State Validation in resolveQrToken', () => {
    it('throws NotFoundException for non-existent QR token', async () => {
      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(customerService.resolveQrToken('unknown-token')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws ForbiddenException for revoked QR token', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
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

      await expect(customerService.resolveQrToken('revoked-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException for expired QR token', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
            qr_status: 'ACTIVE',
            expires_at: new Date(Date.now() - 3600000), // 1 hour ago
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

      await expect(customerService.resolveQrToken('expired-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if tenant is INACTIVE/SUSPENDED', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
            qr_status: 'ACTIVE',
            expires_at: null,
            tenant_id: 'tenant-1',
            tenant_slug: 'spice-garden',
            tenant_name: 'Spice Garden',
            tenant_status: 'SUSPENDED',
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

      await expect(customerService.resolveQrToken('valid-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if location is INACTIVE', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
            qr_status: 'ACTIVE',
            expires_at: null,
            tenant_id: 'tenant-1',
            tenant_slug: 'spice-garden',
            tenant_name: 'Spice Garden',
            tenant_status: 'ACTIVE',
            location_id: 'loc-1',
            location_name: 'Downtown',
            location_status: 'INACTIVE',
            table_id: 'table-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            table_status: 'AVAILABLE',
          },
        ],
        rowCount: 1,
      });

      await expect(customerService.resolveQrToken('valid-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if table is OUT_OF_SERVICE', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
            qr_status: 'ACTIVE',
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
            table_status: 'OUT_OF_SERVICE',
          },
        ],
        rowCount: 1,
      });

      await expect(customerService.resolveQrToken('valid-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if table is INACTIVE', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            qr_id: 'qr-1',
            qr_status: 'ACTIVE',
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
            table_status: 'INACTIVE',
          },
        ],
        rowCount: 1,
      });

      await expect(customerService.resolveQrToken('valid-token')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('Task 2: SEC-CONC-01 — Concurrency-Safe Session Creation in resolveQrToken', () => {
    it('recovers and returns the winning active session if competing transaction creates session first', async () => {
      const activeQrRow = {
        qr_id: 'qr-1',
        qr_status: 'ACTIVE',
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
      };

      mockDbService.query
        // 1. QR lookup
        .mockResolvedValueOnce({ rows: [activeQrRow], rowCount: 1 })
        // 2. getActiveTableSession -> null (race condition begins)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // 3. createTableSession INSERT -> fails with unique violation code 23505
        .mockRejectedValueOnce({
          code: '23505',
          message: 'duplicate key value violates unique constraint "uq_single_active_table_session"',
        })
        // 4. Recovery: getActiveTableSession returns the winning session
        .mockResolvedValueOnce({
          rows: [{ id: 'winning-session-uuid', session_token: 'sess_winning123' }],
          rowCount: 1,
        });

      const result = await customerService.resolveQrToken('demo-token');

      expect(result.tableSessionId).toBe('winning-session-uuid');
      expect(result.sessionToken).toBe('sess_winning123');
    });
  });

  describe('Task 5: SEC-VAL-01 — Server-Side Modifier Cardinality & Requirements', () => {
    const mockSession = {
      id: 'session-uuid-1',
      tenant_id: 'tenant-1',
      location_id: 'loc-1',
      table_id: 'table-1',
      table_code: 'T-01',
      table_label: 'Table 1',
      session_status: 'OPEN',
      tax_rate_percent: '18.00', // 18% GST test
    };

    it('rejects order with duplicate modifier IDs in same item with BadRequestException', async () => {
      mockDbService.query
        .mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-biryani',
              name: 'Dum Biryani',
              base_price_minor: 38000,
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-dup-mod',
        items: [
          {
            itemId: 'item-biryani',
            quantity: 1,
            modifierIds: ['mod-raita', 'mod-raita'], // Duplicate!
          },
        ],
      };

      await expect(customerService.createCustomerOrder(orderPayload)).rejects.toThrow(
        BadRequestException
      );
    });

    it('enforces required modifier groups (is_required = true, min_selection = 1)', async () => {
      mockDbService.query
        .mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-biryani',
              name: 'Dum Biryani',
              base_price_minor: 38000,
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        })
        // itemGroupsRes: Portion Size is required!
        .mockResolvedValueOnce({
          rows: [
            {
              group_id: 'group-portion',
              group_name: 'Portion Size',
              min_selection: 1,
              max_selection: 1,
              is_required: true,
            },
          ],
          rowCount: 1,
        })
        // groupModsRes: 0 modifiers selected for this group
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-missing-required',
        items: [
          {
            itemId: 'item-biryani',
            quantity: 1,
            modifierIds: [], // User passed no modifiers!
          },
        ],
      };

      await expect(customerService.createCustomerOrder(orderPayload)).rejects.toThrow(
        BadRequestException
      );
    });

    it('enforces max_selection limit on modifier groups', async () => {
      mockDbService.query
        .mockResolvedValueOnce({ rows: [mockSession], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // idempotency
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-icecream',
              name: 'Sundae',
              base_price_minor: 20000,
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        })
        // groupAllows max 2 toppings
        .mockResolvedValueOnce({
          rows: [
            {
              group_id: 'group-toppings',
              group_name: 'Toppings',
              min_selection: 0,
              max_selection: 2,
              is_required: false,
            },
          ],
          rowCount: 1,
        })
        // Customer selected 3 toppings
        .mockResolvedValueOnce({
          rows: [
            { id: 'mod-t1', name: 'Nuts', price_minor: 2000, is_available: true },
            { id: 'mod-t2', name: 'Cherry', price_minor: 1500, is_available: true },
            { id: 'mod-t3', name: 'Choco Chips', price_minor: 2500, is_available: true },
          ],
          rowCount: 3,
        });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-max-exceeded',
        items: [
          {
            itemId: 'item-icecream',
            quantity: 1,
            modifierIds: ['mod-t1', 'mod-t2', 'mod-t3'],
          },
        ],
      };

      await expect(customerService.createCustomerOrder(orderPayload)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Task 7: BUS-TAX-01 — Dynamic Tax Calculation from Database Configuration', () => {
    it('applies configured 18% tax from tenant record accurately in integer minor units', async () => {
      const mockSession18 = {
        id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        location_id: 'loc-1',
        table_id: 'table-1',
        table_code: 'T-01',
        table_label: 'Table 1',
        session_status: 'OPEN',
        tax_rate_percent: '18.00', // 18% GST
      };

      mockDbService.query
        // 1. Session lookup
        .mockResolvedValueOnce({ rows: [mockSession18], rowCount: 1 })
        // 2. Idempotency lookup
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // 3. Item lookup
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-paneer',
              name: 'Paneer Tikka',
              base_price_minor: 30000, // Rs 300.00
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        })
        // 4. Modifier groups (none)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Transaction queries (mockClient)
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'order-18' }], rowCount: 1 }); // insert order
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // insert item
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // status event
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 }); // notification outbox

      // getOrderByIdInternal
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'order-18',
            order_number: 'ORD-18001',
            table_session_id: 'session-uuid-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            status: 'PLACED',
            currency: 'INR',
            subtotal_minor: 30000, // Rs 300.00
            tax_minor: 5400, // 18% of 30000 = 5400 (Rs 54.00)
            tax_rate_percent: '18.00',
            discount_minor: 0,
            total_minor: 35400, // Rs 354.00
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            item_id: 'item-paneer',
            item_name_snapshot: 'Paneer Tikka',
            unit_price_minor: 30000,
            quantity: 1,
            subtotal_minor: 30000,
            notes: null,
            selected_modifiers: [],
          },
        ],
        rowCount: 1,
      });

      const result = await customerService.createCustomerOrder({
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-tax-18',
        items: [{ itemId: 'item-paneer', quantity: 1, modifierIds: [] }],
      });

      expect(result.subtotalMinor).toBe(30000);
      expect(result.taxMinor).toBe(5400);
      expect(result.taxRatePercent).toBe(18);
      expect(result.totalMinor).toBe(35400);
    });

    it('handles 0% tax rate accurately', async () => {
      const mockSession0 = {
        id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        location_id: 'loc-1',
        table_id: 'table-1',
        table_code: 'T-01',
        table_label: 'Table 1',
        session_status: 'OPEN',
        tax_rate_percent: '0.00', // 0% tax
      };

      mockDbService.query
        .mockResolvedValueOnce({ rows: [mockSession0], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-paneer',
              name: 'Paneer Tikka',
              base_price_minor: 30000,
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'order-0' }], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'order-0',
            order_number: 'ORD-0001',
            table_session_id: 'session-uuid-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            status: 'PLACED',
            currency: 'INR',
            subtotal_minor: 30000,
            tax_minor: 0,
            tax_rate_percent: '0.00',
            discount_minor: 0,
            total_minor: 30000,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await customerService.createCustomerOrder({
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-tax-0',
        items: [{ itemId: 'item-paneer', quantity: 1 }],
      });

      expect(result.subtotalMinor).toBe(30000);
      expect(result.taxMinor).toBe(0);
      expect(result.totalMinor).toBe(30000);
    });

    it('handles unconfigured tax (NULL) safely without silent calculation', async () => {
      const mockSessionNullTax = {
        id: 'session-uuid-1',
        tenant_id: 'tenant-1',
        location_id: 'loc-1',
        table_id: 'table-1',
        table_code: 'T-01',
        table_label: 'Table 1',
        session_status: 'OPEN',
        tax_rate_percent: null, // Unconfigured!
      };

      mockDbService.query
        .mockResolvedValueOnce({ rows: [mockSessionNullTax], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'item-paneer',
              name: 'Paneer Tikka',
              base_price_minor: 30000,
              is_available: true,
              tenant_id: 'tenant-1',
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'order-null-tax' }], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'order-null-tax',
            order_number: 'ORD-NULL01',
            table_session_id: 'session-uuid-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            status: 'PLACED',
            currency: 'INR',
            subtotal_minor: 30000,
            tax_minor: 0,
            tax_rate_percent: null,
            discount_minor: 0,
            total_minor: 30000,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            item_id: 'item-paneer',
            item_name_snapshot: 'Paneer Tikka',
            unit_price_minor: 30000,
            quantity: 1,
            subtotal_minor: 30000,
            notes: null,
            selected_modifiers: [],
          },
        ],
        rowCount: 1,
      });

      const result = await customerService.createCustomerOrder({
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-tax-null',
        items: [{ itemId: 'item-paneer', quantity: 1 }],
      });

      expect(result.subtotalMinor).toBe(30000);
      expect(result.taxMinor).toBe(0);
      expect(result.taxRatePercent).toBeNull();
      expect(result.totalMinor).toBe(30000);
    });
  });

  describe('Task 1: SEC-AUTH-01 — Customer Order Authorization in getOrderForSession', () => {
    it('throws UnauthorizedException if sessionToken is missing or blank', async () => {
      await expect(customerService.getOrderForSession('order-uuid-1', '')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws ForbiddenException if sessionToken is invalid or non-existent', async () => {
      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(customerService.getOrderForSession('order-uuid-1', 'invalid-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if table session is CLOSED', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-1',
            tenant_id: 'tenant-1',
            session_status: 'CLOSED',
            tenant_status: 'ACTIVE',
          },
        ],
        rowCount: 1,
      });

      await expect(customerService.getOrderForSession('order-uuid-1', 'closed-session-token')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws ForbiddenException if restaurant tenant is INACTIVE', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-1',
            tenant_id: 'tenant-1',
            session_status: 'OPEN',
            tenant_status: 'SUSPENDED',
          },
        ],
        rowCount: 1,
      });

      await expect(customerService.getOrderForSession('order-uuid-1', 'token-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('throws NotFoundException if order belongs to another table/session (Negative Test against guessed UUIDs)', async () => {
      mockDbService.query
        // 1. Session lookup: caller is in session-1
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-1',
              tenant_id: 'tenant-1',
              session_status: 'OPEN',
              tenant_status: 'ACTIVE',
            },
          ],
          rowCount: 1,
        })
        // 2. Order lookup: order belongs to session-2 (different table!)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(customerService.getOrderForSession('guessed-order-uuid', 'token-session-1')).rejects.toThrow(
        NotFoundException
      );
    });

    it('returns full order details when caller owns the session matching the order', async () => {
      mockDbService.query
        // 1. Session verification
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-1',
              tenant_id: 'tenant-1',
              session_status: 'OPEN',
              tenant_status: 'ACTIVE',
            },
          ],
          rowCount: 1,
        })
        // 2. Order verification: WHERE o.id = $1 AND o.table_session_id = $2
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-1',
              order_number: 'ORD-001',
              table_session_id: 'session-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              status: 'PREPARING',
              currency: 'INR',
              subtotal_minor: 32000,
              tax_minor: 1600,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 33600,
              chef_eta_minutes: 15,
              special_instructions: 'No spicy',
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // 3. Order items
        .mockResolvedValueOnce({
          rows: [
            {
              item_id: 'item-1',
              item_name_snapshot: 'Paneer Tikka',
              unit_price_minor: 32000,
              quantity: 1,
              subtotal_minor: 32000,
              notes: 'No spicy',
              selected_modifiers: [],
            },
          ],
          rowCount: 1,
        });

      const order = await customerService.getOrderForSession('order-1', 'valid-sess-token');

      expect(order.orderId).toBe('order-1');
      expect(order.tableSessionId).toBe('session-1');
      expect(order.status).toBe('PREPARING');
      expect(order.items).toHaveLength(1);
    });
  });
});
