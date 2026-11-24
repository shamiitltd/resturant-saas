import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type {
  StaffOrderDto,
  StaffOrderListQueryDto,
  UpdateOrderStatusRequestDto,
  SetChefEtaRequestDto,
  StaffOrderTransitionResponseDto,
  OrderLifecycleStatus,
  OrderItemSnapshotDto,
} from '@restaurant-saas/contracts';
import type { TenantContextDto } from '@restaurant-saas/contracts';

const ALLOWED_TRANSITIONS: Record<OrderLifecycleStatus, OrderLifecycleStatus[]> = {
  PLACED: ['ACCEPTED', 'PREPARING', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'COMPLETED', 'CANCELLED'],
  SERVED: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

@Injectable()
export class StaffService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Resolve authoritative location ID for staff operations
   */
  private async resolveStaffLocationId(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<string> {
    if (tenantContext.actorType === 'PLATFORM_ADMIN') {
      if (requestedLocationId) return requestedLocationId;
      if (tenantContext.locationId) return tenantContext.locationId;
      // Default to first active location in tenant
      const locRes = await this.db.query<{ id: string }>(
        `SELECT id FROM locations WHERE tenant_id = $1 AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1`,
        [tenantContext.tenantId]
      );
      if (locRes.rows.length === 0) {
        throw new NotFoundException(`No active locations found for tenant ${tenantContext.tenantId}`);
      }
      return locRes.rows[0].id;
    }

    // Tenant staff: verify membership in location
    if (requestedLocationId) {
      if (requestedLocationId === tenantContext.locationId) {
        return requestedLocationId;
      }
      const check = await this.db.query(
        `SELECT lm.location_id FROM location_memberships lm
         WHERE lm.membership_id = $1 AND lm.location_id = $2`,
        [tenantContext.membershipId, requestedLocationId]
      );
      if (check.rows.length === 0) {
        throw new ForbiddenException(`Location access denied: You are not assigned to location ${requestedLocationId}`);
      }
      return requestedLocationId;
    }

    if (tenantContext.locationId) {
      return tenantContext.locationId;
    }

    // Lookup primary or assigned location
    const assignedLocs = await this.db.query<{ location_id: string }>(
      `SELECT lm.location_id FROM location_memberships lm
       JOIN locations loc ON loc.id = lm.location_id
       WHERE lm.membership_id = $1 AND loc.status = 'ACTIVE'
       ORDER BY lm.is_primary DESC, lm.created_at ASC LIMIT 1`,
      [tenantContext.membershipId]
    );

    if (assignedLocs.rows.length === 0) {
      throw new ForbiddenException('No active branch/outlet assignment found for your staff profile');
    }

    return assignedLocs.rows[0].location_id;
  }

  /**
   * Check whether staff tenantContext has a specific permission
   */
  private hasPermission(tenantContext: TenantContextDto, permissionCode: string): boolean {
    if (tenantContext.actorType === 'PLATFORM_ADMIN') return true;
    if (tenantContext.roleCodes.includes('OWNER') || tenantContext.roleCodes.includes('MANAGER')) return true;
    if (
      tenantContext.roleCodes.includes('CHEF') &&
      (permissionCode.startsWith('kitchen.') ||
        permissionCode === 'orders.update_status' ||
        permissionCode === 'orders.view' ||
        permissionCode === 'orders.accept' ||
        permissionCode === 'orders.cancel')
    ) {
      return true;
    }
    if (
      tenantContext.roleCodes.includes('WAITER') &&
      (permissionCode.startsWith('waiter.') ||
        permissionCode === 'orders.update_status' ||
        permissionCode === 'orders.view' ||
        permissionCode === 'orders.complete')
    ) {
      return true;
    }
    if (
      tenantContext.roleCodes.includes('RECEPTIONIST') &&
      (permissionCode.startsWith('orders.') ||
        permissionCode.startsWith('billing.'))
    ) {
      return true;
    }
    return tenantContext.permissions.includes(permissionCode);
  }

  /**
   * 1. List Staff Orders (Reception Queue & Kitchen Queue)
   */
  async listStaffOrders(
    tenantContext: TenantContextDto,
    query: StaffOrderListQueryDto
  ): Promise<StaffOrderDto[]> {
    const locationId = await this.resolveStaffLocationId(tenantContext, query.locationId);

    let sql = `
      SELECT o.id, o.order_number, o.table_session_id, o.table_id,
             rt.table_code, rt.label as table_label,
             o.status, o.currency, o.subtotal_minor, o.tax_minor, o.total_minor,
             o.chef_eta_minutes, o.eta_updated_at, o.special_instructions,
             o.rejection_reason, o.cancellation_reason,
             (SELECT notes FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = 'COMPLETED' ORDER BY ose.occurred_at DESC LIMIT 1) as settlement_notes,
             o.waiter_id, p.full_name as waiter_name,
             loc.service_mode,
             o.created_at, o.updated_at
      FROM orders o
      JOIN locations loc ON loc.id = o.location_id
      LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
      LEFT JOIN profiles p ON p.id = o.waiter_id
      WHERE o.tenant_id = $1 AND o.location_id = $2
    `;
    const params: any[] = [tenantContext.tenantId, locationId];

    if (query.status && query.status.trim() !== '') {
      const statuses = query.status.split(',').map((s) => s.trim().toUpperCase());
      sql += ` AND o.status = ANY($3::varchar[])`;
      params.push(statuses);
    }

    // Sort: KDS prefers FIFO (created_at ASC), Reception prefers newest first (DESC)
    if (query.status && (query.status.includes('PLACED') || query.status.includes('ACCEPTED') || query.status.includes('PREPARING'))) {
      sql += ` ORDER BY o.created_at ASC`;
    } else {
      sql += ` ORDER BY o.created_at DESC`;
    }

    const ordersRes = await this.db.query<any>(sql, params);
    if (ordersRes.rows.length === 0) {
      return [];
    }

    const orderIds = ordersRes.rows.map((r: any) => r.id);

    // Fetch line items for all retrieved orders in one batch
    const itemsRes = await this.db.query<{
      order_id: string;
      item_id: string;
      item_name_snapshot: string;
      unit_price_minor: number;
      quantity: number;
      subtotal_minor: number;
      notes: string | null;
      selected_modifiers: any;
    }>(
      `SELECT order_id, item_id, item_name_snapshot, unit_price_minor, quantity, subtotal_minor, notes, selected_modifiers
       FROM order_items
       WHERE order_id = ANY($1::uuid[])`,
      [orderIds]
    );

    const itemsByOrder = new Map<string, OrderItemSnapshotDto[]>();
    for (const item of itemsRes.rows) {
      if (!itemsByOrder.has(item.order_id)) {
        itemsByOrder.set(item.order_id, []);
      }
      itemsByOrder.get(item.order_id)!.push({
        itemId: item.item_id,
        itemName: item.item_name_snapshot,
        unitPriceMinor: item.unit_price_minor,
        quantity: item.quantity,
        subtotalMinor: item.subtotal_minor,
        notes: item.notes || undefined,
        selectedModifiers: Array.isArray(item.selected_modifiers) ? item.selected_modifiers : [],
      });
    }

    const now = Date.now();
    return ordersRes.rows.map((row: any) => ({
      id: row.id,
      orderNumber: row.order_number,
      tableSessionId: row.table_session_id || undefined,
      tableId: row.table_id || undefined,
      tableCode: row.table_code || 'T-DINE',
      tableLabel: row.table_label || 'Dine-in Table',
      status: row.status as OrderLifecycleStatus,
      currency: row.currency,
      subtotalMinor: row.subtotal_minor,
      taxMinor: row.tax_minor,
      totalMinor: row.total_minor,
      chefEtaMinutes: row.chef_eta_minutes || undefined,
      etaUpdatedAt: row.eta_updated_at ? new Date(row.eta_updated_at).toISOString() : undefined,
      specialInstructions: row.special_instructions || undefined,
      rejectionReason: row.rejection_reason || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      settlementNotes: row.settlement_notes || undefined,
      waiterId: row.waiter_id || undefined,
      waiterName: row.waiter_name || undefined,
      serviceMode: row.service_mode || 'TABLE_SERVICE',
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      elapsedMinutes: Math.max(0, Math.floor((now - new Date(row.created_at).getTime()) / 60000)),
      items: itemsByOrder.get(row.id) || [],
    }));
  }

  /**
   * 2. Get Single Staff Order Details
   */
  async getStaffOrderById(
    tenantContext: TenantContextDto,
    orderId: string
  ): Promise<StaffOrderDto> {
    const orders = await this.db.query<any>(
      `SELECT o.id, o.order_number, o.table_session_id, o.table_id,
              rt.table_code, rt.label as table_label,
              o.status, o.currency, o.subtotal_minor, o.tax_minor, o.total_minor,
              o.chef_eta_minutes, o.eta_updated_at, o.special_instructions,
              o.rejection_reason, o.cancellation_reason,
              (SELECT notes FROM order_status_events ose WHERE ose.order_id = o.id AND ose.to_status = 'COMPLETED' ORDER BY ose.occurred_at DESC LIMIT 1) as settlement_notes,
              o.waiter_id, p.full_name as waiter_name,
              loc.service_mode,
              o.tenant_id, o.location_id,
              o.created_at, o.updated_at
       FROM orders o
       JOIN locations loc ON loc.id = o.location_id
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       LEFT JOIN profiles p ON p.id = o.waiter_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orders.rows.length === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const row = orders.rows[0];

    // Enforce Tenant Isolation
    if (row.tenant_id !== tenantContext.tenantId && tenantContext.actorType !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException(`Cross-tenant order access denied`);
    }

    // Enforce Location Scope
    if (tenantContext.actorType !== 'PLATFORM_ADMIN') {
      await this.resolveStaffLocationId(tenantContext, row.location_id);
    }

    // Fetch items
    const itemsRes = await this.db.query<{
      item_id: string;
      item_name_snapshot: string;
      unit_price_minor: number;
      quantity: number;
      subtotal_minor: number;
      notes: string | null;
      selected_modifiers: any;
    }>(
      `SELECT item_id, item_name_snapshot, unit_price_minor, quantity, subtotal_minor, notes, selected_modifiers
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    const now = Date.now();
    return {
      id: row.id,
      orderNumber: row.order_number,
      tableSessionId: row.table_session_id || undefined,
      tableId: row.table_id || undefined,
      tableCode: row.table_code || 'T-DINE',
      tableLabel: row.table_label || 'Dine-in Table',
      status: row.status as OrderLifecycleStatus,
      currency: row.currency,
      subtotalMinor: row.subtotal_minor,
      taxMinor: row.tax_minor,
      totalMinor: row.total_minor,
      chefEtaMinutes: row.chef_eta_minutes || undefined,
      etaUpdatedAt: row.eta_updated_at ? new Date(row.eta_updated_at).toISOString() : undefined,
      specialInstructions: row.special_instructions || undefined,
      rejectionReason: row.rejection_reason || undefined,
      cancellationReason: row.cancellation_reason || undefined,
      settlementNotes: row.settlement_notes || undefined,
      waiterId: row.waiter_id || undefined,
      waiterName: row.waiter_name || undefined,
      serviceMode: row.service_mode || 'TABLE_SERVICE',
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      elapsedMinutes: Math.max(0, Math.floor((now - new Date(row.created_at).getTime()) / 60000)),
      items: itemsRes.rows.map((item) => ({
        itemId: item.item_id,
        itemName: item.item_name_snapshot,
        unitPriceMinor: item.unit_price_minor,
        quantity: item.quantity,
        subtotalMinor: item.subtotal_minor,
        notes: item.notes || undefined,
        selectedModifiers: Array.isArray(item.selected_modifiers) ? item.selected_modifiers : [],
      })),
    };
  }

  /**
   * 3. Authoritative Order State Machine Transition
   */
  async updateOrderStatus(
    tenantContext: TenantContextDto,
    orderId: string,
    dto: UpdateOrderStatusRequestDto
  ): Promise<StaffOrderTransitionResponseDto> {
    const targetStatus = dto.status;
    if (!targetStatus) {
      throw new BadRequestException('Target order status is required');
    }

    const txResult = await this.db.transaction(async (client) => {
      // 1. Lock Order Row to prevent concurrent conflicting state transitions
      const lockRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        status: OrderLifecycleStatus;
        service_mode: 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID';
        chef_eta_minutes: number | null;
      }>(
        `SELECT o.id, o.tenant_id, o.location_id, o.status, loc.service_mode, o.chef_eta_minutes
         FROM orders o
         JOIN locations loc ON loc.id = o.location_id
         WHERE o.id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (lockRes.rows.length === 0) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
      const currentOrder = lockRes.rows[0];

      // Enforce Tenant Isolation
      if (currentOrder.tenant_id !== tenantContext.tenantId && tenantContext.actorType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Cross-tenant order modification denied');
      }

      // Enforce Location Scope
      if (tenantContext.actorType !== 'PLATFORM_ADMIN') {
        await this.resolveStaffLocationId(tenantContext, currentOrder.location_id);
      }

      const currentStatus = currentOrder.status;

      // Check if already in target state (Idempotent success)
      if (currentStatus === targetStatus) {
        return {
          fromStatus: currentStatus,
          occurredAt: new Date(),
          eventNotes: dto.notes || 'Idempotent status confirmation',
        };
      }

      // 2. Validate Allowed Lifecycle Transitions
      const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedTargets.includes(targetStatus)) {
        throw new BadRequestException(
          `Invalid status transition: Cannot transition order from ${currentStatus} to ${targetStatus}`
        );
      }

      // 3. Self-Service vs Table-Service transition rules (D6)
      if (currentStatus === 'READY' && targetStatus === 'COMPLETED') {
        if (currentOrder.service_mode === 'TABLE_SERVICE') {
          // Table service requires waiter delivery: READY -> SERVED -> COMPLETED
          throw new BadRequestException(
            'Table-service outlets require orders to be marked SERVED by waiter before COMPLETED'
          );
        }
      }

      // 4. Validate RBAC Permissions for this specific transition
      if (targetStatus === 'ACCEPTED') {
        if (!this.hasPermission(tenantContext, 'orders.accept') && !this.hasPermission(tenantContext, 'kitchen.accept')) {
          throw new ForbiddenException('Missing permission to accept kitchen orders');
        }
      } else if (targetStatus === 'REJECTED') {
        if (!this.hasPermission(tenantContext, 'orders.cancel') && !this.hasPermission(tenantContext, 'orders.accept')) {
          throw new ForbiddenException('Missing permission to reject orders');
        }
        if (!dto.rejectionReason || dto.rejectionReason.trim().length < 3) {
          throw new BadRequestException('A valid rejection reason (minimum 3 characters) is required to reject an order');
        }
      } else if (targetStatus === 'CANCELLED') {
        if (!this.hasPermission(tenantContext, 'orders.cancel')) {
          throw new ForbiddenException('Missing permission to cancel orders');
        }
        if (!dto.cancellationReason || dto.cancellationReason.trim().length < 3) {
          throw new BadRequestException('A valid cancellation reason (minimum 3 characters) is required to cancel an order');
        }
      } else if (targetStatus === 'PREPARING') {
        if (!this.hasPermission(tenantContext, 'orders.update_status') && !this.hasPermission(tenantContext, 'kitchen.view')) {
          throw new ForbiddenException('Missing permission to start preparing kitchen order');
        }
      } else if (targetStatus === 'READY') {
        if (!this.hasPermission(tenantContext, 'kitchen.mark_ready') && !this.hasPermission(tenantContext, 'orders.update_status')) {
          throw new ForbiddenException('Missing permission to mark kitchen order ready');
        }
      } else if (targetStatus === 'SERVED') {
        if (!this.hasPermission(tenantContext, 'waiter.serve') && !this.hasPermission(tenantContext, 'orders.update_status')) {
          throw new ForbiddenException('Missing permission to mark order served');
        }
      } else if (targetStatus === 'COMPLETED') {
        if (!this.hasPermission(tenantContext, 'orders.complete') && !this.hasPermission(tenantContext, 'orders.update_status')) {
          throw new ForbiddenException('Missing permission to complete order');
        }
      }

      // 5. Update Order State
      const updateParams = [
        targetStatus,
        dto.rejectionReason || null,
        dto.cancellationReason || null,
        dto.chefEtaMinutes !== undefined ? dto.chefEtaMinutes : null,
        orderId,
      ];

      await client.query(
        `UPDATE orders
         SET status = $1::varchar,
             rejection_reason = COALESCE($2::text, rejection_reason),
             cancellation_reason = COALESCE($3::text, cancellation_reason),
             chef_eta_minutes = COALESCE($4::int, chef_eta_minutes),
             served_at = CASE WHEN $1::varchar = 'SERVED' OR ($1::varchar = 'COMPLETED' AND served_at IS NULL) THEN now() ELSE served_at END,
             updated_at = now()
         WHERE id = $5::uuid`,
        updateParams
      );

      // 6. Record Immutable Audit Event
      const eventNotes = dto.notes || (targetStatus === 'REJECTED' ? dto.rejectionReason : targetStatus === 'CANCELLED' ? dto.cancellationReason : undefined);
      const eventRes = await client.query<{
        id: string;
        occurred_at: Date;
      }>(
        `INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, notes)
         VALUES ($1::uuid, $2::varchar, $3::varchar, $4::varchar, $5::uuid, $6::text)
         RETURNING id, occurred_at`,
        [
          orderId,
          currentStatus,
          targetStatus,
          tenantContext.actorType,
          tenantContext.actorId || null,
          eventNotes || null,
        ]
      );

      // 7. Write Notification Outbox Event Atomically
      await client.query(
        `INSERT INTO notification_outbox (tenant_id, location_id, event_type, payload)
         VALUES ($1, $2, 'ORDER_STATUS_CHANGED', $3)`,
        [
          currentOrder.tenant_id,
          currentOrder.location_id,
          JSON.stringify({
            orderId,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            actorType: tenantContext.actorType,
            actorId: tenantContext.actorId,
            occurredAt: eventRes.rows[0].occurred_at,
          }),
        ]
      );

      return {
        fromStatus: currentStatus,
        occurredAt: eventRes.rows[0].occurred_at,
        eventNotes,
      };
    });

    const updatedOrder = await this.getStaffOrderById(tenantContext, orderId);
    return {
      order: updatedOrder,
      event: {
        fromStatus: txResult.fromStatus,
        toStatus: targetStatus,
        actorType: tenantContext.actorType,
        actorId: tenantContext.actorId,
        occurredAt: new Date(txResult.occurredAt).toISOString(),
        notes: txResult.eventNotes,
      },
    };
  }

  /**
   * 4. Chef ETA Setting and Updates (D4)
   */
  async setChefEta(
    tenantContext: TenantContextDto,
    orderId: string,
    dto: SetChefEtaRequestDto
  ): Promise<StaffOrderDto> {
    if (!this.hasPermission(tenantContext, 'kitchen.set_eta') && !this.hasPermission(tenantContext, 'orders.update_status')) {
      throw new ForbiddenException('Missing permission to set or update chef ETA');
    }

    const eta = Number(dto.chefEtaMinutes);
    if (!Number.isInteger(eta) || eta < 1 || eta > 180) {
      throw new BadRequestException('Chef ETA must be an integer between 1 and 180 minutes');
    }

    await this.db.transaction(async (client) => {
      const lock = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        status: OrderLifecycleStatus;
        chef_eta_minutes: number | null;
      }>(
        `SELECT id, tenant_id, location_id, status, chef_eta_minutes
         FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (lock.rows.length === 0) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
      const order = lock.rows[0];

      if (order.tenant_id !== tenantContext.tenantId && tenantContext.actorType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Cross-tenant order access denied');
      }

      // Cannot set ETA on completed or terminal orders
      if (['COMPLETED', 'REJECTED', 'CANCELLED', 'SERVED'].includes(order.status)) {
        throw new BadRequestException(`Cannot set ETA on an order with status ${order.status}`);
      }

      // Update ETA
      await client.query(
        `UPDATE orders
         SET chef_eta_minutes = $1::int,
             eta_updated_at = now(),
             eta_set_by = $2::uuid,
             updated_at = now()
         WHERE id = $3::uuid`,
        [eta, tenantContext.actorId || null, orderId]
      );

      // Audit status event for ETA update
      await client.query(
        `INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, notes)
         VALUES ($1::uuid, $2::varchar, $2::varchar, $3::varchar, $4::uuid, $5::text)`,
        [
          orderId,
          order.status,
          tenantContext.actorType,
          tenantContext.actorId || null,
          `Chef updated ETA to ${eta} minutes${dto.notes ? `: ${dto.notes}` : ''}`,
        ]
      );

      // Outbox notification
      await client.query(
        `INSERT INTO notification_outbox (tenant_id, location_id, event_type, payload)
         VALUES ($1, $2, 'CHEF_ETA_UPDATED', $3)`,
        [
          order.tenant_id,
          order.location_id,
          JSON.stringify({
            orderId,
            chefEtaMinutes: eta,
            updatedBy: tenantContext.actorId,
          }),
        ]
      );
    });

    return this.getStaffOrderById(tenantContext, orderId);
  }

  /**
   * 5. Waiter Pickup Workflow (D5)
   */
  async pickupOrder(
    tenantContext: TenantContextDto,
    orderId: string
  ): Promise<StaffOrderDto> {
    if (!this.hasPermission(tenantContext, 'waiter.serve') && !this.hasPermission(tenantContext, 'orders.update_status')) {
      throw new ForbiddenException('Missing permission to perform waiter order pickup');
    }

    await this.db.transaction(async (client) => {
      const lock = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        status: OrderLifecycleStatus;
      }>(
        `SELECT id, tenant_id, location_id, status FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (lock.rows.length === 0) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }
      const order = lock.rows[0];

      if (order.tenant_id !== tenantContext.tenantId && tenantContext.actorType !== 'PLATFORM_ADMIN') {
        throw new ForbiddenException('Cross-tenant order access denied');
      }

      if (order.status !== 'READY') {
        throw new BadRequestException(`Only orders with status READY can be picked up. Current status is ${order.status}`);
      }

      await client.query(
        `UPDATE orders
         SET waiter_id = $1::uuid,
             picked_up_at = now(),
             updated_at = now()
         WHERE id = $2::uuid`,
        [tenantContext.actorId || null, orderId]
      );

      await client.query(
        `INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, actor_id, notes)
         VALUES ($1::uuid, 'READY', 'READY', $2::varchar, $3::uuid, 'Order picked up by waiter for delivery to table')`,
        [orderId, tenantContext.actorType, tenantContext.actorId || null]
      );
    });

    return this.getStaffOrderById(tenantContext, orderId);
  }

  /**
   * 6. Mark Order Served / Collected (D5 & D6)
   */
  async serveOrder(
    tenantContext: TenantContextDto,
    orderId: string,
    notes?: string
  ): Promise<StaffOrderTransitionResponseDto> {
    const order = await this.getStaffOrderById(tenantContext, orderId);

    // If counter service, transition directly to COMPLETED or SERVED
    const targetStatus: OrderLifecycleStatus =
      order.serviceMode === 'COUNTER_SERVICE' ? 'COMPLETED' : 'SERVED';

    return this.updateOrderStatus(tenantContext, orderId, {
      status: targetStatus,
      notes: notes || (order.serviceMode === 'COUNTER_SERVICE' ? 'Self-service customer collected order' : 'Waiter served order to table'),
    });
  }
}
