import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type {
  ResolveQrResponseDto,
  PublicMenuResponseDto,
  CreateCustomerOrderRequestDto,
  CustomerOrderResponseDto,
  TableSessionOrdersSummaryDto,
  MenuCategoryDto,
  MenuItemDto,
  ModifierGroupDto,
} from '@restaurant-saas/contracts';
import crypto from 'node:crypto';

@Injectable()
export class CustomerService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * 1. Secure QR Token Resolution
   * SEC-QR-02: Enforces authoritative checks on table_status, location_status, tenant_status, qr_status, and expiry.
   * SEC-CONC-01: Concurrency-safe table session creation/recovery.
   */
  async resolveQrToken(rawToken: string): Promise<ResolveQrResponseDto> {
    if (!rawToken || rawToken.trim() === '') {
      throw new BadRequestException('QR token is required');
    }

    const tokenRes = await this.db.query<{
      qr_id: string;
      qr_status: string;
      expires_at: Date | null;
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
      tenant_status: string;
      tax_rate_percent: string | number | null;
      location_id: string;
      location_name: string;
      location_status: string;
      table_id: string;
      table_code: string;
      table_label: string;
      table_status: string;
    }>(
      `SELECT qt.id as qr_id, qt.status as qr_status, qt.expires_at,
              t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, t.status as tenant_status,
              t.tax_rate_percent as tax_rate_percent,
              l.id as location_id, l.name as location_name, l.status as location_status,
              rt.id as table_id, rt.table_code, rt.label as table_label, rt.status as table_status
       FROM qr_tokens qt
       JOIN restaurant_tables rt ON rt.id = qt.table_id
       JOIN locations l ON l.id = qt.location_id
       JOIN tenants t ON t.id = qt.tenant_id
       WHERE qt.raw_token = $1`,
      [rawToken.trim()]
    );

    if (tokenRes.rows.length === 0) {
      throw new NotFoundException('Invalid QR code. Table could not be found.');
    }

    const row = tokenRes.rows[0];

    // Check QR token validity
    if (row.qr_status !== 'ACTIVE') {
      throw new ForbiddenException(`QR code is ${row.qr_status.toLowerCase()}. Please ask staff for assistance.`);
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      throw new ForbiddenException('QR code has expired. Please ask staff for an updated QR.');
    }

    // SEC-QR-02: Check tenant status
    if (row.tenant_status !== 'ACTIVE') {
      throw new ForbiddenException('Restaurant is currently inactive.');
    }

    // SEC-QR-02: Check location status
    if (row.location_status !== 'ACTIVE') {
      throw new ForbiddenException('Restaurant branch is currently not accepting orders.');
    }

    // SEC-QR-02: Check table status
    if (row.table_status === 'OUT_OF_SERVICE' || row.table_status === 'INACTIVE') {
      throw new ForbiddenException(
        `Table is currently ${row.table_status.toLowerCase().replace('_', ' ')}. Please ask staff for seating assistance.`
      );
    }

    // Resolve or create an active table session (concurrency-safe)
    let session = await this.getActiveTableSession(row.table_id);
    if (!session) {
      session = await this.createTableSession(row.tenant_id, row.location_id, row.table_id);
    }

    return {
      tenantId: row.tenant_id,
      tenantSlug: row.tenant_slug,
      tenantName: row.tenant_name,
      locationId: row.location_id,
      locationName: row.location_name,
      tableId: row.table_id,
      tableCode: row.table_code,
      tableLabel: row.table_label,
      tableSessionId: session.id,
      sessionToken: session.sessionToken,
      currency: 'INR',
      taxRatePercent:
        row.tax_rate_percent !== null && row.tax_rate_percent !== undefined
          ? Number(row.tax_rate_percent)
          : null,
    };
  }

  /**
   * 2. Published Customer Menu
   * BUS-TAX-01: Retrieves authoritative tax_rate_percent from database.
   */
  async getPublicMenu(tenantSlug: string): Promise<PublicMenuResponseDto> {
    const tenantRes = await this.db.query<{
      id: string;
      name: string;
      slug: string;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT id, name, slug, tax_rate_percent
       FROM tenants WHERE LOWER(slug) = $1 AND status = 'ACTIVE'`,
      [tenantSlug.toLowerCase().trim()]
    );

    if (tenantRes.rows.length === 0) {
      throw new NotFoundException(`Restaurant '${tenantSlug}' not found`);
    }
    const tenant = tenantRes.rows[0];

    // Categories
    const catRes = await this.db.query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
    }>(
      `SELECT id, name, slug, description
       FROM menu_categories
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY display_order ASC, name ASC`,
      [tenant.id]
    );

    // Items
    const itemsRes = await this.db.query<{
      id: string;
      category_id: string;
      name: string;
      description: string | null;
      base_price_minor: number;
      currency: string;
      image_url: string | null;
      is_available: boolean;
      is_vegetarian: boolean;
      preparation_time_minutes: number;
    }>(
      `SELECT id, category_id, name, description, base_price_minor, currency, image_url,
              is_available, is_vegetarian, preparation_time_minutes
       FROM menu_items
       WHERE tenant_id = $1 AND is_available = true
       ORDER BY display_order ASC, name ASC`,
      [tenant.id]
    );

    // Modifiers
    const modsRes = await this.db.query<{
      item_id: string;
      group_id: string;
      group_name: string;
      min_selection: number;
      max_selection: number;
      is_required: boolean;
      mod_id: string;
      mod_name: string;
      price_minor: number;
      is_available: boolean;
    }>(
      `SELECT img.item_id, mg.id as group_id, mg.name as group_name,
              mg.min_selection, mg.max_selection, mg.is_required,
              m.id as mod_id, m.name as mod_name, m.price_minor, m.is_available
       FROM item_modifier_groups img
       JOIN modifier_groups mg ON mg.id = img.group_id
       JOIN item_modifiers m ON m.group_id = mg.id
       WHERE mg.tenant_id = $1 AND m.is_available = true
       ORDER BY m.display_order ASC`,
      [tenant.id]
    );

    // Build Modifier map by item_id
    const itemModifiersMap = new Map<string, ModifierGroupDto[]>();
    for (const row of modsRes.rows) {
      let groups = itemModifiersMap.get(row.item_id);
      if (!groups) {
        groups = [];
        itemModifiersMap.set(row.item_id, groups);
      }

      let group = groups.find((g) => g.id === row.group_id);
      if (!group) {
        group = {
          id: row.group_id,
          name: row.group_name,
          minSelection: row.min_selection,
          maxSelection: row.max_selection,
          isRequired: row.is_required,
          modifiers: [],
        };
        groups.push(group);
      }

      group.modifiers.push({
        id: row.mod_id,
        name: row.mod_name,
        priceMinor: row.price_minor,
        isAvailable: row.is_available,
      });
    }

    // Build categories with nested items
    const categories: MenuCategoryDto[] = catRes.rows.map((cat) => {
      const catItems = itemsRes.rows
        .filter((item) => item.category_id === cat.id)
        .map((item) => ({
          id: item.id,
          categoryId: item.category_id,
          name: item.name,
          description: item.description || undefined,
          basePriceMinor: item.base_price_minor,
          currency: item.currency,
          imageUrl: item.image_url || undefined,
          isAvailable: item.is_available,
          isVegetarian: item.is_vegetarian,
          prepTimeMinutes: item.preparation_time_minutes,
          modifierGroups: itemModifiersMap.get(item.id) || [],
        }));

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || undefined,
        items: catItems,
      };
    });

    return {
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      locationName: 'Dine-in Menu',
      currency: 'INR',
      taxRatePercent: tenant.tax_rate_percent !== null && tenant.tax_rate_percent !== undefined ? Number(tenant.tax_rate_percent) : null,
      categories,
    };
  }

  /**
   * 3. Cart Submission with Server-Side Price Recalculation, Modifier Cardinality & Idempotency
   * SEC-VAL-01: Full server-side modifier group validation.
   * BUS-TAX-01: Dynamic tax percentage calculation.
   */
  async createCustomerOrder(dto: CreateCustomerOrderRequestDto): Promise<CustomerOrderResponseDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }
    if (!dto.idempotencyKey || dto.idempotencyKey.trim() === '') {
      throw new BadRequestException('Idempotency key is required to prevent duplicate submissions');
    }

    // 1. Resolve Table Session & Authoritative Tenant Tax
    const sessionRes = await this.db.query<{
      id: string;
      tenant_id: string;
      location_id: string;
      table_id: string;
      table_code: string;
      table_label: string;
      session_status: string;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT ts.id, ts.tenant_id, ts.location_id, ts.table_id,
              rt.table_code, rt.label as table_label, ts.status as session_status,
              t.tax_rate_percent as tax_rate_percent
       FROM table_sessions ts
       JOIN restaurant_tables rt ON rt.id = ts.table_id
       JOIN tenants t ON t.id = ts.tenant_id
       WHERE ts.session_token = $1`,
      [dto.sessionToken.trim()]
    );

    if (sessionRes.rows.length === 0) {
      throw new NotFoundException('Invalid or expired table session. Please re-scan table QR.');
    }
    const session = sessionRes.rows[0];

    if (session.session_status !== 'OPEN') {
      throw new ForbiddenException(`Table session is ${session.session_status.toLowerCase()}. Cannot submit new orders.`);
    }

    // 2. Idempotency Check: if order already created with this idempotency key, return existing
    const existingOrder = await this.db.query<{ id: string }>(
      `SELECT id FROM orders WHERE tenant_id = $1 AND idempotency_key = $2`,
      [session.tenant_id, dto.idempotencyKey.trim()]
    );
    if (existingOrder.rows.length > 0) {
      return this.getOrderByIdInternal(existingOrder.rows[0].id);
    }

    // 3. Recalculate Prices on Server (ZERO trust of browser values)
    let calculatedSubtotalMinor = 0;
    const resolvedOrderItems: Array<{
      itemId: string;
      itemNameSnapshot: string;
      unitPriceMinor: number;
      quantity: number;
      subtotalMinor: number;
      notes?: string;
      selectedModifiers: Array<{ id: string; name: string; priceMinor: number }>;
    }> = [];

    for (const submittedItem of dto.items) {
      if (submittedItem.quantity <= 0) {
        throw new BadRequestException('Item quantity must be greater than zero');
      }

      // Fetch authoritative item from DB
      const itemRes = await this.db.query<{
        id: string;
        name: string;
        base_price_minor: number;
        is_available: boolean;
        tenant_id: string;
      }>(
        `SELECT id, name, base_price_minor, is_available, tenant_id
         FROM menu_items WHERE id = $1`,
        [submittedItem.itemId]
      );

      if (itemRes.rows.length === 0) {
        throw new NotFoundException(`Menu item ${submittedItem.itemId} not found`);
      }
      const dbItem = itemRes.rows[0];

      if (dbItem.tenant_id !== session.tenant_id) {
        throw new ForbiddenException('Cross-tenant item submission is strictly rejected');
      }
      if (!dbItem.is_available) {
        throw new BadRequestException(`Item '${dbItem.name}' is currently unavailable`);
      }

      // SEC-VAL-01: Reject duplicate modifier IDs
      const submittedModIds = submittedItem.modifierIds || [];
      const uniqueModIds = new Set(submittedModIds);
      if (uniqueModIds.size !== submittedModIds.length) {
        throw new BadRequestException(`Duplicate modifiers submitted for item '${dbItem.name}'`);
      }

      // SEC-VAL-01: Fetch authoritative modifier groups configured for this item
      const itemGroupsRes = await this.db.query<{
        group_id: string;
        group_name: string;
        min_selection: number;
        max_selection: number;
        is_required: boolean;
      }>(
        `SELECT mg.id as group_id, mg.name as group_name, mg.min_selection, mg.max_selection, mg.is_required
         FROM modifier_groups mg
         JOIN item_modifier_groups img ON img.group_id = mg.id
         WHERE img.item_id = $1 AND mg.tenant_id = $2`,
        [dbItem.id, session.tenant_id]
      );

      let itemUnitPriceMinor = dbItem.base_price_minor;
      const selectedModsList: Array<{ id: string; name: string; priceMinor: number }> = [];
      const validatedModIds = new Set<string>();

      // SEC-VAL-01: Enforce group cardinality and requirements
      for (const group of itemGroupsRes.rows) {
        const groupModsRes = await this.db.query<{
          id: string;
          name: string;
          price_minor: number;
          is_available: boolean;
        }>(
          `SELECT id, name, price_minor, is_available
           FROM item_modifiers
           WHERE group_id = $1 AND id = ANY($2::uuid[])`,
          [group.group_id, submittedModIds.length > 0 ? submittedModIds : ['00000000-0000-0000-0000-000000000000']]
        );

        const selectedInGroup = groupModsRes.rows;
        for (const mod of selectedInGroup) {
          if (!mod.is_available) {
            throw new BadRequestException(`Modifier '${mod.name}' is currently unavailable`);
          }
          validatedModIds.add(mod.id);
          itemUnitPriceMinor += mod.price_minor;
          selectedModsList.push({
            id: mod.id,
            name: mod.name,
            priceMinor: mod.price_minor,
          });
        }

        // Validate group min/required
        if (group.is_required && selectedInGroup.length < Math.max(1, group.min_selection)) {
          throw new BadRequestException(
            `Modifier group '${group.group_name}' is required for item '${dbItem.name}'. Please select at least ${Math.max(1, group.min_selection)} option(s).`
          );
        }
        if (selectedInGroup.length < group.min_selection) {
          throw new BadRequestException(
            `Modifier group '${group.group_name}' requires minimum ${group.min_selection} selection(s) for item '${dbItem.name}'.`
          );
        }
        // Validate group max
        if (group.max_selection > 0 && selectedInGroup.length > group.max_selection) {
          throw new BadRequestException(
            `Modifier group '${group.group_name}' allows maximum ${group.max_selection} selection(s) for item '${dbItem.name}'.`
          );
        }
      }

      // Check if any submitted modifier was invalid/unmapped to this item
      for (const modId of submittedModIds) {
        if (!validatedModIds.has(modId)) {
          throw new BadRequestException(`Invalid modifier ${modId} for item '${dbItem.name}'`);
        }
      }

      const itemSubtotalMinor = itemUnitPriceMinor * submittedItem.quantity;
      calculatedSubtotalMinor += itemSubtotalMinor;

      resolvedOrderItems.push({
        itemId: dbItem.id,
        itemNameSnapshot: dbItem.name,
        unitPriceMinor: itemUnitPriceMinor,
        quantity: submittedItem.quantity,
        subtotalMinor: itemSubtotalMinor,
        notes: submittedItem.notes,
        selectedModifiers: selectedModsList,
      });
    }

    // BUS-TAX-01: Explicit tax calculation (No implicit default; NULL = unconfigured = 0 tax)
    const taxRatePercent = session.tax_rate_percent !== null && session.tax_rate_percent !== undefined
      ? Number(session.tax_rate_percent)
      : null;
    const calculatedTaxMinor = taxRatePercent !== null
      ? Math.round(calculatedSubtotalMinor * (taxRatePercent / 100))
      : 0;
    const calculatedTotalMinor = calculatedSubtotalMinor + calculatedTaxMinor;

    // 4. Atomic Transaction: Order Header + Order Items + Status Event + Outbox Event
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    try {
      const orderId = await this.db.transaction(async (client) => {
        // Insert Order Header
        const orderInsert = await client.query<{ id: string }>(
          `INSERT INTO orders (
              tenant_id, location_id, table_session_id, table_id, order_number,
              status, currency, subtotal_minor, tax_minor, discount_minor, total_minor,
              idempotency_key, source_channel, fulfilment_type, special_instructions
           ) VALUES ($1, $2, $3, $4, $5, 'PLACED', 'INR', $6, $7, 0, $8, $9, 'QR_DINE_IN', 'DINE_IN', $10)
           RETURNING id`,
          [
            session.tenant_id,
            session.location_id,
            session.id,
            session.table_id,
            orderNumber,
            calculatedSubtotalMinor,
            calculatedTaxMinor,
            calculatedTotalMinor,
            dto.idempotencyKey.trim(),
            dto.specialInstructions || null,
          ]
        );
        const newOrderId = orderInsert.rows[0].id;

        // Insert Order Items
        for (const item of resolvedOrderItems) {
          await client.query(
            `INSERT INTO order_items (
                order_id, item_id, item_name_snapshot, unit_price_minor,
                quantity, subtotal_minor, notes, selected_modifiers
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              newOrderId,
              item.itemId,
              item.itemNameSnapshot,
              item.unitPriceMinor,
              item.quantity,
              item.subtotalMinor,
              item.notes || null,
              JSON.stringify(item.selectedModifiers),
            ]
          );
        }

        // Insert Initial Status Event
        await client.query(
          `INSERT INTO order_status_events (order_id, from_status, to_status, actor_type, notes)
           VALUES ($1, NULL, 'PLACED', 'CUSTOMER_GUEST', 'Order placed from table QR')`,
          [newOrderId]
        );

        // Insert Notification Outbox
        await client.query(
          `INSERT INTO notification_outbox (tenant_id, location_id, event_type, payload)
           VALUES ($1, $2, 'ORDER_PLACED', $3)`,
          [
            session.tenant_id,
            session.location_id,
            JSON.stringify({
              orderId: newOrderId,
              orderNumber,
              tableCode: session.table_code,
              totalMinor: calculatedTotalMinor,
            }),
          ]
        );

        return newOrderId;
      });

      return this.getOrderByIdInternal(orderId);
    } catch (err: any) {
      // SEC-IDEMP-01: If duplicate concurrent request hit unique idempotency constraint, return existing order
      if (err.code === '23505' && (err.message?.includes('uq_order_idempotency') || err.constraint === 'uq_order_idempotency')) {
        const existing = await this.db.query<{ id: string }>(
          `SELECT id FROM orders WHERE tenant_id = $1 AND idempotency_key = $2`,
          [session.tenant_id, dto.idempotencyKey.trim()]
        );
        if (existing.rows.length > 0) {
          return this.getOrderByIdInternal(existing.rows[0].id);
        }
      }
      throw err;
    }
  }

  /**
   * 4. Retrieve Customer Order by ID (SEC-AUTH-01: Session Credential Enforced)
   */
  async getOrderForSession(orderId: string, sessionToken: string): Promise<CustomerOrderResponseDto> {
    if (!sessionToken || sessionToken.trim() === '') {
      throw new UnauthorizedException('Valid table session credential is required');
    }

    // Authorize caller by checking session existence, status, and tenant status
    const sessionRes = await this.db.query<{
      id: string;
      tenant_id: string;
      session_status: string;
      tenant_status: string;
    }>(
      `SELECT ts.id, ts.tenant_id, ts.status as session_status, t.status as tenant_status
       FROM table_sessions ts
       JOIN tenants t ON t.id = ts.tenant_id
       WHERE ts.session_token = $1`,
      [sessionToken.trim()]
    );

    if (sessionRes.rows.length === 0) {
      throw new ForbiddenException('Invalid or expired table session credential');
    }
    const session = sessionRes.rows[0];

    if (session.session_status !== 'OPEN') {
      throw new ForbiddenException('Table session is closed');
    }
    if (session.tenant_status !== 'ACTIVE') {
      throw new ForbiddenException('Restaurant is currently inactive');
    }

    // Fetch order strictly scoped to the caller's session
    const orderRes = await this.db.query<{
      id: string;
      order_number: string;
      table_session_id: string;
      table_code: string;
      table_label: string;
      status: any;
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      discount_minor: number;
      total_minor: number;
      chef_eta_minutes: number | null;
      rejection_reason: string | null;
      cancellation_reason: string | null;
      special_instructions: string | null;
      created_at: Date;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT o.id, o.order_number, o.table_session_id, rt.table_code, rt.label as table_label,
              o.status, o.currency, o.subtotal_minor, o.tax_minor, o.discount_minor, o.total_minor,
              o.chef_eta_minutes, o.rejection_reason, o.cancellation_reason, o.special_instructions, o.created_at,
              t.tax_rate_percent as tax_rate_percent
       FROM orders o
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.id = $1 AND o.table_session_id = $2`,
      [orderId, session.id]
    );

    if (orderRes.rows.length === 0) {
      throw new NotFoundException('Order not found or does not belong to your table session');
    }
    const o = orderRes.rows[0];

    // Fetch Items
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

    return {
      orderId: o.id,
      orderNumber: o.order_number,
      tableSessionId: o.table_session_id,
      tableCode: o.table_code || 'T-DINE',
      tableLabel: o.table_label || 'Dine-in Table',
      status: o.status,
      currency: o.currency,
      subtotalMinor: o.subtotal_minor,
      taxMinor: o.tax_minor,
      taxRatePercent: o.tax_rate_percent !== null && o.tax_rate_percent !== undefined ? Number(o.tax_rate_percent) : null,
      discountMinor: o.discount_minor,
      totalMinor: o.total_minor,
      chefEtaMinutes: o.chef_eta_minutes || undefined,
      rejectionReason: o.rejection_reason || undefined,
      cancellationReason: o.cancellation_reason || undefined,
      specialInstructions: o.special_instructions || undefined,
      createdAt: new Date(o.created_at).toISOString(),
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
   * Internal lookup without credential check (used inside service boundaries only)
   */
  async getOrderByIdInternal(orderId: string): Promise<CustomerOrderResponseDto> {
    const orderRes = await this.db.query<{
      id: string;
      order_number: string;
      table_session_id: string;
      table_code: string;
      table_label: string;
      status: any;
      currency: string;
      subtotal_minor: number;
      tax_minor: number;
      discount_minor: number;
      total_minor: number;
      chef_eta_minutes: number | null;
      rejection_reason: string | null;
      cancellation_reason: string | null;
      special_instructions: string | null;
      created_at: Date;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT o.id, o.order_number, o.table_session_id, rt.table_code, rt.label as table_label,
              o.status, o.currency, o.subtotal_minor, o.tax_minor, o.discount_minor, o.total_minor,
              o.chef_eta_minutes, o.rejection_reason, o.cancellation_reason, o.special_instructions, o.created_at,
              t.tax_rate_percent as tax_rate_percent
       FROM orders o
       LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
       JOIN tenants t ON t.id = o.tenant_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new NotFoundException('Order not found');
    }
    const o = orderRes.rows[0];

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

    return {
      orderId: o.id,
      orderNumber: o.order_number,
      tableSessionId: o.table_session_id,
      tableCode: o.table_code || 'T-DINE',
      tableLabel: o.table_label || 'Dine-in Table',
      status: o.status,
      currency: o.currency,
      subtotalMinor: o.subtotal_minor,
      taxMinor: o.tax_minor,
      taxRatePercent: o.tax_rate_percent !== null && o.tax_rate_percent !== undefined ? Number(o.tax_rate_percent) : null,
      discountMinor: o.discount_minor,
      totalMinor: o.total_minor,
      chefEtaMinutes: o.chef_eta_minutes || undefined,
      rejectionReason: o.rejection_reason || undefined,
      cancellationReason: o.cancellation_reason || undefined,
      specialInstructions: o.special_instructions || undefined,
      createdAt: new Date(o.created_at).toISOString(),
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
   * 5. Retrieve all Orders in Active Table Session (ADR-003: Groups multiple orders)
   */
  async getTableSessionOrders(sessionToken: string): Promise<TableSessionOrdersSummaryDto> {
    const sessionRes = await this.db.query<{
      id: string;
      status: any;
      table_code: string;
      table_label: string;
      tax_rate_percent: string | number | null;
    }>(
      `SELECT ts.id, ts.status, rt.table_code, rt.label as table_label,
              t.tax_rate_percent as tax_rate_percent
       FROM table_sessions ts
       JOIN restaurant_tables rt ON rt.id = ts.table_id
       JOIN tenants t ON t.id = ts.tenant_id
       WHERE ts.session_token = $1`,
      [sessionToken.trim()]
    );

    if (sessionRes.rows.length === 0) {
      throw new NotFoundException('Table session not found');
    }
    const session = sessionRes.rows[0];

    const ordersRes = await this.db.query<{ id: string }>(
      `SELECT id FROM orders WHERE table_session_id = $1 ORDER BY created_at ASC`,
      [session.id]
    );

    const orders: CustomerOrderResponseDto[] = [];
    let consolidatedSubtotal = 0;
    let consolidatedTax = 0;
    let consolidatedTotal = 0;

    for (const row of ordersRes.rows) {
      const order = await this.getOrderByIdInternal(row.id);
      orders.push(order);
      consolidatedSubtotal += order.subtotalMinor;
      consolidatedTax += order.taxMinor;
      consolidatedTotal += order.totalMinor;
    }

    return {
      tableSessionId: session.id,
      sessionStatus: session.status,
      tableCode: session.table_code,
      tableLabel: session.table_label,
      currency: 'INR',
      taxRatePercent: session.tax_rate_percent !== null && session.tax_rate_percent !== undefined ? Number(session.tax_rate_percent) : null,
      orders,
      consolidatedSubtotalMinor: consolidatedSubtotal,
      consolidatedTaxMinor: consolidatedTax,
      consolidatedTotalMinor: consolidatedTotal,
    };
  }

  // --- Internal Helpers ---
  private async getActiveTableSession(tableId: string) {
    const res = await this.db.query<{ id: string; session_token: string }>(
      `SELECT id, session_token FROM table_sessions WHERE table_id = $1 AND status = 'OPEN' LIMIT 1`,
      [tableId]
    );
    if (res.rows.length === 0) return null;
    return { id: res.rows[0].id, sessionToken: res.rows[0].session_token };
  }

  /**
   * SEC-CONC-01: Concurrency-safe session creation. Catches unique constraint conflict
   * and retrieves the winning active session if concurrent requests race.
   */
  private async createTableSession(tenantId: string, locationId: string, tableId: string) {
    const sessionToken = `sess_${crypto.randomBytes(16).toString('hex')}`;
    try {
      const res = await this.db.query<{ id: string; session_token: string }>(
        `INSERT INTO table_sessions (tenant_id, location_id, table_id, session_token, status)
         VALUES ($1, $2, $3, $4, 'OPEN')
         RETURNING id, session_token`,
        [tenantId, locationId, tableId, sessionToken]
      );
      return { id: res.rows[0].id, sessionToken: res.rows[0].session_token };
    } catch (err: any) {
      // If another concurrent request already created the active session (uq_single_active_table_session)
      if (err.code === '23505' || err.message?.includes('uq_single_active_table_session')) {
        const active = await this.getActiveTableSession(tableId);
        if (active) return active;
      }
      throw err;
    }
  }
}
