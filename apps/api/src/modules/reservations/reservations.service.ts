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
  TableReservationDto,
  TableWaitlistDto,
  CreateReservationRequestDto,
  UpdateReservationRequestDto,
  CreateWaitlistRequestDto,
  UpdateWaitlistRequestDto,
  ReservationsOverviewDto,
  WaitlistOverviewDto,
  ReservationStatus,
  ReservationSource,
  WaitlistStatus,
} from '@restaurant-saas/contracts';

const ALLOWED_RESERVATION_STATUSES: ReservationStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'CANCELLED',
  'NO_SHOW',
  'COMPLETED',
];

const ALLOWED_RESERVATION_SOURCES: ReservationSource[] = [
  'WEBSITE',
  'PHONE',
  'WALK_IN',
  'STAFF',
  'APP',
];

const ALLOWED_WAITLIST_STATUSES: WaitlistStatus[] = [
  'WAITING',
  'NOTIFIED',
  'SEATED',
  'CANCELLED',
  'NO_SHOW',
  'COMPLETED',
];

@Injectable()
export class ReservationsService {
  constructor(private readonly db: DatabaseService) {}

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
        const check = await this.db.query(
          `SELECT id FROM locations WHERE id = $1 AND tenant_id = $2`,
          [requestedLocationId, tenantContext.tenantId]
        );
        if (check.rows.length === 0) {
          throw new NotFoundException('Requested location not found for this tenant');
        }
        return requestedLocationId;
      }
      const firstLoc = await this.db.query(
        `SELECT id FROM locations WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [tenantContext.tenantId]
      );
      if (firstLoc.rows.length === 0) {
        throw new NotFoundException('No location found for this tenant');
      }
      return firstLoc.rows[0].id;
    }

    if (tenantContext.locationId) {
      if (requestedLocationId && requestedLocationId !== tenantContext.locationId) {
        throw new ForbiddenException('Staff cannot access reservations for other locations');
      }
      return tenantContext.locationId;
    }

    const firstLoc = await this.db.query(
      `SELECT id FROM locations WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [tenantContext.tenantId]
    );
    if (firstLoc.rows.length === 0) {
      throw new NotFoundException('No location found for this tenant');
    }
    return firstLoc.rows[0].id;
  }

  // ---------------------------------------------------------------------------
  // RESERVATIONS
  // ---------------------------------------------------------------------------

  async listReservations(
    tenantContext: TenantContextDto,
    locationId?: string,
    date?: string,
    status?: string
  ): Promise<ReservationsOverviewDto> {
    const locId = await this.resolveLocationId(tenantContext, locationId);
    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toISOString().split('T')[0];

    const params: any[] = [tenantContext.tenantId, locId, targetDate];
    let statusFilter = '';
    if (status && ALLOWED_RESERVATION_STATUSES.includes(status as ReservationStatus)) {
      params.push(status);
      statusFilter = `AND r.status = $${params.length}`;
    }

    const query = `
      SELECT
        r.id,
        r.tenant_id AS "tenantId",
        r.location_id AS "locationId",
        l.name AS "locationName",
        r.table_id AS "tableId",
        t.table_code AS "tableCode",
        t.label AS "tableLabel",
        r.reservation_code AS "reservationCode",
        r.guest_name AS "guestName",
        r.guest_phone AS "guestPhone",
        r.guest_email AS "guestEmail",
        r.party_size AS "partySize",
        TO_CHAR(r.reservation_date, 'YYYY-MM-DD') AS "reservationDate",
        r.start_time::text AS "startTime",
        r.end_time::text AS "endTime",
        r.status,
        r.source,
        r.occasion,
        r.special_requests AS "specialRequests",
        r.notes,
        r.seated_at AS "seatedAt",
        r.cancelled_at AS "cancelledAt",
        r.cancellation_reason AS "cancellationReason",
        r.created_at AS "createdAt",
        r.updated_at AS "updatedAt"
      FROM table_reservations r
      JOIN locations l ON l.id = r.location_id
      LEFT JOIN restaurant_tables t ON t.id = r.table_id
      WHERE r.tenant_id = $1
        AND r.location_id = $2
        AND r.reservation_date = $3
        ${statusFilter}
      ORDER BY r.start_time ASC, r.created_at ASC
    `;

    const res = await this.db.query(query, params);

    const summaryRes = await this.db.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'SEATED')::int AS seated,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_show
      FROM table_reservations
      WHERE tenant_id = $1 AND location_id = $2 AND reservation_date = $3
      `,
      [tenantContext.tenantId, locId, targetDate]
    );

    const summary = summaryRes.rows[0] || {
      total: 0,
      confirmed: 0,
      seated: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      no_show: 0,
    };

    return {
      tenantId: tenantContext.tenantId,
      locationId: locId,
      date: targetDate,
      summary: {
        totalReservations: summary.total,
        confirmed: summary.confirmed,
        seated: summary.seated,
        completed: summary.completed,
        pending: summary.pending,
        cancelled: summary.cancelled,
        noShow: summary.no_show,
      },
      reservations: res.rows,
    };
  }

  async createReservation(
    tenantContext: TenantContextDto,
    dto: CreateReservationRequestDto
  ): Promise<TableReservationDto> {
    const locId = await this.resolveLocationId(tenantContext, dto.locationId);

    if (!dto.guestName || dto.guestName.trim().length === 0) {
      throw new BadRequestException('Guest name is required');
    }
    if (!dto.guestPhone || dto.guestPhone.trim().length === 0) {
      throw new BadRequestException('Guest phone number is required');
    }
    const partySize = Number(dto.partySize);
    if (isNaN(partySize) || partySize < 1 || partySize > 40) {
      throw new BadRequestException('Party size must be between 1 and 40 guests');
    }
    if (!dto.reservationDate || !/^\d{4}-\d{2}-\d{2}$/.test(dto.reservationDate)) {
      throw new BadRequestException('Valid reservation date (YYYY-MM-DD) is required');
    }
    if (!dto.startTime) {
      throw new BadRequestException('Start time is required');
    }

    // Default endTime to 2 hours after startTime if not provided
    let startTime = dto.startTime.trim();
    if (startTime.length === 5) startTime += ':00';
    let endTime = dto.endTime ? dto.endTime.trim() : '';
    if (endTime.length === 5) endTime += ':00';
    if (!endTime) {
      const [hh, mm] = startTime.split(':').map(Number);
      const endHh = (hh + 2) % 24;
      endTime = `${String(endHh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00`;
    }

    // Check table validity and conflicts if tableId supplied
    let tableId: string | null = null;
    if (dto.tableId) {
      const tableCheck = await this.db.query(
        `SELECT id, capacity, table_code FROM restaurant_tables WHERE id = $1 AND tenant_id = $2 AND location_id = $3`,
        [dto.tableId, tenantContext.tenantId, locId]
      );
      if (tableCheck.rows.length === 0) {
        throw new NotFoundException('Selected table not found at this location');
      }

      // Check conflict
      const conflictCheck = await this.db.query(
        `
        SELECT id, reservation_code, start_time, end_time
        FROM table_reservations
        WHERE tenant_id = $1
          AND location_id = $2
          AND table_id = $3
          AND reservation_date = $4
          AND status IN ('CONFIRMED', 'SEATED', 'PENDING')
          AND NOT (end_time <= $5 OR start_time >= $6)
        `,
        [tenantContext.tenantId, locId, dto.tableId, dto.reservationDate, startTime, endTime]
      );

      if (conflictCheck.rows.length > 0) {
        throw new ConflictException(
          `Table is already reserved by ${conflictCheck.rows[0].reservation_code} between ${conflictCheck.rows[0].start_time} and ${conflictCheck.rows[0].end_time}`
        );
      }
      tableId = dto.tableId;
    }

    const code = `RES-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const status: ReservationStatus = dto.status && ALLOWED_RESERVATION_STATUSES.includes(dto.status)
      ? dto.status
      : 'CONFIRMED';
    const source: ReservationSource = dto.source && ALLOWED_RESERVATION_SOURCES.includes(dto.source)
      ? dto.source
      : 'STAFF';

    const insertRes = await this.db.query(
      `
      INSERT INTO table_reservations (
        tenant_id,
        location_id,
        table_id,
        reservation_code,
        guest_name,
        guest_phone,
        guest_email,
        party_size,
        reservation_date,
        start_time,
        end_time,
        status,
        source,
        occasion,
        special_requests,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING
        id,
        tenant_id AS "tenantId",
        location_id AS "locationId",
        table_id AS "tableId",
        reservation_code AS "reservationCode",
        guest_name AS "guestName",
        guest_phone AS "guestPhone",
        guest_email AS "guestEmail",
        party_size AS "partySize",
        TO_CHAR(reservation_date, 'YYYY-MM-DD') AS "reservationDate",
        start_time::text AS "startTime",
        end_time::text AS "endTime",
        status,
        source,
        occasion,
        special_requests AS "specialRequests",
        notes,
        seated_at AS "seatedAt",
        cancelled_at AS "cancelledAt",
        cancellation_reason AS "cancellationReason",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        tenantContext.tenantId,
        locId,
        tableId,
        code,
        dto.guestName.trim(),
        dto.guestPhone.trim(),
        dto.guestEmail ? dto.guestEmail.trim() : null,
        partySize,
        dto.reservationDate,
        startTime,
        endTime,
        status,
        source,
        dto.occasion || null,
        dto.specialRequests || null,
        dto.notes || null,
        tenantContext.actorId || null,
      ]
    );

    const record = insertRes.rows[0];

    // If table assigned, fetch table code
    if (tableId) {
      const tbl = await this.db.query(
        `SELECT table_code, label FROM restaurant_tables WHERE id = $1`,
        [tableId]
      );
      if (tbl.rows.length > 0) {
        record.tableCode = tbl.rows[0].table_code;
        record.tableLabel = tbl.rows[0].label;
      }
    }

    return record;
  }

  async updateReservation(
    tenantContext: TenantContextDto,
    reservationId: string,
    dto: UpdateReservationRequestDto
  ): Promise<TableReservationDto> {
    const existingRes = await this.db.query(
      `
      SELECT *
      FROM table_reservations
      WHERE id = $1 AND tenant_id = $2
      `,
      [reservationId, tenantContext.tenantId]
    );

    if (existingRes.rows.length === 0) {
      throw new NotFoundException('Reservation not found');
    }

    const cur = existingRes.rows[0];
    const locId = cur.location_id;

    let targetTableId = cur.table_id;
    if (dto.tableId !== undefined) {
      targetTableId = dto.tableId;
    }

    const targetDate = dto.reservationDate || cur.reservation_date;
    let targetStartTime = dto.startTime ? dto.startTime.trim() : cur.start_time;
    if (targetStartTime.length === 5) targetStartTime += ':00';
    let targetEndTime = dto.endTime ? dto.endTime.trim() : cur.end_time;
    if (targetEndTime && targetEndTime.length === 5) targetEndTime += ':00';

    // If table changed or time changed, check conflicts
    if (targetTableId) {
      const conflictCheck = await this.db.query(
        `
        SELECT id, reservation_code, start_time, end_time
        FROM table_reservations
        WHERE tenant_id = $1
          AND location_id = $2
          AND table_id = $3
          AND reservation_date = $4
          AND id != $5
          AND status IN ('CONFIRMED', 'SEATED', 'PENDING')
          AND NOT (end_time <= $6 OR start_time >= $7)
        `,
        [
          tenantContext.tenantId,
          locId,
          targetTableId,
          targetDate,
          reservationId,
          targetStartTime,
          targetEndTime,
        ]
      );

      if (conflictCheck.rows.length > 0) {
        throw new ConflictException(
          `Table is already reserved by ${conflictCheck.rows[0].reservation_code} between ${conflictCheck.rows[0].start_time} and ${conflictCheck.rows[0].end_time}`
        );
      }
    }

    const targetStatus = dto.status && ALLOWED_RESERVATION_STATUSES.includes(dto.status)
      ? dto.status
      : cur.status;

    let seatedAt = cur.seated_at;
    let cancelledAt = cur.cancelled_at;
    let cancellationReason = cur.cancellation_reason;

    if (targetStatus === 'SEATED' && cur.status !== 'SEATED') {
      seatedAt = new Date();
      // If table is assigned, mark table as OCCUPIED
      if (targetTableId) {
        await this.db.query(
          `UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [targetTableId, tenantContext.tenantId]
        );
      }
    } else if (targetStatus === 'CANCELLED' && cur.status !== 'CANCELLED') {
      cancelledAt = new Date();
      cancellationReason = dto.cancellationReason || 'Cancelled by staff or guest';
    } else if (targetStatus === 'COMPLETED') {
      if (targetTableId) {
        await this.db.query(
          `UPDATE restaurant_tables SET status = 'AVAILABLE', updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND status = 'OCCUPIED'`,
          [targetTableId, tenantContext.tenantId]
        );
      }
    }

    const updateRes = await this.db.query(
      `
      UPDATE table_reservations
      SET
        table_id = $1,
        guest_name = COALESCE($2, guest_name),
        guest_phone = COALESCE($3, guest_phone),
        guest_email = COALESCE($4, guest_email),
        party_size = COALESCE($5, party_size),
        reservation_date = COALESCE($6, reservation_date),
        start_time = COALESCE($7, start_time),
        end_time = COALESCE($8, end_time),
        status = $9,
        source = COALESCE($10, source),
        occasion = COALESCE($11, occasion),
        special_requests = COALESCE($12, special_requests),
        notes = COALESCE($13, notes),
        seated_at = $14,
        cancelled_at = $15,
        cancellation_reason = $16,
        updated_at = NOW()
      WHERE id = $17 AND tenant_id = $18
      RETURNING
        id,
        tenant_id AS "tenantId",
        location_id AS "locationId",
        table_id AS "tableId",
        reservation_code AS "reservationCode",
        guest_name AS "guestName",
        guest_phone AS "guestPhone",
        guest_email AS "guestEmail",
        party_size AS "partySize",
        TO_CHAR(reservation_date, 'YYYY-MM-DD') AS "reservationDate",
        start_time::text AS "startTime",
        end_time::text AS "endTime",
        status,
        source,
        occasion,
        special_requests AS "specialRequests",
        notes,
        seated_at AS "seatedAt",
        cancelled_at AS "cancelledAt",
        cancellation_reason AS "cancellationReason",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        targetTableId,
        dto.guestName ? dto.guestName.trim() : null,
        dto.guestPhone ? dto.guestPhone.trim() : null,
        dto.guestEmail !== undefined ? (dto.guestEmail ? dto.guestEmail.trim() : null) : null,
        dto.partySize ? Number(dto.partySize) : null,
        dto.reservationDate || null,
        targetStartTime || null,
        targetEndTime || null,
        targetStatus,
        dto.source || null,
        dto.occasion !== undefined ? dto.occasion : null,
        dto.specialRequests !== undefined ? dto.specialRequests : null,
        dto.notes !== undefined ? dto.notes : null,
        seatedAt,
        cancelledAt,
        cancellationReason,
        reservationId,
        tenantContext.tenantId,
      ]
    );

    const updated = updateRes.rows[0];

    if (updated.tableId) {
      const tbl = await this.db.query(
        `SELECT table_code, label FROM restaurant_tables WHERE id = $1`,
        [updated.tableId]
      );
      if (tbl.rows.length > 0) {
        updated.tableCode = tbl.rows[0].table_code;
        updated.tableLabel = tbl.rows[0].label;
      }
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // WAITLIST / WALK-IN QUEUE
  // ---------------------------------------------------------------------------

  async listWaitlist(
    tenantContext: TenantContextDto,
    locationId?: string,
    status?: string
  ): Promise<WaitlistOverviewDto> {
    const locId = await this.resolveLocationId(tenantContext, locationId);

    const params: any[] = [tenantContext.tenantId, locId];
    let statusFilter = '';
    if (status && ALLOWED_WAITLIST_STATUSES.includes(status as WaitlistStatus)) {
      params.push(status);
      statusFilter = `AND w.status = $${params.length}`;
    }

    const query = `
      SELECT
        w.id,
        w.tenant_id AS "tenantId",
        w.location_id AS "locationId",
        l.name AS "locationName",
        w.queue_number AS "queueNumber",
        w.guest_name AS "guestName",
        w.guest_phone AS "guestPhone",
        w.party_size AS "partySize",
        w.section_preference AS "sectionPreference",
        w.status,
        w.estimated_wait_minutes AS "estimatedWaitMinutes",
        w.assigned_table_id AS "assignedTableId",
        t.table_code AS "assignedTableCode",
        t.label AS "assignedTableLabel",
        w.notes,
        w.notified_at AS "notifiedAt",
        w.seated_at AS "seatedAt",
        w.created_at AS "createdAt",
        w.updated_at AS "updatedAt"
      FROM table_waitlist w
      JOIN locations l ON l.id = w.location_id
      LEFT JOIN restaurant_tables t ON t.id = w.assigned_table_id
      WHERE w.tenant_id = $1
        AND w.location_id = $2
        ${statusFilter}
      ORDER BY
        CASE
          WHEN w.status = 'WAITING' THEN 1
          WHEN w.status = 'NOTIFIED' THEN 2
          WHEN w.status = 'SEATED' THEN 3
          ELSE 4
        END,
        w.created_at ASC
    `;

    const res = await this.db.query(query, params);

    const summaryRes = await this.db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'WAITING')::int AS total_waiting,
        COUNT(*) FILTER (WHERE status = 'NOTIFIED')::int AS notified,
        COUNT(*) FILTER (WHERE status = 'SEATED' AND seated_at::date = CURRENT_DATE)::int AS seated_today,
        COUNT(*) FILTER (WHERE status = 'COMPLETED' AND updated_at::date = CURRENT_DATE)::int AS completed_today,
        COALESCE(AVG(estimated_wait_minutes) FILTER (WHERE status = 'WAITING'), 15)::int AS avg_wait
      FROM table_waitlist
      WHERE tenant_id = $1 AND location_id = $2 AND created_at::date = CURRENT_DATE
      `,
      [tenantContext.tenantId, locId]
    );

    const s = summaryRes.rows[0] || {
      total_waiting: 0,
      notified: 0,
      seated_today: 0,
      completed_today: 0,
      avg_wait: 15,
    };

    return {
      tenantId: tenantContext.tenantId,
      locationId: locId,
      summary: {
        totalWaiting: s.total_waiting,
        notified: s.notified,
        seatedToday: s.seated_today,
        completedToday: s.completed_today,
        avgWaitMinutes: s.avg_wait,
      },
      waitlist: res.rows,
    };
  }

  async addToWaitlist(
    tenantContext: TenantContextDto,
    dto: CreateWaitlistRequestDto
  ): Promise<TableWaitlistDto> {
    const locId = await this.resolveLocationId(tenantContext, dto.locationId);

    if (!dto.guestName || dto.guestName.trim().length === 0) {
      throw new BadRequestException('Guest name is required');
    }
    if (!dto.guestPhone || dto.guestPhone.trim().length === 0) {
      throw new BadRequestException('Guest phone number is required');
    }
    const partySize = Number(dto.partySize);
    if (isNaN(partySize) || partySize < 1 || partySize > 40) {
      throw new BadRequestException('Party size must be between 1 and 40 guests');
    }

    // Get next queue number for today
    const queueRes = await this.db.query(
      `
      SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue
      FROM table_waitlist
      WHERE tenant_id = $1 AND location_id = $2 AND created_at::date = CURRENT_DATE
      `,
      [tenantContext.tenantId, locId]
    );
    const queueNumber = queueRes.rows[0].next_queue;

    const waitMinutes = Number(dto.estimatedWaitMinutes) || 15;
    const sectionPref = dto.sectionPreference?.trim() || 'ANY';

    const insertRes = await this.db.query(
      `
      INSERT INTO table_waitlist (
        tenant_id,
        location_id,
        queue_number,
        guest_name,
        guest_phone,
        party_size,
        section_preference,
        status,
        estimated_wait_minutes,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'WAITING', $8, $9, $10)
      RETURNING
        id,
        tenant_id AS "tenantId",
        location_id AS "locationId",
        queue_number AS "queueNumber",
        guest_name AS "guestName",
        guest_phone AS "guestPhone",
        party_size AS "partySize",
        section_preference AS "sectionPreference",
        status,
        estimated_wait_minutes AS "estimatedWaitMinutes",
        assigned_table_id AS "assignedTableId",
        notes,
        notified_at AS "notifiedAt",
        seated_at AS "seatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        tenantContext.tenantId,
        locId,
        queueNumber,
        dto.guestName.trim(),
        dto.guestPhone.trim(),
        partySize,
        sectionPref,
        waitMinutes,
        dto.notes || null,
        tenantContext.actorId || null,
      ]
    );

    return insertRes.rows[0];
  }

  async updateWaitlist(
    tenantContext: TenantContextDto,
    waitlistId: string,
    dto: UpdateWaitlistRequestDto
  ): Promise<TableWaitlistDto> {
    const existing = await this.db.query(
      `SELECT * FROM table_waitlist WHERE id = $1 AND tenant_id = $2`,
      [waitlistId, tenantContext.tenantId]
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException('Waitlist entry not found');
    }

    const cur = existing.rows[0];
    const targetStatus = dto.status && ALLOWED_WAITLIST_STATUSES.includes(dto.status)
      ? dto.status
      : cur.status;

    let targetTableId = cur.assigned_table_id;
    if (dto.assignedTableId !== undefined) {
      targetTableId = dto.assignedTableId;
    }

    let notifiedAt = cur.notified_at;
    let seatedAt = cur.seated_at;

    if (targetStatus === 'NOTIFIED' && cur.status !== 'NOTIFIED') {
      notifiedAt = new Date();
    } else if (targetStatus === 'SEATED' && cur.status !== 'SEATED') {
      seatedAt = new Date();
      if (targetTableId) {
        await this.db.query(
          `UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [targetTableId, tenantContext.tenantId]
        );
      }
    }

    const updateRes = await this.db.query(
      `
      UPDATE table_waitlist
      SET
        status = $1,
        assigned_table_id = $2,
        party_size = COALESCE($3, party_size),
        section_preference = COALESCE($4, section_preference),
        estimated_wait_minutes = COALESCE($5, estimated_wait_minutes),
        notes = COALESCE($6, notes),
        notified_at = $7,
        seated_at = $8,
        updated_at = NOW()
      WHERE id = $9 AND tenant_id = $10
      RETURNING
        id,
        tenant_id AS "tenantId",
        location_id AS "locationId",
        queue_number AS "queueNumber",
        guest_name AS "guestName",
        guest_phone AS "guestPhone",
        party_size AS "partySize",
        section_preference AS "sectionPreference",
        status,
        estimated_wait_minutes AS "estimatedWaitMinutes",
        assigned_table_id AS "assignedTableId",
        notes,
        notified_at AS "notifiedAt",
        seated_at AS "seatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        targetStatus,
        targetTableId,
        dto.partySize ? Number(dto.partySize) : null,
        dto.sectionPreference || null,
        dto.estimatedWaitMinutes ? Number(dto.estimatedWaitMinutes) : null,
        dto.notes !== undefined ? dto.notes : null,
        notifiedAt,
        seatedAt,
        waitlistId,
        tenantContext.tenantId,
      ]
    );

    const updated = updateRes.rows[0];

    if (updated.assignedTableId) {
      const tbl = await this.db.query(
        `SELECT table_code, label FROM restaurant_tables WHERE id = $1`,
        [updated.assignedTableId]
      );
      if (tbl.rows.length > 0) {
        updated.assignedTableCode = tbl.rows[0].table_code;
        updated.assignedTableLabel = tbl.rows[0].label;
      }
    }

    return updated;
  }
}
