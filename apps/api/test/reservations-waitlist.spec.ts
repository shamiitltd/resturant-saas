import { ReservationsService } from '../src/modules/reservations/reservations.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TenantContextDto } from '@restaurant-saas/contracts';

describe('ReservationsService - Phase G Table Reservations & Waitlist', () => {
  let service: ReservationsService;
  let mockDb: any;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const LOC_A = '22222222-2222-2222-2222-222222222222';
  const LOC_B = '33333333-3333-3333-3333-333333333333';
  const TABLE_1 = '44444444-4444-4444-4444-444444444444';

  const ownerCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: 'owner-1',
    membershipId: 'mem-owner',
    roleCodes: ['OWNER'],
    permissions: ['reservations.view', 'reservations.manage'],
    requestId: 'req-1',
  };

  const staffCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: 'reception-1',
    membershipId: 'mem-rec',
    roleCodes: ['RECEPTIONIST'],
    permissions: ['reservations.view', 'reservations.manage'],
    requestId: 'req-2',
  };

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    service = new ReservationsService(mockDb);
  });

  describe('Reservation Management', () => {
    it('creates a new reservation with valid details', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: LOC_A }] }) // resolveLocationId check
        .mockResolvedValueOnce({ rows: [{ id: TABLE_1, capacity: 4, table_code: 'T-01' }] }) // tableCheck
        .mockResolvedValueOnce({ rows: [] }) // conflictCheck
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'res-1',
              tenantId: TENANT_A,
              locationId: LOC_A,
              tableId: TABLE_1,
              reservationCode: 'RES-ABC123',
              guestName: 'Jane Doe',
              guestPhone: '+919876543210',
              partySize: 4,
              reservationDate: '2026-11-28',
              startTime: '19:00:00',
              endTime: '21:00:00',
              status: 'CONFIRMED',
              source: 'PHONE',
            },
          ],
        }) // insertRes
        .mockResolvedValueOnce({ rows: [{ table_code: 'T-01', label: 'Table 1' }] }); // table details

      const result = await service.createReservation(ownerCtx, {
        locationId: LOC_A,
        tableId: TABLE_1,
        guestName: 'Jane Doe',
        guestPhone: '+919876543210',
        partySize: 4,
        reservationDate: '2026-11-28',
        startTime: '19:00',
        source: 'PHONE',
      });

      expect(result).toBeDefined();
      expect(result.reservationCode).toBe('RES-ABC123');
      expect(result.partySize).toBe(4);
      expect(result.tableCode).toBe('T-01');
    });

    it('rejects conflicting overlapping reservation on same table', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: LOC_A }] }) // resolveLocationId
        .mockResolvedValueOnce({ rows: [{ id: TABLE_1, capacity: 4, table_code: 'T-01' }] }) // tableCheck
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'existing-res',
              reservation_code: 'RES-OLD999',
              start_time: '19:00:00',
              end_time: '21:00:00',
            },
          ],
        }); // conflictCheck found

      await expect(
        service.createReservation(ownerCtx, {
          locationId: LOC_A,
          tableId: TABLE_1,
          guestName: 'John Smith',
          guestPhone: '+919999988888',
          partySize: 2,
          reservationDate: '2026-11-28',
          startTime: '19:30',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('prevents staff from accessing other location reservations', async () => {
      await expect(
        service.listReservations(staffCtx, LOC_B)
      ).rejects.toThrow(ForbiddenException);
    });

    it('marks reservation SEATED and updates table to OCCUPIED', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'res-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              table_id: TABLE_1,
              reservation_date: '2026-11-28',
              start_time: '19:00:00',
              end_time: '21:00:00',
              status: 'CONFIRMED',
            },
          ],
        }) // existing check
        .mockResolvedValueOnce({ rows: [] }) // conflict check (none)
        .mockResolvedValueOnce({ rows: [] }) // table OCCUPIED update
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'res-1',
              tableId: TABLE_1,
              status: 'SEATED',
              seatedAt: new Date().toISOString(),
            },
          ],
        }) // update reservation
        .mockResolvedValueOnce({ rows: [{ table_code: 'T-01', label: 'Table 1' }] }); // table details

      const updated = await service.updateReservation(staffCtx, 'res-1', {
        status: 'SEATED',
      });

      expect(updated.status).toBe('SEATED');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining(`UPDATE restaurant_tables SET status = 'OCCUPIED'`),
        expect.any(Array)
      );
    });
  });

  describe('Waitlist Queue Management', () => {
    it('adds a walk-in guest to the waitlist with incremented queue number', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ next_queue: 5 }] }) // queue number query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'wl-1',
              tenantId: TENANT_A,
              locationId: LOC_A,
              queueNumber: 5,
              guestName: 'Alex Mercer',
              guestPhone: '+919123456789',
              partySize: 3,
              sectionPreference: 'Patio',
              status: 'WAITING',
              estimatedWaitMinutes: 20,
            },
          ],
        }); // insertRes

      const result = await service.addToWaitlist(staffCtx, {
        guestName: 'Alex Mercer',
        guestPhone: '+919123456789',
        partySize: 3,
        sectionPreference: 'Patio',
        estimatedWaitMinutes: 20,
      });

      expect(result).toBeDefined();
      expect(result.queueNumber).toBe(5);
      expect(result.status).toBe('WAITING');
    });

    it('updates waitlist guest to SEATED with assigned table', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'wl-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              status: 'WAITING',
              assigned_table_id: null,
            },
          ],
        }) // existing waitlist
        .mockResolvedValueOnce({ rows: [] }) // table OCCUPIED update
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'wl-1',
              status: 'SEATED',
              assignedTableId: TABLE_1,
              seatedAt: new Date().toISOString(),
            },
          ],
        }) // update waitlist
        .mockResolvedValueOnce({ rows: [{ table_code: 'T-01', label: 'Table 1' }] }); // table details

      const updated = await service.updateWaitlist(staffCtx, 'wl-1', {
        status: 'SEATED',
        assignedTableId: TABLE_1,
      });

      expect(updated.status).toBe('SEATED');
      expect(updated.assignedTableCode).toBe('T-01');
    });
  });
});
