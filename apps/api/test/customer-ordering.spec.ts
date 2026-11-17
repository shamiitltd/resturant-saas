import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerService } from '../src/modules/customer/customer.service.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('CustomerService (QR Ordering, Price Calculation & Session Invariants)', () => {
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

  describe('resolveQrToken', () => {
    it('throws NotFoundException for non-existent QR token', async () => {
      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(customerService.resolveQrToken('unknown-token')).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws ForbiddenException for revoked or expired QR token', async () => {
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

    it('throws ForbiddenException if restaurant is INACTIVE', async () => {
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

    it('resolves active QR token and attaches or creates table session', async () => {
      mockDbService.query
        // 1. QR resolution query
        .mockResolvedValueOnce({
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
              table_status: 'AVAILABLE',
            },
          ],
          rowCount: 1,
        })
        // 2. Find existing open session (none)
        .mockResolvedValueOnce({
          rows: [],
          rowCount: 0,
        })
        // 3. Insert new open session
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-uuid-1',
              session_token: 'sess_abc123',
            },
          ],
          rowCount: 1,
        });

      const result = await customerService.resolveQrToken('demo-token');

      expect(result.tableSessionId).toBe('session-uuid-1');
      expect(result.sessionToken).toBe('sess_abc123');
      expect(result.tableCode).toBe('T-01');
      expect(result.tenantSlug).toBe('spice-garden');
    });
  });

  describe('createCustomerOrder (Server Recalculation & Tamper Resistance)', () => {
    const mockSession = {
      id: 'session-uuid-1',
      tenant_id: 'tenant-1',
      location_id: 'loc-1',
      table_id: 'table-1',
      table_code: 'T-01',
      table_label: 'Table 1',
      session_status: 'OPEN',
    };

    it('recalculates order totals server-side, ignoring manipulated client pricing', async () => {
      // 1. Session lookup
      mockDbService.query.mockResolvedValueOnce({
        rows: [mockSession],
        rowCount: 1,
      });

      // 2. Idempotency check
      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // 3. Authoritative item fetch
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'item-paneer',
            name: 'Paneer Tikka',
            base_price_minor: 32000, // Rs 320.00
            is_available: true,
            tenant_id: 'tenant-1',
          },
        ],
        rowCount: 1,
      });

      // 4. Modifier fetch
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'mod-extra-cheese',
            name: 'Extra Cheese',
            price_minor: 4000, // Rs 40.00
            is_available: true,
            group_id: 'group-1',
          },
        ],
        rowCount: 1,
      });

      // Transaction queries (mockClient)
      // 6. Insert order header returning id
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'order-uuid-1' }],
        rowCount: 1,
      });
      // 7. Insert order items
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // 8. Insert status event
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // 9. Update table session
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      // 10. Insert notification outbox
      mockClient.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      // getOrderById (mockDbService)
      // 11. Fetch order
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'order-uuid-1',
            order_number: 'ORD-123456',
            table_session_id: 'session-uuid-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            status: 'PLACED',
            currency: 'INR',
            subtotal_minor: 72000, // (32000 + 4000) * 2 = 72000 (Rs 720.00)
            tax_minor: 3600, // 5% of 72000 = 3600 (Rs 36.00)
            discount_minor: 0,
            total_minor: 75600, // 75600 (Rs 756.00)
            chef_eta_minutes: 20,
            special_instructions: 'Less spicy',
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      // 12. Fetch order items
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            item_id: 'item-paneer',
            item_name_snapshot: 'Paneer Tikka',
            unit_price_minor: 36000,
            quantity: 2,
            subtotal_minor: 72000,
            notes: 'Less spicy',
            selected_modifiers: [{ id: 'mod-extra-cheese', name: 'Extra Cheese', priceMinor: 4000 }],
          },
        ],
        rowCount: 1,
      });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-key-1',
        items: [
          {
            itemId: 'item-paneer',
            quantity: 2,
            modifierIds: ['mod-extra-cheese'],
            notes: 'Less spicy',
          },
        ],
      };

      const result = await customerService.createCustomerOrder(orderPayload);

      expect(result.orderId).toBe('order-uuid-1');
      expect(result.subtotalMinor).toBe(72000);
      expect(result.taxMinor).toBe(3600);
      expect(result.totalMinor).toBe(75600);
    });

    it('rejects order with unavailable menu item', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [mockSession],
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // idempotency

      // Item marked unavailable
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'item-paneer',
            name: 'Paneer Tikka',
            base_price_minor: 32000,
            is_available: false, // UNAVAILABLE
            tenant_id: 'tenant-1',
          },
        ],
        rowCount: 1,
      });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-key-2',
        items: [{ itemId: 'item-paneer', quantity: 1 }],
      };

      await expect(customerService.createCustomerOrder(orderPayload)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects order with cross-tenant menu item injection', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [mockSession], // tenant-1
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      // Item belongs to tenant-2
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'item-alien',
            name: 'Foreign Item',
            base_price_minor: 50000,
            is_available: true,
            tenant_id: 'tenant-2-other',
          },
        ],
        rowCount: 1,
      });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-key-3',
        items: [{ itemId: 'item-alien', quantity: 1 }],
      };

      await expect(customerService.createCustomerOrder(orderPayload)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('returns existing order without re-inserting when idempotencyKey matches', async () => {
      mockDbService.query.mockResolvedValueOnce({
        rows: [mockSession],
        rowCount: 1,
      });

      // Existing order returned by idempotency check
      mockDbService.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-order-uuid' }],
        rowCount: 1,
      });

      // getOrderById (mockDbService)
      mockDbService.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'existing-order-uuid',
            order_number: 'ORD-EXISTING',
            table_session_id: 'session-uuid-1',
            table_code: 'T-01',
            table_label: 'Table 1',
            status: 'PLACED',
            currency: 'INR',
            subtotal_minor: 32000,
            tax_minor: 1600,
            discount_minor: 0,
            total_minor: 33600,
            chef_eta_minutes: null,
            special_instructions: null,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      });

      mockDbService.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const orderPayload = {
        sessionToken: 'sess_abc123',
        idempotencyKey: 'idemp-key-repeat',
        items: [{ itemId: 'item-paneer', quantity: 1 }],
      };

      const result = await customerService.createCustomerOrder(orderPayload);

      expect(result.orderId).toBe('existing-order-uuid');
      expect(result.orderNumber).toBe('ORD-EXISTING');
      // mockClient.query should never be called since transaction was bypassed
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('Table Session Order Consolidation (ADR-003)', () => {
    it('returns all independent orders in a table session with consolidated total', async () => {
      mockDbService.query
        // 1. Session query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-1',
              status: 'OPEN',
              table_code: 'T-01',
              table_label: 'Table 1',
            },
          ],
          rowCount: 1,
        })
        // 2. Orders query (2 orders in this table session)
        .mockResolvedValueOnce({
          rows: [
            { id: 'order-1' },
            { id: 'order-2' },
          ],
          rowCount: 2,
        })
        // 3. getOrderById for order-1 (header)
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
              discount_minor: 0,
              total_minor: 33600,
              chef_eta_minutes: 15,
              special_instructions: null,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // 4. getOrderById for order-1 (items)
        .mockResolvedValueOnce({
          rows: [
            {
              item_id: 'item-paneer',
              item_name_snapshot: 'Paneer Tikka',
              unit_price_minor: 32000,
              quantity: 1,
              subtotal_minor: 32000,
              notes: null,
              selected_modifiers: [],
            },
          ],
          rowCount: 1,
        })
        // 5. getOrderById for order-2 (header)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'order-2',
              order_number: 'ORD-002',
              table_session_id: 'session-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              status: 'PLACED',
              currency: 'INR',
              subtotal_minor: 40000,
              tax_minor: 2000,
              discount_minor: 0,
              total_minor: 42000,
              chef_eta_minutes: 25,
              special_instructions: null,
              created_at: new Date(),
            },
          ],
          rowCount: 1,
        })
        // 6. getOrderById for order-2 (items)
        .mockResolvedValueOnce({
          rows: [
            {
              item_id: 'item-biryani',
              item_name_snapshot: 'Dum Biryani',
              unit_price_minor: 40000,
              quantity: 1,
              subtotal_minor: 40000,
              notes: null,
              selected_modifiers: [],
            },
          ],
          rowCount: 1,
        });

      const sessionOrders = await customerService.getTableSessionOrders('sess_abc123');

      expect(sessionOrders.orders).toHaveLength(2);
      expect(sessionOrders.orders[0].orderId).toBe('order-1');
      expect(sessionOrders.orders[1].orderId).toBe('order-2');
      expect(sessionOrders.consolidatedSubtotalMinor).toBe(72000); // 32000 + 40000
      expect(sessionOrders.consolidatedTaxMinor).toBe(3600); // 1600 + 2000
      expect(sessionOrders.consolidatedTotalMinor).toBe(75600); // 33600 + 42000
    });
  });
});
