import { BillingService } from '../src/modules/billing/billing.service.js';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { TenantContextDto } from '@restaurant-saas/contracts';

describe('BillingService - Phase E Consolidated Billing & Payment Verification', () => {
  let service: BillingService;
  let mockDb: any;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '99999999-9999-9999-9999-999999999999';
  const LOC_A = '22222222-2222-2222-2222-222222222222';
  const LOC_B = '33333333-3333-3333-3333-333333333333';
  const USER_REC = '44444444-4444-4444-4444-444444444444';
  const USER_CHEF = '55555555-5555-5555-5555-555555555555';
  const USER_OWNER = '66666666-6666-6666-6666-666666666666';

  const receptionCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: USER_REC,
    membershipId: 'mem-rec',
    roleCodes: ['RECEPTIONIST'],
    permissions: ['billing.view', 'billing.create', 'billing.verify_payment'],
    requestId: 'req-1',
  };

  const chefCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: USER_CHEF,
    membershipId: 'mem-chef',
    roleCodes: ['CHEF'],
    permissions: ['kitchen.view', 'kitchen.set_eta', 'kitchen.mark_ready'],
    requestId: 'req-2',
  };

  const ownerCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: USER_OWNER,
    membershipId: 'mem-owner',
    roleCodes: ['OWNER'],
    permissions: ['billing.view', 'billing.create', 'billing.verify_payment', 'billing.void'],
    requestId: 'req-3',
  };

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => {
        const client = { query: jest.fn() };
        return cb(client);
      }),
    };
    service = new BillingService(mockDb);
  });

  describe('RBAC & Authorization Guards', () => {
    it('denies CHEF access to billing queue, bill generation, and payment verification', async () => {
      await expect(service.getStaffBillingQueue(chefCtx)).rejects.toThrow(ForbiddenException);
      await expect(service.generateConsolidatedBill(chefCtx, 'sess-1', {})).rejects.toThrow(
        ForbiddenException
      );
      await expect(
        service.verifyPayment(chefCtx, 'pay-1', { approved: true })
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies RECEPTIONIST from voiding bills or modifying owner payment settings', async () => {
      await expect(
        service.voidBill(receptionCtx, 'bill-1', { voidReason: 'Wrong items' })
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.upsertBranchPaymentSettings(receptionCtx, {
          upiId: 'test@okaxis',
          isActive: true,
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects cross-location access when staff is unassigned to requested location (T-02)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await expect(service.getStaffBillingQueue(receptionCtx, LOC_B)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects cross-tenant bill lookup (T-01)', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Bill query scoped to tenant_id returns empty
      await expect(
        service.getBillById({ ...ownerCtx, tenantId: TENANT_B }, 'bill-tenant-a')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Branch Payment Settings Validation (FR-PAY-02)', () => {
    it('rejects invalid UPI ID format', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] });
      await expect(
        service.upsertBranchPaymentSettings(ownerCtx, {
          upiId: 'not-a-upi-id',
          isActive: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects activating UPI payments without UPI ID or QR asset', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] });
      await expect(
        service.upsertBranchPaymentSettings(ownerCtx, {
          upiId: '',
          qrAssetUrl: '',
          isActive: true,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects out-of-range taxRatePercent', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] });
      await expect(
        service.upsertBranchPaymentSettings(ownerCtx, {
          upiId: 'bistro@okicici',
          isActive: true,
          taxRatePercent: 150,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Customer Unverified UPI Reference (FR-PAY-05, T-06)', () => {
    it('requires a valid table session token', async () => {
      await expect(service.getCustomerSessionBill('')).rejects.toThrow(UnauthorizedException);
      await expect(
        service.submitCustomerPaymentReference('', {
          sessionToken: '',
          method: 'RESTAURANT_UPI_QR',
          customerReference: '423116789045',
          idempotencyKey: 'k1',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('records customer UPI reference strictly as PAYMENT_REPORTED (never VERIFIED_PAID) and keeps verified_by NULL (T-06)', async () => {
      const executedQueries: Array<{ sql: string; params: any[] }> = [];

      mockDb.transaction = jest.fn(async (cb) => {
        const client = {
          query: jest.fn(async (sql: string, params: any[] = []) => {
            executedQueries.push({ sql, params });
            if (sql.includes('FROM table_sessions ts')) {
              return {
                rows: [
                  {
                    id: 'sess-1',
                    tenant_id: TENANT_A,
                    location_id: LOC_A,
                    table_id: 'tbl-1',
                    status: 'OPEN',
                    tax_rate_percent: '5.00',
                  },
                ],
              };
            }
            if (sql.includes('FROM restaurant_payments WHERE tenant_id')) {
              return { rows: [] }; // not duplicate
            }
            if (sql.includes('FROM restaurant_payment_settings')) {
              return { rows: [{ is_active: true }] };
            }
            if (sql.includes('FROM orders')) {
              return {
                rows: [
                  {
                    id: 'ord-1',
                    order_number: 'ORD-101',
                    currency: 'INR',
                    subtotal_minor: 50000,
                    tax_minor: 2500,
                    discount_minor: 0,
                    total_minor: 52500,
                  },
                ],
              };
            }
            if (sql.includes('FROM restaurant_bills')) {
              if (sql.includes('FOR UPDATE') && sql.includes('table_session_id')) {
                return { rows: [{ id: 'bill-1', status: 'UNPAID' }] };
              }
              return {
                rows: [{ id: 'bill-1', status: 'UNPAID', total_minor: 52500, currency: 'INR' }],
              };
            }
            return { rows: [{ id: 'line-1' }] };
          }),
        };
        return cb(client);
      });

      // Mock subsequent getCustomerSessionBill read
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sess-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              status: 'OPEN',
              table_code: 'T-01',
              table_label: 'Table 1',
              tenant_name: 'Spice Garden',
              location_name: 'Main Branch',
              tax_rate_percent: '5.00',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ currency: 'INR', subtotal_minor: 50000, tax_minor: 2500, total_minor: 52500 }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'bill-1' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'bill-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              location_name: 'Main Branch',
              tenant_name: 'Spice Garden',
              table_session_id: 'sess-1',
              table_id: 'tbl-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              bill_number: 'INV-20261125-AB12',
              status: 'PAYMENT_REPORTED',
              currency: 'INR',
              subtotal_minor: 50000,
              tax_minor: 2500,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 52500,
              notes: null,
              void_reason: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }) // bill_orders
        .mockResolvedValueOnce({ rows: [] }) // bill_lines
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pay-1',
              bill_id: 'bill-1',
              amount_minor: 52500,
              currency: 'INR',
              method: 'RESTAURANT_UPI_QR',
              status: 'PAYMENT_REPORTED',
              customer_reference: '423116789045',
              reported_by_type: 'CUSTOMER_GUEST',
              reported_by_id: null,
              reported_by_name: null,
              reported_at: new Date(),
              verified_by: null,
              verified_by_name: null,
              verified_at: null,
              notes: 'Customer-submitted UPI reference',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              is_active: true,
              upi_id: 'spicegarden@okicici',
              display_name: 'Spice Garden',
              qr_asset_url: null,
              instructions: null,
            },
          ],
        });

      const result = await service.submitCustomerPaymentReference('tok-123', {
        sessionToken: 'tok-123',
        method: 'RESTAURANT_UPI_QR',
        customerReference: '423116789045',
        idempotencyKey: 'idemp-upi-1',
      });

      const insertPay = executedQueries.find((q) =>
        q.sql.includes('INSERT INTO restaurant_payments')
      );
      expect(insertPay).toBeDefined();
      expect(insertPay!.sql).toContain("'PAYMENT_REPORTED'");
      expect(insertPay!.sql).toContain('NULL, NULL'); // verified_by, verified_at remain NULL
      expect(result.bill?.status).toBe('PAYMENT_REPORTED');
      expect(result.bill?.payments[0].verifiedBy).toBeNull();
    });
  });

  describe('Authorized Staff Payment Verification & Audit (FR-PAY-04, T-07)', () => {
    it('verifies payment, marks bill VERIFIED_PAID, records audit log, and closes session when no kitchen orders remain', async () => {
      const executedQueries: Array<{ sql: string; params: any[] }> = [];

      mockDb.transaction = jest.fn(async (cb) => {
        const client = {
          query: jest.fn(async (sql: string, params: any[] = []) => {
            executedQueries.push({ sql, params });
            if (sql.includes('FROM restaurant_payments')) {
              return {
                rows: [
                  {
                    id: 'pay-1',
                    tenant_id: TENANT_A,
                    location_id: LOC_A,
                    bill_id: 'bill-1',
                    amount_minor: 52500,
                    method: 'RESTAURANT_UPI_QR',
                    status: 'PAYMENT_REPORTED',
                    customer_reference: '423116789045',
                  },
                ],
              };
            }
            if (sql.includes('FROM restaurant_bills')) {
              return {
                rows: [
                  {
                    id: 'bill-1',
                    status: 'PAYMENT_REPORTED',
                    table_session_id: 'sess-1',
                    table_id: 'tbl-1',
                  },
                ],
              };
            }
            if (sql.includes('SELECT service_mode FROM locations')) {
              return { rows: [{ service_mode: 'TABLE_SERVICE' }] };
            }
            if (sql.includes('FROM orders') && sql.includes('FOR UPDATE')) {
              return { rows: [{ id: 'ord-1', status: 'SERVED' }] };
            }
            if (sql.includes('FROM orders') && sql.includes('LIMIT 1')) {
              return { rows: [] }; // No remaining in-flight orders
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'bill-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              location_name: 'Main Branch',
              tenant_name: 'Spice Garden',
              table_session_id: 'sess-1',
              table_id: 'tbl-1',
              table_code: 'T-01',
              table_label: 'Table 1',
              bill_number: 'INV-20261125-AB12',
              status: 'VERIFIED_PAID',
              currency: 'INR',
              subtotal_minor: 50000,
              tax_minor: 2500,
              tax_rate_percent: '5.00',
              discount_minor: 0,
              total_minor: 52500,
              notes: null,
              void_reason: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'pay-1',
              bill_id: 'bill-1',
              amount_minor: 52500,
              currency: 'INR',
              method: 'RESTAURANT_UPI_QR',
              status: 'VERIFIED_PAID',
              customer_reference: '423116789045',
              reported_by_type: 'CUSTOMER_GUEST',
              reported_by_id: null,
              reported_by_name: null,
              reported_at: new Date(),
              verified_by: USER_REC,
              verified_by_name: 'Receptionist',
              verified_at: new Date(),
              notes: 'Verified in bank app',
            },
          ],
        });

      const bill = await service.verifyPayment(receptionCtx, 'pay-1', {
        approved: true,
        notes: 'Verified in bank app',
      });

      expect(bill.status).toBe('VERIFIED_PAID');
      expect(bill.payments[0].verifiedBy).toBe(USER_REC);
      expect(
        executedQueries.some((q) => q.sql.includes("action, resource_type") && q.sql.includes("'PAYMENT_VERIFIED'"))
      ).toBe(true);
      expect(
        executedQueries.some((q) => q.sql.includes("UPDATE table_sessions SET status = 'CLOSED'"))
      ).toBe(true);
    });
  });
});
