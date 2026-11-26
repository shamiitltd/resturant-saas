import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { DatabaseService } from '../../database/database.service.js';
import type {
  TenantContextDto,
  OwnerTableDto,
  OwnerTablesOverviewDto,
  CreateTableRequestDto,
  UpdateTableRequestDto,
  RotateTableQrResponseDto,
  RestaurantTableStatus,
  RestaurantTableType,
  TableQrTokenDto,
} from '@restaurant-saas/contracts';

const ALLOWED_TABLE_STATUSES: RestaurantTableStatus[] = [
  'AVAILABLE',
  'OCCUPIED',
  'RESERVED',
  'INACTIVE',
];

const ALLOWED_TABLE_TYPES: RestaurantTableType[] = [
  'STANDARD',
  'BOOTH',
  'OUTDOOR',
  'PRIVATE',
];

@Injectable()
export class TablesService {
  constructor(private readonly db: DatabaseService) {}

  private assertOwnerOrManager(tenantContext: TenantContextDto) {
    if (tenantContext.actorType === 'PLATFORM_ADMIN') return;
    const allowed =
      tenantContext.roleCodes.includes('OWNER') ||
      tenantContext.roleCodes.includes('RESTAURANT_OWNER') ||
      tenantContext.roleCodes.includes('MANAGER');
    if (!allowed) {
      throw new ForbiddenException('Only Owner or Manager can manage tables and QR codes');
    }
  }

  private async resolveLocationId(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<string> {
    if (
      tenantContext.actorType === 'PLATFORM_ADMIN' ||
      tenantContext.roleCodes.includes('OWNER') ||
      tenantContext.roleCodes.includes('RESTAURANT_OWNER')
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
      throw new ForbiddenException('No active branch/outlet assignment found for your profile');
    }
    return assignedLocs.rows[0].location_id;
  }

  private generateSecureQrToken(tableCode: string): { rawToken: string; tokenHash: string } {
    const cleanCode = tableCode
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 12);
    const randomPart = crypto.randomBytes(6).toString('hex');
    const rawToken = `tbl-${cleanCode || 'x'}-${randomPart}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  async listTables(
    tenantContext: TenantContextDto,
    requestedLocationId?: string
  ): Promise<OwnerTablesOverviewDto> {
    this.assertOwnerOrManager(tenantContext);
    const locationId = await this.resolveLocationId(tenantContext, requestedLocationId);

    const metaRes = await this.db.query<{
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
      location_id: string;
      location_name: string;
    }>(
      `SELECT t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name,
              l.id AS location_id, l.name AS location_name
       FROM locations l
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      [locationId, tenantContext.tenantId]
    );
    if (metaRes.rows.length === 0) {
      throw new NotFoundException('Branch/location not found');
    }
    const meta = metaRes.rows[0];

    const tablesRes = await this.db.query<{
      id: string;
      tenant_id: string;
      location_id: string;
      table_code: string;
      label: string;
      capacity: number;
      section: string;
      table_type: RestaurantTableType;
      status: RestaurantTableStatus;
      allow_qr_ordering: boolean;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, tenant_id, location_id, table_code, label, capacity,
              COALESCE(section, 'Main Hall') AS section,
              COALESCE(table_type, 'STANDARD') AS table_type,
              status,
              COALESCE(allow_qr_ordering, true) AS allow_qr_ordering,
              notes, created_at, updated_at
       FROM restaurant_tables
       WHERE tenant_id = $1 AND location_id = $2
       ORDER BY table_code ASC, created_at ASC`,
      [tenantContext.tenantId, locationId]
    );

    const tableIds = tablesRes.rows.map((r) => r.id);
    const qrByTable = new Map<string, TableQrTokenDto>();
    const sessionByTable = new Map<
      string,
      { id: string; status: string; openedAt: string; ordersCount: number }
    >();

    if (tableIds.length > 0) {
      const qrRes = await this.db.query<{
        id: string;
        table_id: string;
        raw_token: string;
        status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
        created_at: Date;
        rotated_at: Date | null;
        expires_at: Date | null;
      }>(
        `SELECT id, table_id, raw_token, status, created_at, rotated_at, expires_at
         FROM qr_tokens
         WHERE tenant_id = $1 AND table_id = ANY($2::uuid[]) AND status = 'ACTIVE'
         ORDER BY created_at DESC`,
        [tenantContext.tenantId, tableIds]
      );
      for (const qr of qrRes.rows) {
        if (!qrByTable.has(qr.table_id)) {
          qrByTable.set(qr.table_id, {
            id: qr.id,
            rawToken: qr.raw_token,
            status: qr.status,
            createdAt: new Date(qr.created_at).toISOString(),
            rotatedAt: qr.rotated_at ? new Date(qr.rotated_at).toISOString() : null,
            expiresAt: qr.expires_at ? new Date(qr.expires_at).toISOString() : null,
          });
        }
      }

      const sessRes = await this.db.query<{
        id: string;
        table_id: string;
        status: string;
        opened_at: Date;
        orders_count: string | number;
      }>(
        `SELECT ts.id, ts.table_id, ts.status, ts.opened_at,
                COUNT(o.id) FILTER (WHERE o.status NOT IN ('CANCELLED', 'REJECTED')) AS orders_count
         FROM table_sessions ts
         LEFT JOIN orders o ON o.table_session_id = ts.id
         WHERE ts.tenant_id = $1 AND ts.table_id = ANY($2::uuid[]) AND ts.status = 'OPEN'
         GROUP BY ts.id`,
        [tenantContext.tenantId, tableIds]
      );
      for (const s of sessRes.rows) {
        sessionByTable.set(s.table_id, {
          id: s.id,
          status: s.status,
          openedAt: new Date(s.opened_at).toISOString(),
          ordersCount: Number(s.orders_count || 0),
        });
      }
    }

    const tables: OwnerTableDto[] = tablesRes.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      locationId: row.location_id,
      locationName: meta.location_name,
      tableCode: row.table_code,
      label: row.label,
      capacity: Number(row.capacity),
      section: row.section,
      tableType: row.table_type,
      status: row.status,
      allowQrOrdering: Boolean(row.allow_qr_ordering),
      notes: row.notes,
      activeQrToken: qrByTable.get(row.id) || null,
      activeSession: sessionByTable.get(row.id) || null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    const summary = {
      total: tables.length,
      available: tables.filter((t) => t.status === 'AVAILABLE' && !t.activeSession).length,
      occupied: tables.filter((t) => t.status === 'OCCUPIED' || Boolean(t.activeSession)).length,
      reserved: tables.filter((t) => t.status === 'RESERVED').length,
      inactive: tables.filter((t) => t.status === 'INACTIVE').length,
    };

    return {
      tenantId: meta.tenant_id,
      tenantSlug: meta.tenant_slug,
      tenantName: meta.tenant_name,
      locationId: meta.location_id,
      locationName: meta.location_name,
      summary,
      tables,
    };
  }

  async createTable(
    tenantContext: TenantContextDto,
    dto: CreateTableRequestDto
  ): Promise<OwnerTableDto> {
    this.assertOwnerOrManager(tenantContext);
    const locationId = await this.resolveLocationId(tenantContext, dto.locationId);

    const tableCode = dto.tableCode?.trim().toUpperCase();
    const label = dto.label?.trim();
    if (!tableCode || tableCode.length > 32) {
      throw new BadRequestException('Valid tableCode (1-32 characters) is required');
    }
    if (!label || label.length > 64) {
      throw new BadRequestException('Valid display label (1-64 characters) is required');
    }
    const capacity = Number(dto.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 40) {
      throw new BadRequestException('Seating capacity must be an integer between 1 and 40');
    }

    const status: RestaurantTableStatus = dto.status || 'AVAILABLE';
    if (!ALLOWED_TABLE_STATUSES.includes(status)) {
      throw new BadRequestException(`Invalid table status: ${status}`);
    }
    const tableType: RestaurantTableType = dto.tableType || 'STANDARD';
    if (!ALLOWED_TABLE_TYPES.includes(tableType)) {
      throw new BadRequestException(`Invalid table type: ${tableType}`);
    }

    const section = dto.section?.trim() || 'Main Hall';
    const allowQrOrdering = dto.allowQrOrdering !== undefined ? Boolean(dto.allowQrOrdering) : true;
    const notes = dto.notes?.trim() || null;

    const { rawToken, tokenHash } = this.generateSecureQrToken(tableCode);

    const createdId = await this.db.transaction(async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM restaurant_tables
         WHERE tenant_id = $1 AND location_id = $2 AND UPPER(table_code) = $3`,
        [tenantContext.tenantId, locationId, tableCode]
      );
      if (existing.rows.length > 0) {
        throw new ConflictException(`Table code '${tableCode}' already exists at this branch`);
      }

      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO restaurant_tables (
           tenant_id, location_id, table_code, label, capacity,
           section, table_type, status, allow_qr_ordering, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          tenantContext.tenantId,
          locationId,
          tableCode,
          label,
          capacity,
          section,
          tableType,
          status,
          allowQrOrdering,
          notes,
        ]
      );
      const tableId = insertRes.rows[0].id;

      await client.query(
        `INSERT INTO qr_tokens (tenant_id, location_id, table_id, token_hash, raw_token, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
        [tenantContext.tenantId, locationId, tableId, tokenHash, rawToken]
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, 'TABLE_CREATED', 'restaurant_tables', $5, $6::jsonb)`,
        [
          tenantContext.tenantId,
          locationId,
          tenantContext.actorId,
          tenantContext.actorType,
          tableId,
          JSON.stringify({ tableCode, label, capacity, section, tableType, status }),
        ]
      );

      return tableId;
    });

    const overview = await this.listTables(tenantContext, locationId);
    const created = overview.tables.find((t) => t.id === createdId);
    if (!created) throw new NotFoundException('Created table not found');
    return created;
  }

  async updateTable(
    tenantContext: TenantContextDto,
    tableId: string,
    dto: UpdateTableRequestDto
  ): Promise<OwnerTableDto> {
    this.assertOwnerOrManager(tenantContext);

    const updatedLocationId = await this.db.transaction(async (client) => {
      const tableRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        table_code: string;
        label: string;
        capacity: number;
        section: string;
        table_type: RestaurantTableType;
        status: RestaurantTableStatus;
        allow_qr_ordering: boolean;
        notes: string | null;
      }>(
        `SELECT id, tenant_id, location_id, table_code, label, capacity,
                COALESCE(section, 'Main Hall') AS section,
                COALESCE(table_type, 'STANDARD') AS table_type,
                status,
                COALESCE(allow_qr_ordering, true) AS allow_qr_ordering,
                notes
         FROM restaurant_tables
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [tableId, tenantContext.tenantId]
      );

      if (tableRes.rows.length === 0) {
        throw new NotFoundException(`Table ${tableId} not found`);
      }

      const current = tableRes.rows[0];
      await this.resolveLocationId(tenantContext, current.location_id);

      const nextCode = dto.tableCode !== undefined ? dto.tableCode.trim().toUpperCase() : current.table_code;
      const nextLabel = dto.label !== undefined ? dto.label.trim() : current.label;
      const nextCapacity = dto.capacity !== undefined ? Number(dto.capacity) : Number(current.capacity);
      const nextSection = dto.section !== undefined ? dto.section.trim() || 'Main Hall' : current.section;
      const nextType = dto.tableType !== undefined ? dto.tableType : current.table_type;
      const nextStatus = dto.status !== undefined ? dto.status : current.status;
      const nextAllowQr =
        dto.allowQrOrdering !== undefined ? Boolean(dto.allowQrOrdering) : current.allow_qr_ordering;
      const nextNotes = dto.notes !== undefined ? (dto.notes ? dto.notes.trim() : null) : current.notes;

      if (!nextCode || nextCode.length > 32) {
        throw new BadRequestException('Valid tableCode (1-32 characters) is required');
      }
      if (!nextLabel || nextLabel.length > 64) {
        throw new BadRequestException('Valid display label (1-64 characters) is required');
      }
      if (!Number.isInteger(nextCapacity) || nextCapacity < 1 || nextCapacity > 40) {
        throw new BadRequestException('Seating capacity must be an integer between 1 and 40');
      }
      if (!ALLOWED_TABLE_STATUSES.includes(nextStatus)) {
        throw new BadRequestException(`Invalid table status: ${nextStatus}`);
      }
      if (!ALLOWED_TABLE_TYPES.includes(nextType)) {
        throw new BadRequestException(`Invalid table type: ${nextType}`);
      }

      if (nextCode !== current.table_code) {
        const dup = await client.query<{ id: string }>(
          `SELECT id FROM restaurant_tables
           WHERE tenant_id = $1 AND location_id = $2 AND UPPER(table_code) = $3 AND id != $4`,
          [tenantContext.tenantId, current.location_id, nextCode, tableId]
        );
        if (dup.rows.length > 0) {
          throw new ConflictException(`Table code '${nextCode}' already exists at this branch`);
        }
      }

      if (nextStatus === 'INACTIVE') {
        const openSess = await client.query<{ id: string }>(
          `SELECT id FROM table_sessions WHERE table_id = $1 AND status = 'OPEN' LIMIT 1`,
          [tableId]
        );
        if (openSess.rows.length > 0) {
          throw new BadRequestException('Cannot deactivate a table while it has an OPEN dining session');
        }
      }

      await client.query(
        `UPDATE restaurant_tables
         SET table_code = $1, label = $2, capacity = $3, section = $4,
             table_type = $5, status = $6, allow_qr_ordering = $7, notes = $8, updated_at = now()
         WHERE id = $9`,
        [nextCode, nextLabel, nextCapacity, nextSection, nextType, nextStatus, nextAllowQr, nextNotes, tableId]
      );

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, 'TABLE_UPDATED', 'restaurant_tables', $5, $6::jsonb)`,
        [
          tenantContext.tenantId,
          current.location_id,
          tenantContext.actorId,
          tenantContext.actorType,
          tableId,
          JSON.stringify({
            tableCode: nextCode,
            label: nextLabel,
            capacity: nextCapacity,
            section: nextSection,
            tableType: nextType,
            status: nextStatus,
            allowQrOrdering: nextAllowQr,
          }),
        ]
      );

      return current.location_id;
    });

    const overview = await this.listTables(tenantContext, updatedLocationId);
    const updated = overview.tables.find((t) => t.id === tableId);
    if (!updated) throw new NotFoundException('Updated table not found');
    return updated;
  }

  async rotateTableQrToken(
    tenantContext: TenantContextDto,
    tableId: string
  ): Promise<RotateTableQrResponseDto> {
    this.assertOwnerOrManager(tenantContext);

    return this.db.transaction(async (client) => {
      const tableRes = await client.query<{
        id: string;
        tenant_id: string;
        location_id: string;
        table_code: string;
        status: string;
      }>(
        `SELECT id, tenant_id, location_id, table_code, status
         FROM restaurant_tables
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [tableId, tenantContext.tenantId]
      );

      if (tableRes.rows.length === 0) {
        throw new NotFoundException(`Table ${tableId} not found`);
      }

      const table = tableRes.rows[0];
      await this.resolveLocationId(tenantContext, table.location_id);

      const revokeRes = await client.query<{ id: string }>(
        `UPDATE qr_tokens
         SET status = 'REVOKED', rotated_at = now()
         WHERE table_id = $1 AND tenant_id = $2 AND status = 'ACTIVE'
         RETURNING id`,
        [tableId, tenantContext.tenantId]
      );

      const { rawToken, tokenHash } = this.generateSecureQrToken(table.table_code);

      const insertRes = await client.query<{
        id: string;
        raw_token: string;
        status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
        created_at: Date;
        rotated_at: Date | null;
        expires_at: Date | null;
      }>(
        `INSERT INTO qr_tokens (tenant_id, location_id, table_id, token_hash, raw_token, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         RETURNING id, raw_token, status, created_at, rotated_at, expires_at`,
        [tenantContext.tenantId, table.location_id, tableId, tokenHash, rawToken]
      );

      const newQr = insertRes.rows[0];

      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, 'QR_TOKEN_ROTATED', 'qr_tokens', $5, $6::jsonb)`,
        [
          tenantContext.tenantId,
          table.location_id,
          tenantContext.actorId,
          tenantContext.actorType,
          newQr.id,
          JSON.stringify({
            tableId,
            tableCode: table.table_code,
            revokedCount: revokeRes.rows.length,
          }),
        ]
      );

      return {
        tableId,
        revokedCount: revokeRes.rows.length,
        activeQrToken: {
          id: newQr.id,
          rawToken: newQr.raw_token,
          status: newQr.status,
          createdAt: new Date(newQr.created_at).toISOString(),
          rotatedAt: newQr.rotated_at ? new Date(newQr.rotated_at).toISOString() : null,
          expiresAt: newQr.expires_at ? new Date(newQr.expires_at).toISOString() : null,
        },
      };
    });
  }
}
