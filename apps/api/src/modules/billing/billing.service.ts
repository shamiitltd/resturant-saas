import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import type pg from 'pg';
import { DatabaseService } from '../../database/database.service.js';
import type {
  TenantContextDto,
  RestaurantPaymentSettingsDto,
  UpsertPaymentSettingsRequestDto,
  RestaurantBillDto,
  BillLineDto,
  BillOrderSummaryDto,
  RestaurantPaymentDto,
  StaffBillingQueueResponseDto,
  BillingQueueSessionDto,
  GenerateBillRequestDto,
  RecordStaffPaymentRequestDto,
  VerifyPaymentRequestDto,
  VoidBillRequestDto,
  CustomerSubmitPaymentReferenceRequestDto,
  CustomerBillSummaryDto,
  RestaurantPaymentMethod,
} from '@restaurant-saas/contracts';

const VALID_METHODS: RestaurantPaymentMethod[] = ['RESTAURANT_UPI_QR', 'CASH', 'CARD', 'OTHER'];

@Injectable()
export class BillingService {
  constructor(private readonly db: DatabaseService) {}

  private hasPermission(tenantContext: TenantContextDto, permissionCode: string): boolean {
    if (tenantContext.actorType === 'PLATFORM_ADMIN') return true;
    if (tenantContext.roleCodes.includes('OWNER')) return true;
    if (
      tenantContext.roleCodes.includes('MANAGER') &&
      permissionCode.startsWith('billing.')
    ) {
      return true;
    }
    if (
      tenantContext.roleCodes.includes('RECEPTIONIST') &&
      (permissionCode === 'billing.view' ||
        permissionCode === 'billing.create' ||
        permissionCode === 'billing.verify_payment')
    ) {
      return true;
    }
    return tenantContext.permissions.includes(permissionCode);
  }

  private assertPermission(tenantContext: TenantContextDto, permissionCode: string) {
    if (!this.hasPermission(tenantContext, permissionCode)) {
      throw new ForbiddenException(`Missing required permission: ${permissionCode}`);
    }
  }

  private async resolveLocationId(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<string> {
    if (
      tenantContext.actorType === 'PLATFORM_ADMIN' ||
      tenantContext.roleCodes.includes('OWNER')
    ) {
      if (requestedLocationId) {
        const locCheck = await this.db.query<{ id: string }>(
          `SELECT id FROM locations WHERE id = $1 AND tenant_id = $2 AND status = 'ACTIVE'`,
          [requestedLocationId, tenantContext.tenantId]
        );
        if (locCheck.rows.length === 0) {
          throw new ForbiddenException(`Location ${requestedLocationId} does not belong to tenant`);
        }
        return requestedLocationId;
      }
      if (tenantContext.locationId) return tenantContext.locationId;
      const firstLoc = await this.db.query<{ id: string }>(
        `SELECT id FROM locations WHERE tenant_id = $1 AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1`,
        [tenantContext.tenantId]
      );
      if (firstLoc.rows.length === 0) {
        throw new NotFoundException('No active locations found for tenant');
      }
      return firstLoc.rows[0].id;
    }

    if (requestedLocationId) {
      if (requestedLocationId === tenantContext.locationId) return requestedLocationId;
      const check = await this.db.query<{ location_id: string }>(
        `SELECT lm.location_id FROM location_memberships lm
         JOIN locations loc ON loc.id = lm.location_id
         WHERE lm.membership_id = $1 AND lm.location_id = $2 AND loc.tenant_id = $3 AND loc.status = 'ACTIVE'`,
        [tenantContext.membershipId, requestedLocationId, tenantContext.tenantId]
      );
      if (check.rows.length === 0) {
        throw new ForbiddenException(`Location access denied: You are not assigned to location ${requestedLocationId}`);
      }
      return requestedLocationId;
    }

    if (tenantContext.locationId) return tenantContext.locationId;

    const assignedLocs = await this.db.query<{ location_id: string }>(
      `SELECT lm.location_id FROM location_memberships lm
       JOIN locations loc ON loc.id = lm.location_id
       WHERE lm.membership_id = $1 AND loc.tenant_id = $2 AND loc.status = 'ACTIVE'
       ORDER BY lm.is_primary DESC, lm.created_at ASC LIMIT 1`,
      [tenantContext.membershipId, tenantContext.tenantId]
    );
    if (assignedLocs.rows.length === 0) {
      throw new ForbiddenException('No active branch/outlet assignment found for your staff profile');
    }
    return assignedLocs.rows[0].location_id;
  }

  // ---------------------------------------------------------------------------
  // 1. Branch Payment Settings (FR-PAY-02)
  // ---------------------------------------------------------------------------

  async getBranchPaymentSettings(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<RestaurantPaymentSettingsDto> {
    this.assertPermission(tenantContext, 'billing.view');
    const locationId = await this.resolveLocationId(tenantContext, requestedLocationId);

    const res = await this.db.query<{
      id: string | null;
      tenant_id: string;
      location_id: string;
      location_name: string;
      upi_id: string | null;
      display_name: string | null;
      qr_asset_url: string | null;
      instructions: string | null;
      accepted_methods: RestaurantPaymentMethod[] | null;
      is_active: boolean | null;
      tax_rate_percent: string | number | null;
      updated_at: Date | null;
    }>(
      `SELECT rps.id,
              l.tenant_id,
              l.id AS location_id,
              l.name AS location_name,
              rps.upi_id,
              rps.display_name,
              rps.qr_asset_url,
              rps.instructions,
              rps.accepted_methods,
              rps.is_active,
              t.tax_rate_percent,
              rps.updated_at
       FROM locations l
       JOIN tenants t ON t.id = l.tenant_id
       LEFT JOIN restaurant_payment_settings rps
         ON rps.location_id = l.id AND rps.tenant_id = l.tenant_id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [locationId, tenantContext.tenantId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Branch not found');
    }

    const row = res.rows[0];
    return {
      id: row.id || undefined,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      locationName: row.location_name,
      upiId: row.upi_id,
      displayName: row.display_name,
      qrAssetUrl: row.qr_asset_url,
      instructions: row.instructions,
      acceptedMethods: row.accepted_methods || ['RESTAURANT_UPI_QR', 'CASH', 'CARD', 'OTHER'],
      isActive: Boolean(row.is_active),
      taxRatePercent: row.tax_rate_percent !== null && row.tax_rate_percent !== undefined ? Number(row.tax_rate_percent) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    };
  }

  async upsertBranchPaymentSettings(
    tenantContext: TenantContextDto,
    dto: UpsertPaymentSettingsRequestDto
  ): Promise<RestaurantPaymentSettingsDto> {
    if (
      tenantContext.actorType !== 'PLATFORM_ADMIN' &&
      !tenantContext.roleCodes.includes('OWNER') &&
      !tenantContext.roleCodes.includes('MANAGER') &&
      !tenantContext.permissions.includes('staff.manage')
    ) {
      throw new ForbiddenException('Only Owners or Managers can update branch payment settings');
    }

    const locationId = await this.resolveLocationId(tenantContext, dto.locationId);

    const upiId = dto.upiId?.trim() || null;
    if (upiId && !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9._-]{2,64}$/.test(upiId)) {
      throw new BadRequestException('Invalid UPI ID format (expected handle@provider, e.g. spicegarden@okicici)');
    }
    if (dto.isActive && !upiId && !dto.qrAssetUrl?.trim()) {
      throw new BadRequestException('Provide a UPI ID or QR image before activating restaurant UPI payments');
    }

    if (dto.taxRatePercent !== undefined && dto.taxRatePercent !== null) {
      const rate = Number(dto.taxRatePercent);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new BadRequestException('taxRatePercent must be between 0 and 100');
      }
    }

    const acceptedMethods = (dto.acceptedMethods && dto.acceptedMethods.length > 0
      ? dto.acceptedMethods.filter((m) => VALID_METHODS.includes(m))
      : ['RESTAURANT_UPI_QR', 'CASH', 'CARD', 'OTHER']) as RestaurantPaymentMethod[];

    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO restaurant_payment_settings (
           tenant_id, location_id, upi_id, display_name, qr_asset_url,
           instructions, accepted_methods, is_active, updated_by, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, now())
         ON CONFLICT (tenant_id, location_id) DO UPDATE SET
           upi_id = EXCLUDED.upi_id,
           display_name = EXCLUDED.display_name,
           qr_asset_url = EXCLUDED.qr_asset_url,
           instructions = EXCLUDED.instructions,
           accepted_methods = EXCLUDED.accepted_methods,
           is_active = EXCLUDED.is_active,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [
          tenantContext.tenantId,
          locationId,
          upiId,
          dto.displayName?.trim() || null,
          dto.qrAssetUrl?.trim() || null,
          dto.instructions?.trim() || null,
          JSON.stringify(acceptedMethods),
          Boolean(dto.isActive),
          tenantContext.actorId,
        ]
      );

      if (dto.taxRatePercent !== undefined) {
        await client.query(
          `UPDATE tenants SET tax_rate_percent = $1, updated_at = now() WHERE id = $2`,
          [dto.taxRatePercent === null ? null : Number(dto.taxRatePercent), tenantContext.tenantId]
        );
      }

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, 'PAYMENT_SETTINGS_UPDATED', 'restaurant_payment_settings', $5, $6::jsonb)`,
        [
          tenantContext.tenantId,
          locationId,
          tenantContext.actorId,
          tenantContext.actorType,
          String(locationId),
          JSON.stringify({
            upiId,
            isActive: Boolean(dto.isActive),
            taxRatePercent: dto.taxRatePercent,
          }),
        ]
      );
    });

    return this.getBranchPaymentSettings(tenantContext, locationId);
  }

  // ---------------------------------------------------------------------------
  // 2. Staff Billing Queue (02-staff/05-billing-invoices.png)
  // ---------------------------------------------------------------------------

  async getStaffBillingQueue(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<StaffBillingQueueResponseDto> {
    this.assertPermission(tenantContext, 'billing.view');
    const locationId = await this.resolveLocationId(tenantContext, requestedLocationId);

    const locRes = await this.db.query<{
      location_name: string;
      tenant_name: string;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT l.name AS location_name, t.name AS tenant_name, t.tax_rate_percent
       FROM locations l
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [locationId, tenantContext.tenantId]
    );
    if (locRes.rows.length === 0) {
      throw new NotFoundException('Location not found');
    }

    const paymentSettings = await this.getBranchPaymentSettings(tenantContext, locationId);
    const tenantTaxRate =
      locRes.rows[0].tax_rate_percent !== null && locRes.rows[0].tax_rate_percent !== undefined
        ? Number(locRes.rows[0].tax_rate_percent)
        : null;

    // Fetch recent/active table sessions at this branch
    const sessionsRes = await this.db.query<{
      id: string;
      status: 'OPEN' | 'CLOSING' | 'CLOSED';
      opened_at: Date;
      closed_at: Date | null;
      table_id: string;
      table_code: string;
      table_label: string;
    }>(
      `SELECT ts.id, ts.status, ts.opened_at, ts.closed_at,
              rt.id AS table_id, rt.table_code, rt.label AS table_label
       FROM table_sessions ts
       JOIN restaurant_tables rt ON rt.id = ts.table_id
       WHERE ts.tenant_id = $1 AND ts.location_id = $2
         AND (ts.status IN ('OPEN', 'CLOSING') OR ts.opened_at >= now() - interval '24 hours')
       ORDER BY
         CASE WHEN ts.status = 'OPEN' THEN 0 WHEN ts.status = 'CLOSING' THEN 1 ELSE 2 END,
         ts.opened_at DESC
       LIMIT 60`,
      [tenantContext.tenantId, locationId]
    );

    const sessionIds = sessionsRes.rows.map((s) => s.id);
    if (sessionIds.length === 0) {
      return {
        locationId,
        locationName: locRes.rows[0].location_name,
        tenantName: locRes.rows[0].tenant_name,
        paymentSettings,
        summary: {
          billsToday: 0,
          totalSalesMinor: 0,
          avgBillMinor: 0,
          upiCollectedMinor: 0,
          cashCollectedMinor: 0,
          cardOtherCollectedMinor: 0,
          pendingBillsCount: 0,
          reportedCount: 0,
        },
        sessions: [],
      };
    }

    // Fetch orders & items for these sessions
    const ordersRes = await this.db.query<{
      id: string;
      table_session_id: string;
      order_number: string;
      status: string;
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      total_minor: number;
      created_at: Date;
    }>(
      `SELECT id, table_session_id, order_number, status, currency,
              subtotal_minor, tax_minor, total_minor, created_at
       FROM orders
       WHERE tenant_id = $1 AND location_id = $2
         AND table_session_id = ANY($3::uuid[])
       ORDER BY created_at ASC`,
      [tenantContext.tenantId, locationId, sessionIds]
    );

    const orderIds = ordersRes.rows.map((o) => o.id);
    const itemsByOrder = new Map<string, any[]>();
    if (orderIds.length > 0) {
      const itemsRes = await this.db.query<{
        order_id: string;
        item_id: string;
        item_name_snapshot: string;
        unit_price_minor: number;
        quantity: number;
        subtotal_minor: number;
        selected_modifiers: any;
      }>(
        `SELECT order_id, item_id, item_name_snapshot, unit_price_minor, quantity, subtotal_minor, selected_modifiers
         FROM order_items
         WHERE order_id = ANY($1::uuid[])
         ORDER BY id ASC`,
        [orderIds]
      );
      for (const item of itemsRes.rows) {
        const list = itemsByOrder.get(item.order_id) || [];
        list.push({
          itemId: item.item_id,
          itemName: item.item_name_snapshot,
          unitPriceMinor: item.unit_price_minor,
          quantity: item.quantity,
          subtotalMinor: item.subtotal_minor,
          selectedModifiers: Array.isArray(item.selected_modifiers) ? item.selected_modifiers : [],
        });
        itemsByOrder.set(item.order_id, list);
      }
    }

    // Fetch non-voided bills for these sessions
    const billsRes = await this.db.query<{ id: string; table_session_id: string }>(
      `SELECT id, table_session_id
       FROM restaurant_bills
       WHERE tenant_id = $1 AND location_id = $2
         AND table_session_id = ANY($3::uuid[])
         AND status != 'VOIDED'`,
      [tenantContext.tenantId, locationId, sessionIds]
    );

    const billBySession = new Map<string, RestaurantBillDto>();
    for (const bRow of billsRes.rows) {
      const fullBill = await this.getBillByIdInternal(tenantContext.tenantId, bRow.id);
      if (fullBill && bRow.table_session_id) {
        billBySession.set(bRow.table_session_id, fullBill);
      }
    }

    const sessions: BillingQueueSessionDto[] = [];
    for (const s of sessionsRes.rows) {
      const sessionOrders = ordersRes.rows.filter((o) => o.table_session_id === s.id);
      const eligibleOrders = sessionOrders.filter(
        (o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED'
      );
      if (eligibleOrders.length === 0 && !billBySession.has(s.id)) {
        continue;
      }

      const estimatedSubtotalMinor = eligibleOrders.reduce((sum, o) => sum + Number(o.subtotal_minor), 0);
      const ordersTaxSum = eligibleOrders.reduce((sum, o) => sum + Number(o.tax_minor), 0);
      const estimatedTaxMinor =
        tenantTaxRate !== null && tenantTaxRate > 0
          ? Math.round(estimatedSubtotalMinor * (tenantTaxRate / 100))
          : ordersTaxSum;
      const estimatedTotalMinor = estimatedSubtotalMinor + estimatedTaxMinor;
      const itemsCount = eligibleOrders.reduce((sum, o) => {
        const orderItems = itemsByOrder.get(o.id) || [];
        return sum + orderItems.reduce((iSum, item) => iSum + item.quantity, 0);
      }, 0);

      sessions.push({
        tableSessionId: s.id,
        sessionStatus: s.status,
        openedAt: new Date(s.opened_at).toISOString(),
        closedAt: s.closed_at ? new Date(s.closed_at).toISOString() : null,
        tableId: s.table_id,
        tableCode: s.table_code,
        tableLabel: s.table_label,
        currency: eligibleOrders[0]?.currency || 'INR',
        ordersCount: eligibleOrders.length,
        itemsCount,
        estimatedSubtotalMinor,
        estimatedTaxMinor,
        estimatedTotalMinor,
        taxRatePercent: tenantTaxRate,
        orders: eligibleOrders.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          status: o.status,
          subtotalMinor: Number(o.subtotal_minor),
          taxMinor: Number(o.tax_minor),
          totalMinor: Number(o.total_minor),
          createdAt: new Date(o.created_at).toISOString(),
          items: itemsByOrder.get(o.id) || [],
        })),
        bill: billBySession.get(s.id) || null,
      });
    }

    // Daily KPI summary from real restaurant_bills & restaurant_payments
    const kpiRes = await this.db.query<{
      bills_today: number;
      total_sales_minor: string;
      upi_collected_minor: string;
      cash_collected_minor: string;
      card_other_collected_minor: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM restaurant_bills
          WHERE tenant_id = $1 AND location_id = $2 AND status = 'VERIFIED_PAID'
            AND created_at >= date_trunc('day', now())) AS bills_today,
         (SELECT COALESCE(SUM(total_minor), 0)::bigint FROM restaurant_bills
          WHERE tenant_id = $1 AND location_id = $2 AND status = 'VERIFIED_PAID'
            AND created_at >= date_trunc('day', now())) AS total_sales_minor,
         (SELECT COALESCE(SUM(amount_minor), 0)::bigint FROM restaurant_payments
          WHERE tenant_id = $1 AND location_id = $2 AND status = 'VERIFIED_PAID'
            AND method = 'RESTAURANT_UPI_QR' AND verified_at >= date_trunc('day', now())) AS upi_collected_minor,
         (SELECT COALESCE(SUM(amount_minor), 0)::bigint FROM restaurant_payments
          WHERE tenant_id = $1 AND location_id = $2 AND status = 'VERIFIED_PAID'
            AND method = 'CASH' AND verified_at >= date_trunc('day', now())) AS cash_collected_minor,
         (SELECT COALESCE(SUM(amount_minor), 0)::bigint FROM restaurant_payments
          WHERE tenant_id = $1 AND location_id = $2 AND status = 'VERIFIED_PAID'
            AND method IN ('CARD', 'OTHER') AND verified_at >= date_trunc('day', now())) AS card_other_collected_minor`,
      [tenantContext.tenantId, locationId]
    );

    const kpi = kpiRes.rows[0];
    const billsToday = Number(kpi?.bills_today || 0);
    const totalSalesMinor = Number(kpi?.total_sales_minor || 0);
    const pendingBillsCount = sessions.filter(
      (s) => !s.bill || s.bill.status === 'UNPAID' || s.bill.status === 'PAYMENT_REPORTED'
    ).length;
    const reportedCount = sessions.filter((s) => s.bill?.status === 'PAYMENT_REPORTED').length;

    return {
      locationId,
      locationName: locRes.rows[0].location_name,
      tenantName: locRes.rows[0].tenant_name,
      paymentSettings,
      summary: {
        billsToday,
        totalSalesMinor,
        avgBillMinor: billsToday > 0 ? Math.round(totalSalesMinor / billsToday) : 0,
        upiCollectedMinor: Number(kpi?.upi_collected_minor || 0),
        cashCollectedMinor: Number(kpi?.cash_collected_minor || 0),
        cardOtherCollectedMinor: Number(kpi?.card_other_collected_minor || 0),
        pendingBillsCount,
        reportedCount,
      },
      sessions,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Consolidated Bill Generation (ADR-003, FR-PAY-01)
  // ---------------------------------------------------------------------------

  async generateConsolidatedBill(
    tenantContext: TenantContextDto,
    tableSessionId: string,
    dto: GenerateBillRequestDto
  ): Promise<RestaurantBillDto> {
    this.assertPermission(tenantContext, 'billing.create');

    const billId = await this.db.transaction(async (client) => {
      const sessionRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        table_id: string;
        status: string;
        tax_rate_percent: string | number | null;
      }>(
        `SELECT ts.id, ts.tenant_id, ts.location_id, ts.table_id, ts.status, t.tax_rate_percent
         FROM table_sessions ts
         JOIN tenants t ON t.id = ts.tenant_id
         WHERE ts.id = $1 AND ts.tenant_id = $2
         FOR UPDATE OF ts`,
        [tableSessionId, tenantContext.tenantId]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundException(`Table session ${tableSessionId} not found`);
      }

      const session = sessionRes.rows[0];
      await this.resolveLocationId(tenantContext, session.location_id);

      return this.ensureConsolidatedBillInTx(
        client,
        {
          tenantId: session.tenant_id,
          locationId: session.location_id,
          tableSessionId: session.id,
          tableId: session.table_id,
          taxRatePercent:
            session.tax_rate_percent !== null && session.tax_rate_percent !== undefined
              ? Number(session.tax_rate_percent)
              : null,
        },
        tenantContext.actorId,
        tenantContext.actorType,
        dto.notes,
        dto.recalculate ?? true
      );
    });

    const bill = await this.getBillByIdInternal(tenantContext.tenantId, billId);
    if (!bill) throw new NotFoundException('Generated bill not found');
    return bill;
  }

  private async ensureConsolidatedBillInTx(
    client: pg.PoolClient,
    session: {
      tenantId: string;
      locationId: string;
      tableSessionId: string;
      tableId: string;
      taxRatePercent: number | null;
    },
    actorId: string | null,
    actorType: string,
    notes?: string,
    recalculate = true
  ): Promise<string> {
    // Load all eligible persisted orders in the session
    const ordersRes = await client.query<{
      id: string;
      order_number: string;
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      discount_minor: number;
      total_minor: number;
    }>(
      `SELECT id, order_number, currency, subtotal_minor, tax_minor, discount_minor, total_minor
       FROM orders
       WHERE tenant_id = $1 AND table_session_id = $2
         AND status NOT IN ('CANCELLED', 'REJECTED')
       ORDER BY created_at ASC`,
      [session.tenantId, session.tableSessionId]
    );

    if (ordersRes.rows.length === 0) {
      throw new BadRequestException('Cannot generate a bill for a table session with no active orders');
    }

    const subtotalMinor = ordersRes.rows.reduce((sum, o) => sum + Number(o.subtotal_minor), 0);
    const ordersTaxSum = ordersRes.rows.reduce((sum, o) => sum + Number(o.tax_minor), 0);
    const taxMinor =
      session.taxRatePercent !== null && session.taxRatePercent > 0
        ? Math.round(subtotalMinor * (session.taxRatePercent / 100))
        : ordersTaxSum;
    const discountMinor = ordersRes.rows.reduce((sum, o) => sum + Number(o.discount_minor), 0);
    const totalMinor = Math.max(0, subtotalMinor + taxMinor - discountMinor);
    const currency = ordersRes.rows[0].currency || 'INR';

    const existingBillRes = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM restaurant_bills
       WHERE table_session_id = $1 AND tenant_id = $2 AND status != 'VOIDED'
       FOR UPDATE`,
      [session.tableSessionId, session.tenantId]
    );

    if (existingBillRes.rows.length > 0) {
      const existing = existingBillRes.rows[0];
      if (existing.status === 'VERIFIED_PAID') {
        throw new BadRequestException('Bill is already verified paid and cannot be modified');
      }
      if (!recalculate) {
        return existing.id;
      }

      // Refresh consolidated bill totals & snapshots (e.g., if diner placed an additional order in session)
      await client.query(
        `UPDATE restaurant_bills
         SET subtotal_minor = $1, tax_minor = $2, tax_rate_percent = $3,
             discount_minor = $4, total_minor = $5,
             notes = COALESCE($6, notes), updated_at = now()
         WHERE id = $7`,
        [
          subtotalMinor,
          taxMinor,
          session.taxRatePercent,
          discountMinor,
          totalMinor,
          notes?.trim() || null,
          existing.id,
        ]
      );

      await client.query(`DELETE FROM bill_orders WHERE bill_id = $1`, [existing.id]);
      await client.query(`DELETE FROM bill_lines WHERE bill_id = $1`, [existing.id]);

      await this.snapshotOrdersIntoBillTx(client, existing.id, session.tenantId, ordersRes.rows.map((o) => o.id));
      return existing.id;
    }

    const billNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO restaurant_bills (
         tenant_id, location_id, table_session_id, table_id, bill_number,
         status, currency, subtotal_minor, tax_minor, tax_rate_percent,
         discount_minor, total_minor, notes, created_by
       )
       VALUES ($1, $2, $3, $4, $5, 'UNPAID', $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        session.tenantId,
        session.locationId,
        session.tableSessionId,
        session.tableId,
        billNumber,
        currency,
        subtotalMinor,
        taxMinor,
        session.taxRatePercent,
        discountMinor,
        totalMinor,
        notes?.trim() || null,
        actorId,
      ]
    );

    const newBillId = insertRes.rows[0].id;
    await this.snapshotOrdersIntoBillTx(client, newBillId, session.tenantId, ordersRes.rows.map((o) => o.id));

    await client.query(
      `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, 'BILL_GENERATED', 'restaurant_bills', $5, $6::jsonb)`,
      [
        session.tenantId,
        session.locationId,
        actorId,
        actorType,
        newBillId,
        JSON.stringify({
          tableSessionId: session.tableSessionId,
          orderCount: ordersRes.rows.length,
          totalMinor,
        }),
      ]
    );

    return newBillId;
  }

  private async snapshotOrdersIntoBillTx(
    client: pg.PoolClient,
    billId: string,
    tenantId: string,
    orderIds: string[]
  ) {
    for (const orderId of orderIds) {
      await client.query(
        `INSERT INTO bill_orders (bill_id, order_id, tenant_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [billId, orderId, tenantId]
      );
    }

    const itemsRes = await client.query<{
      id: string;
      order_id: string;
      item_name_snapshot: string;
      unit_price_minor: number;
      quantity: number;
      subtotal_minor: number;
      selected_modifiers: any;
    }>(
      `SELECT id, order_id, item_name_snapshot, unit_price_minor, quantity, subtotal_minor, selected_modifiers
       FROM order_items
       WHERE order_id = ANY($1::uuid[])
       ORDER BY id ASC`,
      [orderIds]
    );

    for (const item of itemsRes.rows) {
      await client.query(
        `INSERT INTO bill_lines (
           bill_id, order_id, order_item_id, item_name_snapshot,
           unit_price_minor, quantity, line_total_minor, selected_modifiers
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          billId,
          item.order_id,
          item.id,
          item.item_name_snapshot,
          item.unit_price_minor,
          item.quantity,
          item.subtotal_minor,
          JSON.stringify(Array.isArray(item.selected_modifiers) ? item.selected_modifiers : []),
        ]
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Staff Record & Verify Payment (FR-PAY-03, FR-PAY-04, T-07)
  // ---------------------------------------------------------------------------

  async getBillById(tenantContext: TenantContextDto, billId: string): Promise<RestaurantBillDto> {
    this.assertPermission(tenantContext, 'billing.view');
    const bill = await this.getBillByIdInternal(tenantContext.tenantId, billId);
    if (!bill) {
      throw new NotFoundException(`Bill ${billId} not found`);
    }
    await this.resolveLocationId(tenantContext, bill.locationId);
    return bill;
  }

  async recordStaffPayment(
    tenantContext: TenantContextDto,
    billId: string,
    dto: RecordStaffPaymentRequestDto
  ): Promise<RestaurantBillDto> {
    this.assertPermission(tenantContext, 'billing.create');
    if (dto.verifyImmediately) {
      this.assertPermission(tenantContext, 'billing.verify_payment');
    }
    if (!VALID_METHODS.includes(dto.method)) {
      throw new BadRequestException(`Invalid payment method: ${dto.method}`);
    }

    const idempotencyKey = dto.idempotencyKey?.trim() || null;

    await this.db.transaction(async (client) => {
      if (idempotencyKey) {
        const dupRes = await client.query<{ id: string }>(
          `SELECT id FROM restaurant_payments WHERE tenant_id = $1 AND idempotency_key = $2`,
          [tenantContext.tenantId, idempotencyKey]
        );
        if (dupRes.rows.length > 0) {
          return;
        }
      }

      const billRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        table_session_id: string | null;
        table_id: string | null;
        status: string;
        currency: string;
        total_minor: number;
      }>(
        `SELECT id, tenant_id, location_id, table_session_id, table_id, status, currency, total_minor
         FROM restaurant_bills
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [billId, tenantContext.tenantId]
      );

      if (billRes.rows.length === 0) {
        throw new NotFoundException(`Bill ${billId} not found`);
      }

      const bill = billRes.rows[0];
      await this.resolveLocationId(tenantContext, bill.location_id);

      if (bill.status === 'VOIDED') {
        throw new BadRequestException('Cannot record payment against a voided bill');
      }
      if (bill.status === 'VERIFIED_PAID') {
        throw new BadRequestException('Bill is already verified as paid');
      }

      const nextStatus = dto.verifyImmediately ? 'VERIFIED_PAID' : 'PAYMENT_REPORTED';
      const paymentRes = await client.query<{ id: string }>(
        `INSERT INTO restaurant_payments (
           tenant_id, location_id, bill_id, amount_minor, currency, method,
           status, customer_reference, reported_by_type, reported_by_id,
           verified_by, verified_at, notes, idempotency_key
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TENANT_USER', $9, $10, $11, $12, $13)
         RETURNING id`,
        [
          bill.tenant_id,
          bill.location_id,
          bill.id,
          bill.total_minor,
          bill.currency,
          dto.method,
          nextStatus,
          dto.customerReference?.trim() || null,
          tenantContext.actorId,
          dto.verifyImmediately ? tenantContext.actorId : null,
          dto.verifyImmediately ? new Date() : null,
          dto.notes?.trim() || null,
          idempotencyKey,
        ]
      );

      await client.query(
        `UPDATE restaurant_bills SET status = $1, updated_at = now() WHERE id = $2`,
        [nextStatus, bill.id]
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, 'restaurant_payments', $6, $7::jsonb)`,
        [
          bill.tenant_id,
          bill.location_id,
          tenantContext.actorId,
          tenantContext.actorType,
          dto.verifyImmediately ? 'PAYMENT_VERIFIED' : 'PAYMENT_REPORTED_BY_STAFF',
          paymentRes.rows[0].id,
          JSON.stringify({
            billId: bill.id,
            method: dto.method,
            amountMinor: bill.total_minor,
            reference: dto.customerReference?.trim() || null,
          }),
        ]
      );

      if (dto.verifyImmediately && bill.table_session_id) {
        await this.tryCloseSessionAndCompleteServedOrdersTx(
          client,
          bill.tenant_id,
          bill.location_id,
          bill.table_session_id,
          bill.table_id,
          tenantContext.actorId
        );
      }
    });

    const updated = await this.getBillByIdInternal(tenantContext.tenantId, billId);
    if (!updated) throw new NotFoundException('Bill not found');
    return updated;
  }

  async verifyPayment(
    tenantContext: TenantContextDto,
    paymentId: string,
    dto: VerifyPaymentRequestDto
  ): Promise<RestaurantBillDto> {
    this.assertPermission(tenantContext, 'billing.verify_payment');

    const billId = await this.db.transaction(async (client) => {
      const payRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        bill_id: string;
        amount_minor: number;
        method: string;
        status: string;
        customer_reference: string | null;
      }>(
        `SELECT id, tenant_id, location_id, bill_id, amount_minor, method, status, customer_reference
         FROM restaurant_payments
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [paymentId, tenantContext.tenantId]
      );

      if (payRes.rows.length === 0) {
        throw new NotFoundException(`Payment record ${paymentId} not found`);
      }

      const payment = payRes.rows[0];
      await this.resolveLocationId(tenantContext, payment.location_id);

      const billRes = await client.query<{
        id: string;
        status: string;
        table_session_id: string | null;
        table_id: string | null;
      }>(
        `SELECT id, status, table_session_id, table_id
         FROM restaurant_bills
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [payment.bill_id, tenantContext.tenantId]
      );

      if (billRes.rows.length === 0) {
        throw new NotFoundException('Associated bill not found');
      }
      const bill = billRes.rows[0];

      if (bill.status === 'VOIDED') {
        throw new BadRequestException('Cannot verify payment on a voided bill');
      }
      if (payment.status === 'VERIFIED_PAID') {
        throw new BadRequestException('Payment has already been verified');
      }
      if (payment.status === 'VOIDED' || payment.status === 'REJECTED') {
        throw new BadRequestException(`Cannot verify payment in ${payment.status} state`);
      }

      if (dto.approved) {
        await client.query(
          `UPDATE restaurant_payments
           SET status = 'VERIFIED_PAID',
               verified_by = $1,
               verified_at = now(),
               customer_reference = COALESCE($2, customer_reference),
               notes = COALESCE($3, notes),
               updated_at = now()
           WHERE id = $4`,
          [
            tenantContext.actorId,
            dto.customerReference?.trim() || null,
            dto.notes?.trim() || null,
            payment.id,
          ]
        );

        await client.query(
          `UPDATE restaurant_bills SET status = 'VERIFIED_PAID', updated_at = now() WHERE id = $1`,
          [bill.id]
        );

        await client.query(
          `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, 'PAYMENT_VERIFIED', 'restaurant_payments', $5, $6::jsonb)`,
          [
            payment.tenant_id,
            payment.location_id,
            tenantContext.actorId,
            tenantContext.actorType,
            payment.id,
            JSON.stringify({
              billId: bill.id,
              method: payment.method,
              amountMinor: payment.amount_minor,
              customerReference: dto.customerReference?.trim() || payment.customer_reference,
              notes: dto.notes?.trim() || null,
            }),
          ]
        );

        await client.query(
          `INSERT INTO notification_outbox (tenant_id, location_id, event_type, payload)
           VALUES ($1, $2, 'BILL_PAID', $3::jsonb)`,
          [
            payment.tenant_id,
            payment.location_id,
            JSON.stringify({
              billId: bill.id,
              paymentId: payment.id,
              tableSessionId: bill.table_session_id,
              amountMinor: payment.amount_minor,
            }),
          ]
        );

        if (bill.table_session_id) {
          await this.tryCloseSessionAndCompleteServedOrdersTx(
            client,
            payment.tenant_id,
            payment.location_id,
            bill.table_session_id,
            bill.table_id,
            tenantContext.actorId
          );
        }
      } else {
        await client.query(
          `UPDATE restaurant_payments
           SET status = 'REJECTED',
               verified_by = $1,
               verified_at = now(),
               notes = COALESCE($2, notes),
               updated_at = now()
           WHERE id = $3`,
          [tenantContext.actorId, dto.notes?.trim() || 'Payment not received in restaurant channel', payment.id]
        );

        const remainingReported = await client.query<{ id: string }>(
          `SELECT id FROM restaurant_payments WHERE bill_id = $1 AND status = 'PAYMENT_REPORTED' LIMIT 1`,
          [bill.id]
        );
        const nextBillStatus = remainingReported.rows.length > 0 ? 'PAYMENT_REPORTED' : 'UNPAID';
        await client.query(
          `UPDATE restaurant_bills SET status = $1, updated_at = now() WHERE id = $2`,
          [nextBillStatus, bill.id]
        );

        await client.query(
          `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, $4, 'PAYMENT_REJECTED', 'restaurant_payments', $5, $6::jsonb)`,
          [
            payment.tenant_id,
            payment.location_id,
            tenantContext.actorId,
            tenantContext.actorType,
            payment.id,
            JSON.stringify({
              billId: bill.id,
              reason: dto.notes?.trim() || 'Not received',
            }),
          ]
        );
      }

      return bill.id;
    });

    const updated = await this.getBillByIdInternal(tenantContext.tenantId, billId);
    if (!updated) throw new NotFoundException('Bill not found');
    return updated;
  }

  async voidBill(
    tenantContext: TenantContextDto,
    billId: string,
    dto: VoidBillRequestDto
  ): Promise<RestaurantBillDto> {
    this.assertPermission(tenantContext, 'billing.void');
    if (!dto.voidReason || dto.voidReason.trim() === '') {
      throw new BadRequestException('A reason is required to void a bill');
    }

    await this.db.transaction(async (client) => {
      const billRes = await client.query<{ id: string; location_id: string; status: string }>(
        `SELECT id, location_id, status FROM restaurant_bills WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [billId, tenantContext.tenantId]
      );
      if (billRes.rows.length === 0) {
        throw new NotFoundException(`Bill ${billId} not found`);
      }

      const bill = billRes.rows[0];
      await this.resolveLocationId(tenantContext, bill.location_id);

      if (bill.status === 'VERIFIED_PAID') {
        throw new BadRequestException('Cannot void a bill that is already verified paid');
      }
      if (bill.status === 'VOIDED') {
        throw new BadRequestException('Bill is already voided');
      }

      await client.query(
        `UPDATE restaurant_bills
         SET status = 'VOIDED', void_reason = $1, voided_by = $2, voided_at = now(), updated_at = now()
         WHERE id = $3`,
        [dto.voidReason.trim(), tenantContext.actorId, bill.id]
      );

      await client.query(
        `UPDATE restaurant_payments
         SET status = 'VOIDED', updated_at = now()
         WHERE bill_id = $1 AND status IN ('UNPAID', 'PAYMENT_REPORTED')`,
        [bill.id]
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, 'BILL_VOIDED', 'restaurant_bills', $5, $6::jsonb)`,
        [
          tenantContext.tenantId,
          bill.location_id,
          tenantContext.actorId,
          tenantContext.actorType,
          bill.id,
          JSON.stringify({ voidReason: dto.voidReason.trim() }),
        ]
      );
    });

    const voided = await this.getBillByIdInternal(tenantContext.tenantId, billId);
    if (!voided) throw new NotFoundException('Bill not found');
    return voided;
  }

  private async tryCloseSessionAndCompleteServedOrdersTx(
    client: pg.PoolClient,
    tenantId: string,
    locationId: string,
    tableSessionId: string,
    tableId: string | null,
    actorId: string | null
  ) {
    // Transition SERVED (or COUNTER_SERVICE READY) orders in this session to COMPLETED
    const locRes = await client.query<{ service_mode: string }>(
      `SELECT service_mode FROM locations WHERE id = $1`,
      [locationId]
    );
    const serviceMode = locRes.rows[0]?.service_mode || 'TABLE_SERVICE';

    const completableStatuses = serviceMode === 'COUNTER_SERVICE' ? ['SERVED', 'READY'] : ['SERVED'];
    const ordersToComplete = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM orders
       WHERE tenant_id = $1 AND table_session_id = $2 AND status = ANY($3::varchar[])
       FOR UPDATE`,
      [tenantId, tableSessionId, completableStatuses]
    );

    for (const o of ordersToComplete.rows) {
      await client.query(
        `UPDATE orders SET status = 'COMPLETED', updated_at = now() WHERE id = $1`,
        [o.id]
      );
      await client.query(
        `INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, notes)
         VALUES ($1, $2, 'COMPLETED', 'TENANT_USER', $3, 'Auto-completed upon verified bill payment')`,
        [o.id, o.status, actorId]
      );
    }

    // Check if any in-flight orders remain in this session
    const activeKitchenRes = await client.query<{ id: string }>(
      `SELECT id FROM orders
       WHERE tenant_id = $1 AND table_session_id = $2
         AND status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED')
       LIMIT 1`,
      [tenantId, tableSessionId]
    );

    if (activeKitchenRes.rows.length === 0) {
      await client.query(
        `UPDATE table_sessions SET status = 'CLOSED', closed_at = now(), updated_at = now()
         WHERE id = $1 AND status != 'CLOSED'`,
        [tableSessionId]
      );
      if (tableId) {
        await client.query(
          `UPDATE restaurant_tables SET status = 'AVAILABLE', updated_at = now()
           WHERE id = $1 AND status = 'OCCUPIED'`,
          [tableId]
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Customer Session Bill & Unverified UPI Reference (FR-PAY-05, T-06)
  // ---------------------------------------------------------------------------

  async getCustomerSessionBill(sessionToken: string): Promise<CustomerBillSummaryDto> {
    if (!sessionToken || sessionToken.trim() === '') {
      throw new UnauthorizedException('Table session credential is required');
    }

    const sessionRes = await this.db.query<{
      id: string;
      tenant_id: string;
      location_id: string;
      status: 'OPEN' | 'CLOSING' | 'CLOSED';
      table_code: string;
      table_label: string;
      tenant_name: string;
      location_name: string;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT ts.id, ts.tenant_id, ts.location_id, ts.status,
              rt.table_code, rt.label AS table_label,
              t.name AS tenant_name, l.name AS location_name, t.tax_rate_percent
       FROM table_sessions ts
       JOIN restaurant_tables rt ON rt.id = ts.table_id
       JOIN tenants t ON t.id = ts.tenant_id
       JOIN locations l ON l.id = ts.location_id
       WHERE ts.session_token = $1`,
      [sessionToken.trim()]
    );

    if (sessionRes.rows.length === 0) {
      throw new NotFoundException('Invalid or expired table session');
    }

    const s = sessionRes.rows[0];

    const ordersRes = await this.db.query<{
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      total_minor: number;
    }>(
      `SELECT currency, subtotal_minor, tax_minor, total_minor
       FROM orders
       WHERE tenant_id = $1 AND table_session_id = $2
         AND status NOT IN ('CANCELLED', 'REJECTED')`,
      [s.tenant_id, s.id]
    );

    const subtotalMinor = ordersRes.rows.reduce((sum, o) => sum + Number(o.subtotal_minor), 0);
    const ordersTaxSum = ordersRes.rows.reduce((sum, o) => sum + Number(o.tax_minor), 0);
    const sessionTaxRate =
      s.tax_rate_percent !== null && s.tax_rate_percent !== undefined ? Number(s.tax_rate_percent) : null;
    const taxMinor =
      sessionTaxRate !== null && sessionTaxRate > 0
        ? Math.round(subtotalMinor * (sessionTaxRate / 100))
        : ordersTaxSum;
    const totalMinor = subtotalMinor + taxMinor;

    const activeBillRes = await this.db.query<{ id: string }>(
      `SELECT id FROM restaurant_bills
       WHERE table_session_id = $1 AND tenant_id = $2 AND status != 'VOIDED'
       LIMIT 1`,
      [s.id, s.tenant_id]
    );
    const bill = activeBillRes.rows[0]
      ? await this.getBillByIdInternal(s.tenant_id, activeBillRes.rows[0].id)
      : null;

    const settingsRes = await this.db.query<{
      is_active: boolean;
      upi_id: string | null;
      display_name: string | null;
      qr_asset_url: string | null;
      instructions: string | null;
    }>(
      `SELECT is_active, upi_id, display_name, qr_asset_url, instructions
       FROM restaurant_payment_settings
       WHERE tenant_id = $1 AND location_id = $2 AND is_active = true`,
      [s.tenant_id, s.location_id]
    );

    const activeSettings = settingsRes.rows[0] || null;

    return {
      tableSessionId: s.id,
      sessionStatus: s.status,
      tableCode: s.table_code,
      tableLabel: s.table_label,
      tenantName: s.tenant_name,
      locationName: s.location_name,
      currency: bill?.currency || ordersRes.rows[0]?.currency || 'INR',
      taxRatePercent:
        s.tax_rate_percent !== null && s.tax_rate_percent !== undefined ? Number(s.tax_rate_percent) : null,
      subtotalMinor: bill ? bill.subtotalMinor : subtotalMinor,
      taxMinor: bill ? bill.taxMinor : taxMinor,
      totalMinor: bill ? bill.totalMinor : totalMinor,
      bill,
      paymentSettings: activeSettings
        ? {
            isActive: activeSettings.is_active,
            upiId: activeSettings.upi_id,
            displayName: activeSettings.display_name,
            qrAssetUrl: activeSettings.qr_asset_url,
            instructions: activeSettings.instructions,
          }
        : null,
    };
  }

  async submitCustomerPaymentReference(
    sessionToken: string,
    dto: CustomerSubmitPaymentReferenceRequestDto
  ): Promise<CustomerBillSummaryDto> {
    if (!sessionToken || sessionToken.trim() === '') {
      throw new UnauthorizedException('Table session credential is required');
    }
    if (!dto.idempotencyKey || dto.idempotencyKey.trim() === '') {
      throw new BadRequestException('idempotencyKey is required');
    }

    const ref = dto.customerReference?.trim() || '';
    if (ref.length < 4 || ref.length > 64 || !/^[a-zA-Z0-9._/-]+$/.test(ref)) {
      throw new BadRequestException('Please enter a valid UPI transaction reference (4-64 alphanumeric characters)');
    }

    await this.db.transaction(async (client) => {
      const sessionRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        table_id: string;
        status: string;
        tax_rate_percent: string | number | null;
      }>(
        `SELECT ts.id, ts.tenant_id, ts.location_id, ts.table_id, ts.status, t.tax_rate_percent
         FROM table_sessions ts
         JOIN tenants t ON t.id = ts.tenant_id
         WHERE ts.session_token = $1
         FOR UPDATE OF ts`,
        [sessionToken.trim()]
      );

      if (sessionRes.rows.length === 0) {
        throw new NotFoundException('Invalid or expired table session');
      }
      const session = sessionRes.rows[0];

      // Idempotency check
      const dupRes = await client.query<{ id: string }>(
        `SELECT id FROM restaurant_payments WHERE tenant_id = $1 AND idempotency_key = $2`,
        [session.tenant_id, dto.idempotencyKey.trim()]
      );
      if (dupRes.rows.length > 0) {
        return;
      }

      // Ensure branch UPI QR settings are active (FR-PAY-02)
      const settingsRes = await client.query<{ is_active: boolean }>(
        `SELECT is_active FROM restaurant_payment_settings
         WHERE tenant_id = $1 AND location_id = $2 AND is_active = true`,
        [session.tenant_id, session.location_id]
      );
      if (settingsRes.rows.length === 0) {
        throw new BadRequestException('Restaurant UPI payment instructions are not currently active for this branch');
      }

      const billId = await this.ensureConsolidatedBillInTx(
        client,
        {
          tenantId: session.tenant_id,
          locationId: session.location_id,
          tableSessionId: session.id,
          tableId: session.table_id,
          taxRatePercent:
            session.tax_rate_percent !== null && session.tax_rate_percent !== undefined
              ? Number(session.tax_rate_percent)
              : null,
        },
        null,
        'CUSTOMER_GUEST',
        undefined,
        true
      );

      const billRes = await client.query<{ id: string; status: string; total_minor: number; currency: string }>(
        `SELECT id, status, total_minor, currency FROM restaurant_bills WHERE id = $1 FOR UPDATE`,
        [billId]
      );
      const bill = billRes.rows[0];
      if (bill.status === 'VERIFIED_PAID') {
        throw new BadRequestException('This bill has already been verified as paid');
      }

      // SECURITY INVARIANT (FR-PAY-05, T-06): Customer reference is strictly unverified metadata.
      // Status MUST be PAYMENT_REPORTED and verified_by/verified_at MUST remain NULL.
      await client.query(
        `INSERT INTO restaurant_payments (
           tenant_id, location_id, bill_id, amount_minor, currency,
           method, status, customer_reference, reported_by_type,
           reported_by_id, verified_by, verified_at, notes, idempotency_key
         )
         VALUES ($1, $2, $3, $4, $5, 'RESTAURANT_UPI_QR', 'PAYMENT_REPORTED', $6, 'CUSTOMER_GUEST', NULL, NULL, NULL, $7, $8)`,
        [
          session.tenant_id,
          session.location_id,
          bill.id,
          bill.total_minor,
          bill.currency,
          ref,
          dto.notes?.trim() || 'Customer-submitted UPI reference (awaiting staff verification)',
          dto.idempotencyKey.trim(),
        ]
      );

      await client.query(
        `UPDATE restaurant_bills SET status = 'PAYMENT_REPORTED', updated_at = now() WHERE id = $1 AND status = 'UNPAID'`,
        [bill.id]
      );

      await client.query(
        `INSERT INTO notification_outbox (tenant_id, location_id, event_type, payload)
         VALUES ($1, $2, 'PAYMENT_REPORTED', $3::jsonb)`,
        [
          session.tenant_id,
          session.location_id,
          JSON.stringify({
            billId: bill.id,
            tableSessionId: session.id,
            customerReference: ref,
            amountMinor: bill.total_minor,
          }),
        ]
      );
    });

    return this.getCustomerSessionBill(sessionToken);
  }

  // ---------------------------------------------------------------------------
  // Internal Hydration Helper
  // ---------------------------------------------------------------------------

  private async getBillByIdInternal(tenantId: string, billId: string): Promise<RestaurantBillDto | null> {
    const billRes = await this.db.query<{
      id: string;
      tenant_id: string;
      location_id: string;
      location_name: string;
      tenant_name: string;
      table_session_id: string | null;
      table_id: string | null;
      table_code: string | null;
      table_label: string | null;
      bill_number: string;
      status: RestaurantBillDto['status'];
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      tax_rate_percent: string | number | null;
      discount_minor: number;
      total_minor: number;
      notes: string | null;
      void_reason: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT rb.*, l.name AS location_name, t.name AS tenant_name,
              rt.table_code, rt.label AS table_label
       FROM restaurant_bills rb
       JOIN locations l ON l.id = rb.location_id
       JOIN tenants t ON t.id = rb.tenant_id
       LEFT JOIN restaurant_tables rt ON rt.id = rb.table_id
       WHERE rb.id = $1 AND rb.tenant_id = $2`,
      [billId, tenantId]
    );

    if (billRes.rows.length === 0) return null;
    const b = billRes.rows[0];

    const ordersRes = await this.db.query<{
      order_id: string;
      order_number: string;
      status: string;
      total_minor: number;
      created_at: Date;
    }>(
      `SELECT bo.order_id, o.order_number, o.status, o.total_minor, o.created_at
       FROM bill_orders bo
       JOIN orders o ON o.id = bo.order_id
       WHERE bo.bill_id = $1
       ORDER BY o.created_at ASC`,
      [billId]
    );

    const linesRes = await this.db.query<{
      id: string;
      order_id: string;
      order_number: string;
      order_item_id: string | null;
      item_name_snapshot: string;
      unit_price_minor: number;
      quantity: number;
      line_total_minor: number;
      selected_modifiers: any;
    }>(
      `SELECT bl.id, bl.order_id, o.order_number, bl.order_item_id,
              bl.item_name_snapshot, bl.unit_price_minor, bl.quantity,
              bl.line_total_minor, bl.selected_modifiers
       FROM bill_lines bl
       JOIN orders o ON o.id = bl.order_id
       WHERE bl.bill_id = $1
       ORDER BY o.created_at ASC, bl.id ASC`,
      [billId]
    );

    const paymentsRes = await this.db.query<{
      id: string;
      bill_id: string;
      amount_minor: number;
      currency: string;
      method: RestaurantPaymentMethod;
      status: RestaurantPaymentDto['status'];
      customer_reference: string | null;
      reported_by_type: 'CUSTOMER_GUEST' | 'TENANT_USER';
      reported_by_id: string | null;
      reported_by_name: string | null;
      reported_at: Date;
      verified_by: string | null;
      verified_by_name: string | null;
      verified_at: Date | null;
      notes: string | null;
    }>(
      `SELECT rp.*,
              pr.full_name AS reported_by_name,
              pv.full_name AS verified_by_name
       FROM restaurant_payments rp
       LEFT JOIN profiles pr ON pr.id = rp.reported_by_id
       LEFT JOIN profiles pv ON pv.id = rp.verified_by
       WHERE rp.bill_id = $1 AND rp.tenant_id = $2
       ORDER BY rp.created_at DESC`,
      [billId, tenantId]
    );

    const orders: BillOrderSummaryDto[] = ordersRes.rows.map((o) => ({
      orderId: o.order_id,
      orderNumber: o.order_number,
      status: o.status,
      totalMinor: Number(o.total_minor),
      createdAt: new Date(o.created_at).toISOString(),
    }));

    const lines: BillLineDto[] = linesRes.rows.map((l) => ({
      id: l.id,
      orderId: l.order_id,
      orderNumber: l.order_number,
      orderItemId: l.order_item_id,
      itemNameSnapshot: l.item_name_snapshot,
      unitPriceMinor: Number(l.unit_price_minor),
      quantity: Number(l.quantity),
      lineTotalMinor: Number(l.line_total_minor),
      selectedModifiers: Array.isArray(l.selected_modifiers) ? l.selected_modifiers : [],
    }));

    const payments: RestaurantPaymentDto[] = paymentsRes.rows.map((p) => ({
      id: p.id,
      billId: p.bill_id,
      amountMinor: Number(p.amount_minor),
      currency: p.currency,
      method: p.method,
      status: p.status,
      customerReference: p.customer_reference,
      reportedByType: p.reported_by_type,
      reportedById: p.reported_by_id,
      reportedByName: p.reported_by_name,
      reportedAt: new Date(p.reported_at).toISOString(),
      verifiedBy: p.verified_by,
      verifiedByName: p.verified_by_name,
      verifiedAt: p.verified_at ? new Date(p.verified_at).toISOString() : null,
      notes: p.notes,
    }));

    return {
      id: b.id,
      tenantId: b.tenant_id,
      locationId: b.location_id,
      locationName: b.location_name,
      tenantName: b.tenant_name,
      tableSessionId: b.table_session_id,
      tableId: b.table_id,
      tableCode: b.table_code,
      tableLabel: b.table_label,
      billNumber: b.bill_number,
      status: b.status,
      currency: b.currency,
      subtotalMinor: Number(b.subtotal_minor),
      taxMinor: Number(b.tax_minor),
      taxRatePercent:
        b.tax_rate_percent !== null && b.tax_rate_percent !== undefined ? Number(b.tax_rate_percent) : null,
      discountMinor: Number(b.discount_minor),
      totalMinor: Number(b.total_minor),
      notes: b.notes,
      voidReason: b.void_reason,
      createdAt: new Date(b.created_at).toISOString(),
      updatedAt: new Date(b.updated_at).toISOString(),
      orders,
      lines,
      payments,
    };
  }
}
