import { TablesService } from '../src/modules/tables/tables.service.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TenantContextDto } from '@restaurant-saas/contracts';

describe('TablesService - Phase F Owner Table & QR Code Management', () => {
  let service: TablesService;
  let mockDb: any;
  let mockClient: any;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const LOC_A = '22222222-2222-2222-2222-222222222222';
  const LOC_B = '33333333-3333-3333-3333-333333333333';

  const ownerCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: 'owner-1',
    membershipId: 'mem-owner',
    roleCodes: ['OWNER'],
    permissions: [],
    requestId: 'req-1',
  };

  const managerCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: 'mgr-1',
    membershipId: 'mem-mgr',
    roleCodes: ['MANAGER'],
    permissions: [],
    requestId: 'req-2',
  };

  const chefCtx: TenantContextDto = {
    tenantId: TENANT_A,
    locationId: LOC_A,
    actorType: 'TENANT_USER',
    actorId: 'chef-1',
    membershipId: 'mem-chef',
    roleCodes: ['CHEF'],
    permissions: ['kitchen.view'],
    requestId: 'req-3',
  };

  beforeEach(() => {
    mockClient = { query: jest.fn() };
    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => cb(mockClient)),
    };
    service = new TablesService(mockDb);
  });

  describe('RBAC & Location Isolation (FR-OWN-02)', () => {
    it('denies CHEF from listing, creating, updating tables or rotating QR codes', async () => {
      await expect(service.listTables(chefCtx)).rejects.toThrow(ForbiddenException);
      await expect(
        service.createTable(chefCtx, { tableCode: 'T-10', label: 'Table 10', capacity: 4 })
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateTable(chefCtx, 'tbl-1', { label: 'Updated' })
      ).rejects.toThrow(ForbiddenException);
      await expect(service.rotateTableQrToken(chefCtx, 'tbl-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('rejects cross-location access when MANAGER is not assigned to requested branch', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await expect(service.listTables(managerCtx, LOC_B)).rejects.toThrow(ForbiddenException);
    });

    it('rejects cross-tenant table update when table belongs to another tenant', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.updateTable(ownerCtx, 'foreign-table-id', { label: 'Hacked' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Table Creation & Validation (FR-OWN-02)', () => {
    it('rejects out-of-range seating capacity', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] });
      await expect(
        service.createTable(ownerCtx, { tableCode: 'T-09', label: 'Table 9', capacity: 0 })
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate tableCode within the same branch', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'existing-tbl' }] });

      await expect(
        service.createTable(ownerCtx, { tableCode: 'T-01', label: 'Table 1', capacity: 4 })
      ).rejects.toThrow(ConflictException);
    });

    it('creates table, generates initial ACTIVE QR token, and records audit log', async () => {
      // resolveLocationId (createTable) + resolveLocationId (listTables)
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: LOC_A }] })
        .mockResolvedValueOnce({ rows: [{ id: LOC_A }] })
        // listTables meta
        .mockResolvedValueOnce({
          rows: [
            {
              tenant_id: TENANT_A,
              tenant_slug: 'spice-garden',
              tenant_name: 'Spice Garden',
              location_id: LOC_A,
              location_name: 'Main Outlet',
            },
          ],
        })
        // listTables tables
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'tbl-new-1',
              tenant_id: TENANT_A,
              location_id: LOC_A,
              table_code: 'T-05',
              label: 'Table 5',
              capacity: 4,
              section: 'Main Hall',
              table_type: 'STANDARD',
              status: 'AVAILABLE',
              allow_qr_ordering: true,
              notes: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        // listTables active QR tokens
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'qr-new-1',
              table_id: 'tbl-new-1',
              raw_token: 'tbl-t-05-abcdef123456',
              status: 'ACTIVE',
              created_at: new Date(),
              rotated_at: null,
              expires_at: null,
            },
          ],
        })
        // listTables open sessions
        .mockResolvedValueOnce({ rows: [] });

      // Transaction queries
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // duplicate check
        .mockResolvedValueOnce({ rows: [{ id: 'tbl-new-1' }] }) // insert table
        .mockResolvedValueOnce({ rows: [] }) // insert qr_token
        .mockResolvedValueOnce({ rows: [] }); // audit log

      const created = await service.createTable(ownerCtx, {
        locationId: LOC_A,
        tableCode: 't-05',
        label: 'Table 5',
        capacity: 4,
      });

      expect(created.tableCode).toBe('T-05');
      expect(created.activeQrToken?.status).toBe('ACTIVE');
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      const qrInsertCall = mockClient.query.mock.calls[2][0];
      expect(qrInsertCall).toContain('INSERT INTO qr_tokens');
      const auditCall = mockClient.query.mock.calls[3][0];
      expect(auditCall).toContain('TABLE_CREATED');
    });
  });

  describe('Table Update & QR Token Rotation (FR-ORD-01, FR-OWN-02)', () => {
    it('prevents deactivating a table with an OPEN dining session', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'tbl-1',
            tenant_id: TENANT_A,
            location_id: LOC_A,
            table_code: 'T-01',
            label: 'Table 1',
            capacity: 4,
            section: 'Main Hall',
            table_type: 'STANDARD',
            status: 'AVAILABLE',
            allow_qr_ordering: true,
            notes: null,
          },
        ],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] }); // resolveLocationId
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'open-sess-1' }] }); // open session check

      await expect(
        service.updateTable(ownerCtx, 'tbl-1', { status: 'INACTIVE' })
      ).rejects.toThrow(BadRequestException);
    });

    it('rotates QR token atomically, revoking previous active tokens and auditing', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: 'tbl-1', tenant_id: TENANT_A, location_id: LOC_A, table_code: 'T-01', status: 'AVAILABLE' }],
        })
        .mockResolvedValueOnce({ rows: [{ id: 'old-qr-1' }] }) // revoke active tokens
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'new-qr-2',
              raw_token: 'tbl-t-01-998877665544',
              status: 'ACTIVE',
              created_at: new Date(),
              rotated_at: null,
              expires_at: null,
            },
          ],
        }) // insert new qr
        .mockResolvedValueOnce({ rows: [] }); // audit log

      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_A }] }); // resolveLocationId

      const result = await service.rotateTableQrToken(ownerCtx, 'tbl-1');

      expect(result.tableId).toBe('tbl-1');
      expect(result.revokedCount).toBe(1);
      expect(result.activeQrToken.id).toBe('new-qr-2');
      expect(result.activeQrToken.status).toBe('ACTIVE');
      expect(mockClient.query.mock.calls[1][0]).toContain("SET status = 'REVOKED'");
      expect(mockClient.query.mock.calls[3][0]).toContain('QR_TOKEN_ROTATED');
    });
  });
});
