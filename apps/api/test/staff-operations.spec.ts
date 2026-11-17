import { StaffService } from '../src/modules/staff/staff.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TenantContextDto } from '@restaurant-saas/contracts';

describe('StaffService - Phase D Order Lifecycle & KDS Operations', () => {
  let staffService: StaffService;
  let mockDb: any;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const LOCATION_A_ID = '22222222-2222-2222-2222-222222222222';
  const LOCATION_B_ID = '33333333-3333-3333-3333-333333333333';
  const USER_ID = '44444444-4444-4444-4444-444444444444';
  const MEMBERSHIP_ID = '55555555-5555-5555-5555-555555555555';

  const defaultStaffContext: TenantContextDto = {
    tenantId: TENANT_ID,
    locationId: LOCATION_A_ID,
    actorType: 'TENANT_USER',
    actorId: USER_ID,
    membershipId: MEMBERSHIP_ID,
    roleCodes: ['WAITER', 'CHEF'],
    permissions: [
      'orders.view',
      'orders.accept',
      'orders.prepare',
      'orders.ready',
      'kitchen.set_eta',
      'orders.update_status',
      'waiter.view',
      'waiter.serve',
      'orders.complete',
    ],
    requestId: 'test-req-123',
  };

  const createMockOrder = (status: string, serviceMode = 'TABLE_SERVICE') => ({
    id: 'ord-1',
    order_number: 'ORD-001',
    tenant_id: TENANT_ID,
    location_id: LOCATION_A_ID,
    table_id: 'tbl-1',
    table_code: 'T-01',
    table_label: 'Table 1',
    table_session_id: 'sess-1',
    status,
    currency: 'INR',
    subtotal_minor: 10000,
    tax_minor: 500,
    total_minor: 10500,
    chef_eta_minutes: status === 'PREPARING' ? 15 : null,
    eta_updated_at: null,
    special_instructions: null,
    rejection_reason: null,
    cancellation_reason: null,
    waiter_id: null,
    waiter_name: null,
    service_mode: serviceMode,
    created_at: new Date(),
    updated_at: new Date(),
    elapsed_seconds: 60,
  });

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => {
        return cb({
          query: jest.fn(),
        });
      }),
    };

    staffService = new StaffService(mockDb as unknown as DatabaseService);
  });

  describe('Location Scoping & Cross-Location Isolation', () => {
    it('rejects access if staff tries to query an unassigned location', async () => {
      // Membership check query returns empty
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        staffService.listStaffOrders(defaultStaffContext, { locationId: LOCATION_B_ID })
      ).rejects.toThrow(ForbiddenException);
    });

    it('resolves primary assigned location when none is explicitly provided in query', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [createMockOrder('PLACED')],
        })
        .mockResolvedValueOnce({ rows: [] }); // Items query

      const result = await staffService.listStaffOrders(defaultStaffContext, {});
      expect(result).toHaveLength(1);
      expect(result[0].orderNumber).toBe('ORD-001');
    });
  });

  describe('Authoritative Order State Machine Transitions', () => {
    it('allows PLACED -> ACCEPTED transition', async () => {
      const mockOrderRow = createMockOrder('PLACED');
      const acceptedOrderRow = { ...mockOrderRow, status: 'ACCEPTED' };

      const txClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [mockOrderRow] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // UPDATE orders
          .mockResolvedValueOnce({ rows: [{ id: 'evt-1', occurred_at: new Date() }] }) // INSERT order_status_events
          .mockResolvedValueOnce({ rows: [] }), // INSERT notification_outbox
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));
      mockDb.query
        .mockResolvedValueOnce({ rows: [acceptedOrderRow] }) // getStaffOrderById order
        .mockResolvedValueOnce({ rows: [] }); // getStaffOrderById items

      const res = await staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
        status: 'ACCEPTED',
      });

      expect(res.order.status).toBe('ACCEPTED');
      expect(res.event.fromStatus).toBe('PLACED');
      expect(res.event.toStatus).toBe('ACCEPTED');
    });

    it('rejects invalid jump: PLACED -> READY', async () => {
      const mockOrderRow = createMockOrder('PLACED');

      const txClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [mockOrderRow] }),
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));

      await expect(
        staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
          status: 'READY',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition from terminal COMPLETED status', async () => {
      const mockOrderRow = createMockOrder('COMPLETED');

      const txClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [mockOrderRow] }),
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));

      await expect(
        staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
          status: 'ACCEPTED',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a reason when transitioning to REJECTED', async () => {
      const mockOrderRow = createMockOrder('PLACED');

      const txClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [mockOrderRow] }),
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));

      await expect(
        staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
          status: 'REJECTED',
          rejectionReason: '', // Empty reason
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Chef ETA Management', () => {
    it('sets valid chef ETA (15 minutes) and updates order', async () => {
      const mockOrderRow = createMockOrder('ACCEPTED');
      const updatedOrderRow = { ...mockOrderRow, chef_eta_minutes: 15 };

      const txClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [mockOrderRow] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // UPDATE orders SET chef_eta_minutes
          .mockResolvedValueOnce({ rows: [] }) // INSERT order_status_events
          .mockResolvedValueOnce({ rows: [] }), // INSERT notification_outbox
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));
      mockDb.query
        .mockResolvedValueOnce({ rows: [updatedOrderRow] }) // getStaffOrderById order
        .mockResolvedValueOnce({ rows: [] }); // getStaffOrderById items

      const updated = await staffService.setChefEta(defaultStaffContext, 'ord-1', {
        chefEtaMinutes: 15,
        notes: 'Preheating oven',
      });

      expect(updated.chefEtaMinutes).toBe(15);
    });

    it('rejects ETA below 1 minute or above 180 minutes', async () => {
      await expect(
        staffService.setChefEta(defaultStaffContext, 'ord-1', { chefEtaMinutes: 0 })
      ).rejects.toThrow(BadRequestException);

      await expect(
        staffService.setChefEta(defaultStaffContext, 'ord-1', { chefEtaMinutes: 200 })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Waiter Pickup and Served Workflow', () => {
    it('records waiter pickup timestamp and assigns waiter_id', async () => {
      const mockOrderRow = createMockOrder('READY');
      const pickedUpOrderRow = { ...mockOrderRow, waiter_id: USER_ID };

      const txClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [mockOrderRow] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // UPDATE orders SET waiter_id, picked_up_at
          .mockResolvedValueOnce({ rows: [] }), // INSERT order_status_events
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));
      mockDb.query
        .mockResolvedValueOnce({ rows: [pickedUpOrderRow] }) // getStaffOrderById order
        .mockResolvedValueOnce({ rows: [] }); // getStaffOrderById items

      const res = await staffService.pickupOrder(defaultStaffContext, 'ord-1');
      expect(res.waiterId).toBe(USER_ID);
    });

    it('marks order SERVED upon table delivery', async () => {
      const mockOrderRow = createMockOrder('READY');
      const servedOrderRow = { ...mockOrderRow, status: 'SERVED' };

      const txClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [mockOrderRow] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // UPDATE orders SET status = 'SERVED'
          .mockResolvedValueOnce({ rows: [{ id: 'evt-1', occurred_at: new Date() }] }) // INSERT order_status_events
          .mockResolvedValueOnce({ rows: [] }), // INSERT notification_outbox
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));
      // First getStaffOrderById in serveOrder
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrderRow] })
        .mockResolvedValueOnce({ rows: [] })
        // Second getStaffOrderById inside updateOrderStatus
        .mockResolvedValueOnce({ rows: [servedOrderRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await staffService.serveOrder(defaultStaffContext, 'ord-1');
      expect(res.order.status).toBe('SERVED');
    });
  });

  describe('Self-Service / Counter Collection Mode', () => {
    it('allows direct READY -> COMPLETED when service_mode is COUNTER_SERVICE', async () => {
      const mockOrderRow = createMockOrder('READY', 'COUNTER_SERVICE');
      const completedOrderRow = { ...mockOrderRow, status: 'COMPLETED' };

      const txClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [mockOrderRow] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }) // UPDATE orders SET status = 'COMPLETED'
          .mockResolvedValueOnce({ rows: [{ id: 'evt-1', occurred_at: new Date() }] }) // INSERT order_status_events
          .mockResolvedValueOnce({ rows: [] }), // INSERT notification_outbox
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));
      mockDb.query
        .mockResolvedValueOnce({ rows: [completedOrderRow] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
        status: 'COMPLETED',
      });

      expect(res.order.status).toBe('COMPLETED');
    });

    it('rejects direct READY -> COMPLETED without SERVED when service_mode is TABLE_SERVICE', async () => {
      const mockOrderRow = createMockOrder('READY', 'TABLE_SERVICE');

      const txClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [mockOrderRow] }),
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));

      await expect(
        staffService.updateOrderStatus(defaultStaffContext, 'ord-1', {
          status: 'COMPLETED',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RBAC Permission Enforcement', () => {
    it('rejects status update if user lacks permission for that action', async () => {
      const mockOrderRow = createMockOrder('PLACED');
      const restrictedContext: TenantContextDto = {
        ...defaultStaffContext,
        roleCodes: ['WAITER'],
        permissions: ['waiter.view', 'waiter.serve'], // Lacks orders.accept
      };

      const txClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [mockOrderRow] }),
      };

      mockDb.transaction.mockImplementation(async (cb: any) => cb(txClient));

      await expect(
        staffService.updateOrderStatus(restrictedContext, 'ord-1', {
          status: 'ACCEPTED',
        })
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
