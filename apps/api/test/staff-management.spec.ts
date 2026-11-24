import { StaffManagementService } from '../src/modules/staff-management/staff-management.service.js';
import { DatabaseService } from '../src/database/database.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('StaffManagementService - Staff & Roles Vertical Slice', () => {
  let service: StaffManagementService;
  let mockDb: any;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const ACTOR_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ROLE_MANAGER_ID = 'r-mgr-1';
  const ROLE_CUSTOM_ID = 'r-custom-1';
  const LOC_1_ID = 'loc-1';
  const LOC_2_ID = 'loc-2';

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    service = new StaffManagementService(mockDb as unknown as DatabaseService);
  });

  describe('listStaff', () => {
    it('should list staff members scoped to tenant', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            membership_id: 'mem-1',
            user_id: 'user-1',
            status: 'ACTIVE',
            joined_at: new Date('2025-01-12'),
            email: 'priya@bistroros.in',
            full_name: 'Priya Sharma',
            phone: '+91 98765 43210',
            avatar_url: null,
            role_id: ROLE_MANAGER_ID,
            role_code: 'MANAGER',
            role_name: 'Manager',
            is_system_role: true,
            locations: [{ id: LOC_1_ID, name: 'Rohini (Main)', code: 'ROH-01', isPrimary: true }],
          },
        ],
      });

      const staff = await service.listStaff(TENANT_A);
      expect(staff).toHaveLength(1);
      expect(staff[0].fullName).toBe('Priya Sharma');
      expect(staff[0].role.code).toBe('MANAGER');
      expect(staff[0].locations[0].name).toBe('Rohini (Main)');
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('FROM tenant_memberships m'), [TENANT_A]);
    });
  });

  describe('getStaffStats', () => {
    it('should return aggregate staff, outlet and role stats', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ total: 42, active: 37, on_leave: 2, invited: 1, inactive: 2 }],
        })
        .mockResolvedValueOnce({ rows: [{ total_outlets: 3 }] })
        .mockResolvedValueOnce({ rows: [{ total_roles: 6 }] });

      const stats = await service.getStaffStats(TENANT_A);
      expect(stats.totalStaff).toBe(42);
      expect(stats.activeStaff).toBe(37);
      expect(stats.onLeaveStaff).toBe(2);
      expect(stats.invitedStaff).toBe(1);
      expect(stats.inactiveStaff).toBe(2);
      expect(stats.totalOutlets).toBe(3);
      expect(stats.totalRoles).toBe(6);
    });
  });

  describe('createStaff', () => {
    it('should successfully create and assign a new staff member', async () => {
      // 1. Role lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_MANAGER_ID, code: 'MANAGER', name: 'Manager', is_system_role: true }],
      });
      // 2. Profile lookup (not found)
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 3. Profile insert
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'user-new' }] });
      // 4. Membership check
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 5. Membership insert
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'mem-new' }] });
      // 6. Delete old roles
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 7. Insert membership_roles
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 8. Delete old locations
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 9. Location lookup (loc-1 belongs to tenant)
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: LOC_1_ID, name: 'Rohini (Main)', code: 'ROH-01' }] });
      // 10. Insert location_memberships
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // 11. Audit log insert
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.createStaff(TENANT_A, ACTOR_ID, {
        fullName: 'Karan Mehta',
        email: 'karan@spicegarden.com',
        phone: '+91 98765 43216',
        roleId: ROLE_MANAGER_ID,
        locationIds: [LOC_1_ID],
        status: 'ACTIVE',
      });

      expect(res.id).toBe('mem-new');
      expect(res.fullName).toBe('Karan Mehta');
      expect(res.role.code).toBe('MANAGER');
      expect(res.locations).toHaveLength(1);
    });

    it('should reject creating staff with missing name or invalid email', async () => {
      await expect(
        service.createStaff(TENANT_A, ACTOR_ID, {
          fullName: '',
          email: 'invalid-email',
          roleId: ROLE_MANAGER_ID,
          locationIds: [],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Role not found
      await expect(
        service.createStaff(TENANT_A, ACTOR_ID, {
          fullName: 'Test Staff',
          email: 'test@example.com',
          roleId: 'invalid-role',
          locationIds: [],
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is already an active member', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_MANAGER_ID, code: 'MANAGER', name: 'Manager', is_system_role: true }],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // update profile
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'mem-1', status: 'ACTIVE' }] }); // already active

      await expect(
        service.createStaff(TENANT_A, ACTOR_ID, {
          fullName: 'Existing Staff',
          email: 'existing@example.com',
          roleId: ROLE_MANAGER_ID,
          locationIds: [],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStaff', () => {
    it('should update profile, role, status and locations', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'mem-1',
            user_id: 'user-1',
            status: 'ACTIVE',
            created_at: new Date(),
            email: 'priya@example.com',
            full_name: 'Priya Sharma',
            phone: '123',
          },
        ],
      });
      // Update profile
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Update status
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Role lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_MANAGER_ID, code: 'MANAGER', name: 'Manager', is_system_role: true }],
      });
      // Delete old role
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Insert new role
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Audit log
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const updated = await service.updateStaff(TENANT_A, ACTOR_ID, 'mem-1', {
        fullName: 'Priya Sharma Updated',
        status: 'ON_LEAVE',
        roleId: ROLE_MANAGER_ID,
      });

      expect(updated.fullName).toBe('Priya Sharma Updated');
      expect(updated.status).toBe('ON_LEAVE');
    });

    it('should throw NotFoundException if membership does not belong to tenant', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.updateStaff(TENANT_A, ACTOR_ID, 'foreign-mem', { fullName: 'Hacker' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteStaff', () => {
    it('should deactivate staff member', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'mem-1', user_id: 'user-1', full_name: 'Chef Sanjeev', role_code: 'CHEF' }],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // update to INACTIVE
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // audit log

      const res = await service.deleteStaff(TENANT_A, ACTOR_ID, 'mem-1');
      expect(res.success).toBe(true);
    });

    it('should prevent deactivating sole active owner', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'mem-owner', user_id: 'user-owner', full_name: 'Owner', role_code: 'OWNER' }],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 0 }] }); // no other active owners

      await expect(service.deleteStaff(TENANT_A, ACTOR_ID, 'mem-owner')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Roles & Permissions', () => {
    it('should list roles with permissions and staff counts', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: ROLE_MANAGER_ID,
            code: 'MANAGER',
            name: 'Manager',
            description: 'Full operational access',
            is_system_role: true,
            tenant_id: null,
            assigned_staff_count: 5,
            permissions: [{ id: 'p1', code: 'orders.view', module: 'Orders', description: 'View orders' }],
          },
        ],
      });

      const roles = await service.listRoles(TENANT_A);
      expect(roles).toHaveLength(1);
      expect(roles[0].name).toBe('Manager');
      expect(roles[0].assignedStaffCount).toBe(5);
      expect(roles[0].permissions).toHaveLength(1);
    });

    it('should create a custom role with permissions', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: ROLE_CUSTOM_ID,
            code: 'ROLE_SHIFT_SUPERVISOR',
            name: 'Shift Supervisor',
            description: 'Floor leadership',
            is_system_role: false,
            tenant_id: TENANT_A,
            created_at: new Date(),
          },
        ],
      });
      // Permission lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'p1', code: 'orders.view', module: 'Orders', description: 'View orders' }],
      });
      // Role permission insert
      mockDb.query.mockResolvedValueOnce({ rows: [] });
      // Audit log
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const role = await service.createRole(TENANT_A, ACTOR_ID, {
        name: 'Shift Supervisor',
        description: 'Floor leadership',
        permissionIds: ['p1'],
      });

      expect(role.id).toBe(ROLE_CUSTOM_ID);
      expect(role.isSystemRole).toBe(false);
      expect(role.permissions).toHaveLength(1);
    });

    it('should forbid editing or deleting system default roles', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_MANAGER_ID, code: 'MANAGER', name: 'Manager', is_system_role: true, tenant_id: null }],
      });

      await expect(
        service.updateRole(TENANT_A, ACTOR_ID, ROLE_MANAGER_ID, { name: 'Renamed Manager' })
      ).rejects.toThrow(ForbiddenException);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_MANAGER_ID, code: 'MANAGER', name: 'Manager', is_system_role: true, tenant_id: null }],
      });

      await expect(service.deleteRole(TENANT_A, ACTOR_ID, ROLE_MANAGER_ID)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should forbid deleting a custom role that still has staff members assigned', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_CUSTOM_ID, name: 'Shift Lead', is_system_role: false, tenant_id: TENANT_A }],
      });
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: 2 }] }); // 2 staff assigned

      await expect(service.deleteRole(TENANT_A, ACTOR_ID, ROLE_CUSTOM_ID)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('Tenant Isolation (Cross-Tenant negative tests)', () => {
    it('Tenant B cannot access or modify Tenant A staff members', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] }); // Not found because tenant_id doesn't match
      await expect(
        service.updateStaff(TENANT_B, ACTOR_ID, 'mem-of-tenant-a', { fullName: 'Tampered' })
      ).rejects.toThrow(NotFoundException);

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.deleteStaff(TENANT_B, ACTOR_ID, 'mem-of-tenant-a')
      ).rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot update or delete custom roles owned by Tenant A', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_CUSTOM_ID, code: 'CUSTOM', name: 'Custom', is_system_role: false, tenant_id: TENANT_A }],
      });
      await expect(
        service.updateRole(TENANT_B, ACTOR_ID, ROLE_CUSTOM_ID, { name: 'Compromised' })
      ).rejects.toThrow(ForbiddenException);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: ROLE_CUSTOM_ID, code: 'CUSTOM', name: 'Custom', is_system_role: false, tenant_id: TENANT_A }],
      });
      await expect(
        service.deleteRole(TENANT_B, ACTOR_ID, ROLE_CUSTOM_ID)
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
