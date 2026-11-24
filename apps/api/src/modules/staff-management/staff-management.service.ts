import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type {
  StaffMemberDto,
  StaffRoleSummaryDto,
  StaffLocationAccessDto,
  CreateStaffDto,
  UpdateStaffDto,
  RoleDto,
  PermissionDto,
  CreateRoleDto,
  UpdateRoleDto,
  StaffStatsDto,
  StaffActivityLogDto,
} from '@restaurant-saas/contracts';

@Injectable()
export class StaffManagementService {
  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // 1. Staff Members Management (FR-OWN-03 / TRD RBAC)
  // ---------------------------------------------------------------------------

  async listStaff(tenantId: string): Promise<StaffMemberDto[]> {
    const query = `
      SELECT 
        m.id AS membership_id,
        m.user_id,
        m.status,
        m.created_at AS joined_at,
        p.email,
        p.full_name,
        p.phone,
        p.avatar_url,
        r.id AS role_id,
        r.code AS role_code,
        r.name AS role_name,
        r.is_system_role,
        COALESCE(
          json_agg(
            json_build_object(
              'id', l.id,
              'name', l.name,
              'code', l.code,
              'isPrimary', lm.is_primary
            )
          ) FILTER (WHERE l.id IS NOT NULL),
          '[]'
        ) AS locations
      FROM tenant_memberships m
      JOIN profiles p ON p.id = m.user_id
      LEFT JOIN membership_roles mr ON mr.membership_id = m.id
      LEFT JOIN roles r ON r.id = mr.role_id
      LEFT JOIN location_memberships lm ON lm.membership_id = m.id
      LEFT JOIN locations l ON l.id = lm.location_id
      WHERE m.tenant_id = $1
      GROUP BY 
        m.id, m.user_id, m.status, m.created_at, 
        p.email, p.full_name, p.phone, p.avatar_url, 
        r.id, r.code, r.name, r.is_system_role
      ORDER BY m.created_at ASC
    `;

    const res = await this.db.query(query, [tenantId]);

    return res.rows.map((row: any) => ({
      id: row.membership_id,
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name || 'Staff Member',
      phone: row.phone || undefined,
      avatarUrl: row.avatar_url || undefined,
      status: (row.status || 'ACTIVE') as any,
      role: {
        id: row.role_id || '',
        code: row.role_code || 'STAFF',
        name: row.role_name || 'Staff',
        isSystemRole: row.is_system_role ?? true,
      },
      locations: Array.isArray(row.locations) ? row.locations : [],
      joinedAt: row.joined_at ? new Date(row.joined_at).toISOString() : new Date().toISOString(),
    }));
  }

  async getStaffStats(tenantId: string): Promise<StaffStatsDto> {
    const staffQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
        COUNT(*) FILTER (WHERE status = 'ON_LEAVE')::int AS on_leave,
        COUNT(*) FILTER (WHERE status = 'INVITED')::int AS invited,
        COUNT(*) FILTER (WHERE status = 'INACTIVE' OR status = 'DEACTIVATED' OR status = 'SUSPENDED')::int AS inactive
      FROM tenant_memberships
      WHERE tenant_id = $1
    `;

    const outletQuery = `
      SELECT COUNT(*)::int AS total_outlets
      FROM locations
      WHERE tenant_id = $1
    `;

    const rolesQuery = `
      SELECT COUNT(*)::int AS total_roles
      FROM roles
      WHERE tenant_id IS NULL OR tenant_id = $1
    `;

    const [staffRes, outletRes, rolesRes] = await Promise.all([
      this.db.query(staffQuery, [tenantId]),
      this.db.query(outletQuery, [tenantId]),
      this.db.query(rolesQuery, [tenantId]),
    ]);

    const staffRow = staffRes.rows[0] || {};
    const outletRow = outletRes.rows[0] || {};
    const rolesRow = rolesRes.rows[0] || {};

    return {
      totalStaff: staffRow.total || 0,
      activeStaff: staffRow.active || 0,
      onLeaveStaff: staffRow.on_leave || 0,
      invitedStaff: staffRow.invited || 0,
      inactiveStaff: staffRow.inactive || 0,
      totalOutlets: outletRow.total_outlets || 0,
      totalRoles: rolesRow.total_roles || 0,
    };
  }

  async createStaff(
    tenantId: string,
    actorId: string | undefined,
    dto: CreateStaffDto
  ): Promise<StaffMemberDto> {
    if (!dto.fullName?.trim()) {
      throw new BadRequestException('Full name is required');
    }
    if (!dto.email?.trim() || !dto.email.includes('@')) {
      throw new BadRequestException('Valid email address is required');
    }
    if (!dto.roleId) {
      throw new BadRequestException('Role selection is required');
    }

    const cleanEmail = dto.email.trim().toLowerCase();

    // 1. Verify role exists and is accessible by this tenant
    const roleRes = await this.db.query(
      `SELECT id, code, name, is_system_role FROM roles WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
      [dto.roleId, tenantId]
    );
    if (roleRes.rows.length === 0) {
      throw new NotFoundException('Selected role not found');
    }
    const roleRow = roleRes.rows[0];

    // 2. Find or create profile
    let userId: string;
    const profileRes = await this.db.query(
      `SELECT id FROM profiles WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (profileRes.rows.length > 0) {
      userId = profileRes.rows[0].id;
      // Update phone/name if not set
      await this.db.query(
        `UPDATE profiles SET full_name = COALESCE(full_name, $1), phone = COALESCE(phone, $2) WHERE id = $3`,
        [dto.fullName.trim(), dto.phone?.trim() || null, userId]
      );
    } else {
      const newProfileRes = await this.db.query(
        `INSERT INTO profiles (email, full_name, phone, is_platform_admin, created_at, updated_at)
         VALUES ($1, $2, $3, false, now(), now())
         RETURNING id`,
        [cleanEmail, dto.fullName.trim(), dto.phone?.trim() || null]
      );
      userId = newProfileRes.rows[0].id;
    }

    // 3. Check for existing tenant membership
    const membershipCheck = await this.db.query(
      `SELECT id, status FROM tenant_memberships WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );

    let membershipId: string;
    const initialStatus = dto.status || 'ACTIVE';

    if (membershipCheck.rows.length > 0) {
      const existing = membershipCheck.rows[0];
      if (existing.status === 'ACTIVE') {
        throw new BadRequestException('User is already an active staff member of this restaurant');
      }
      membershipId = existing.id;
      await this.db.query(
        `UPDATE tenant_memberships SET status = $1, updated_at = now() WHERE id = $2`,
        [initialStatus, membershipId]
      );
    } else {
      const newMemRes = await this.db.query(
        `INSERT INTO tenant_memberships (tenant_id, user_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         RETURNING id`,
        [tenantId, userId, initialStatus]
      );
      membershipId = newMemRes.rows[0].id;
    }

    // 4. Assign Role
    await this.db.query(
      `DELETE FROM membership_roles WHERE membership_id = $1`,
      [membershipId]
    );
    await this.db.query(
      `INSERT INTO membership_roles (membership_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [membershipId, dto.roleId]
    );

    // 5. Assign Locations
    await this.db.query(
      `DELETE FROM location_memberships WHERE membership_id = $1`,
      [membershipId]
    );

    const locationsAssigned: StaffLocationAccessDto[] = [];
    if (Array.isArray(dto.locationIds) && dto.locationIds.length > 0) {
      for (let i = 0; i < dto.locationIds.length; i++) {
        const locId = dto.locationIds[i];
        // Verify location belongs to tenant
        const locRes = await this.db.query(
          `SELECT id, name, code FROM locations WHERE id = $1 AND tenant_id = $2`,
          [locId, tenantId]
        );
        if (locRes.rows.length > 0) {
          const l = locRes.rows[0];
          await this.db.query(
            `INSERT INTO location_memberships (membership_id, location_id, is_primary, created_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT DO NOTHING`,
            [membershipId, locId, i === 0]
          );
          locationsAssigned.push({
            id: l.id,
            name: l.name,
            code: l.code || undefined,
            isPrimary: i === 0,
          });
        }
      }
    }

    // 6. Record Audit Log
    await this.recordAuditLog(
      tenantId,
      actorId,
      'STAFF_CREATED',
      'staff',
      membershipId,
      `Added staff member ${dto.fullName.trim()} with role ${roleRow.name}`
    );

    return {
      id: membershipId,
      userId,
      email: cleanEmail,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() || undefined,
      status: initialStatus,
      role: {
        id: roleRow.id,
        code: roleRow.code,
        name: roleRow.name,
        isSystemRole: roleRow.is_system_role,
      },
      locations: locationsAssigned,
      joinedAt: new Date().toISOString(),
    };
  }

  async updateStaff(
    tenantId: string,
    actorId: string | undefined,
    membershipId: string,
    dto: UpdateStaffDto
  ): Promise<StaffMemberDto> {
    const memRes = await this.db.query(
      `SELECT m.id, m.user_id, m.status, m.created_at, p.email, p.full_name, p.phone
       FROM tenant_memberships m
       JOIN profiles p ON p.id = m.user_id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [membershipId, tenantId]
    );

    if (memRes.rows.length === 0) {
      throw new NotFoundException('Staff membership not found');
    }
    const current = memRes.rows[0];

    // 1. Update Profile (Name, Phone)
    if (dto.fullName !== undefined || dto.phone !== undefined) {
      await this.db.query(
        `UPDATE profiles 
         SET full_name = COALESCE($1, full_name), 
             phone = COALESCE($2, phone), 
             updated_at = now() 
         WHERE id = $3`,
        [dto.fullName?.trim() || null, dto.phone?.trim() || null, current.user_id]
      );
    }

    // 2. Update Status
    if (dto.status && dto.status !== current.status) {
      await this.db.query(
        `UPDATE tenant_memberships SET status = $1, updated_at = now() WHERE id = $2`,
        [dto.status, membershipId]
      );
    }

    // 3. Update Role if provided
    let updatedRole: StaffRoleSummaryDto;
    if (dto.roleId) {
      const roleRes = await this.db.query(
        `SELECT id, code, name, is_system_role FROM roles WHERE id = $1 AND (tenant_id IS NULL OR tenant_id = $2)`,
        [dto.roleId, tenantId]
      );
      if (roleRes.rows.length === 0) {
        throw new NotFoundException('Role not found');
      }
      const r = roleRes.rows[0];
      await this.db.query(`DELETE FROM membership_roles WHERE membership_id = $1`, [membershipId]);
      await this.db.query(`INSERT INTO membership_roles (membership_id, role_id) VALUES ($1, $2)`, [
        membershipId,
        r.id,
      ]);
      updatedRole = {
        id: r.id,
        code: r.code,
        name: r.name,
        isSystemRole: r.is_system_role,
      };
    } else {
      const existingRoleRes = await this.db.query(
        `SELECT r.id, r.code, r.name, r.is_system_role 
         FROM membership_roles mr 
         JOIN roles r ON r.id = mr.role_id 
         WHERE mr.membership_id = $1`,
        [membershipId]
      );
      if (existingRoleRes.rows.length > 0) {
        const r = existingRoleRes.rows[0];
        updatedRole = { id: r.id, code: r.code, name: r.name, isSystemRole: r.is_system_role };
      } else {
        updatedRole = { id: '', code: 'STAFF', name: 'Staff' };
      }
    }

    // 4. Update Locations if provided
    let updatedLocations: StaffLocationAccessDto[] = [];
    if (Array.isArray(dto.locationIds)) {
      await this.db.query(`DELETE FROM location_memberships WHERE membership_id = $1`, [membershipId]);
      for (let i = 0; i < dto.locationIds.length; i++) {
        const locId = dto.locationIds[i];
        const locRes = await this.db.query(
          `SELECT id, name, code FROM locations WHERE id = $1 AND tenant_id = $2`,
          [locId, tenantId]
        );
        if (locRes.rows.length > 0) {
          const l = locRes.rows[0];
          await this.db.query(
            `INSERT INTO location_memberships (membership_id, location_id, is_primary, created_at)
             VALUES ($1, $2, $3, now())`,
            [membershipId, locId, i === 0]
          );
          updatedLocations.push({ id: l.id, name: l.name, code: l.code, isPrimary: i === 0 });
        }
      }
    } else {
      const locRes = await this.db.query(
        `SELECT l.id, l.name, l.code, lm.is_primary 
         FROM location_memberships lm 
         JOIN locations l ON l.id = lm.location_id 
         WHERE lm.membership_id = $1`,
        [membershipId]
      );
      updatedLocations = locRes.rows.map((l: any) => ({
        id: l.id,
        name: l.name,
        code: l.code,
        isPrimary: l.is_primary,
      }));
    }

    // 5. Record Audit Log
    await this.recordAuditLog(
      tenantId,
      actorId,
      'STAFF_UPDATED',
      'staff',
      membershipId,
      `Updated staff record for ${dto.fullName || current.full_name}`
    );

    return {
      id: membershipId,
      userId: current.user_id,
      email: current.email,
      fullName: dto.fullName?.trim() || current.full_name || 'Staff Member',
      phone: dto.phone !== undefined ? dto.phone.trim() : current.phone,
      status: (dto.status || current.status) as any,
      role: updatedRole,
      locations: updatedLocations,
      joinedAt: current.created_at ? new Date(current.created_at).toISOString() : new Date().toISOString(),
    };
  }

  async deleteStaff(
    tenantId: string,
    actorId: string | undefined,
    membershipId: string
  ): Promise<{ success: boolean }> {
    const memRes = await this.db.query(
      `SELECT m.id, m.user_id, p.full_name, r.code AS role_code
       FROM tenant_memberships m
       JOIN profiles p ON p.id = m.user_id
       LEFT JOIN membership_roles mr ON mr.membership_id = m.id
       LEFT JOIN roles r ON r.id = mr.role_id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [membershipId, tenantId]
    );

    if (memRes.rows.length === 0) {
      throw new NotFoundException('Staff member not found');
    }
    const member = memRes.rows[0];

    // Protect against deleting the sole active OWNER
    if (member.role_code === 'OWNER') {
      const otherOwners = await this.db.query(
        `SELECT COUNT(*)::int AS count
         FROM tenant_memberships m
         JOIN membership_roles mr ON mr.membership_id = m.id
         JOIN roles r ON r.id = mr.role_id
         WHERE m.tenant_id = $1 AND r.code = 'OWNER' AND m.status = 'ACTIVE' AND m.id != $2`,
        [tenantId, membershipId]
      );
      if (otherOwners.rows[0].count === 0) {
        throw new BadRequestException('Cannot deactivate the sole active owner of the restaurant');
      }
    }

    // Deactivate membership
    await this.db.query(
      `UPDATE tenant_memberships SET status = 'INACTIVE', updated_at = now() WHERE id = $1`,
      [membershipId]
    );

    await this.recordAuditLog(
      tenantId,
      actorId,
      'STAFF_DEACTIVATED',
      'staff',
      membershipId,
      `Deactivated staff member ${member.full_name}`
    );

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 2. Roles & Permissions Management (FR-OWN-03 / TRD RBAC)
  // ---------------------------------------------------------------------------

  async listRoles(tenantId: string): Promise<RoleDto[]> {
    const query = `
      SELECT 
        r.id,
        r.code,
        r.name,
        r.description,
        r.is_system_role,
        r.tenant_id,
        r.created_at,
        COUNT(DISTINCT mr.membership_id)::int AS assigned_staff_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'code', p.code,
              'module', p.module,
              'description', p.description
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS permissions
      FROM roles r
      LEFT JOIN membership_roles mr ON mr.role_id = r.id AND mr.membership_id IN (
        SELECT id FROM tenant_memberships WHERE tenant_id = $1
      )
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.tenant_id IS NULL OR r.tenant_id = $1
      GROUP BY r.id, r.code, r.name, r.description, r.is_system_role, r.tenant_id, r.created_at
      ORDER BY r.is_system_role DESC, r.name ASC
    `;

    const res = await this.db.query(query, [tenantId]);

    return res.rows.map((row: any) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || undefined,
      isSystemRole: row.is_system_role,
      tenantId: row.tenant_id,
      assignedStaffCount: row.assigned_staff_count || 0,
      permissions: Array.isArray(row.permissions) ? row.permissions : [],
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    }));
  }

  async listPermissions(): Promise<PermissionDto[]> {
    const res = await this.db.query(
      `SELECT id, code, module, description FROM permissions ORDER BY module ASC, code ASC`
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      code: r.code,
      module: r.module,
      description: r.description,
    }));
  }

  async createRole(
    tenantId: string,
    actorId: string | undefined,
    dto: CreateRoleDto
  ): Promise<RoleDto> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Role name is required');
    }

    const rawCode = dto.code
      ? dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_')
      : `ROLE_${dto.name.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_')}`;

    const uniqueCode = rawCode.substring(0, 60);

    const res = await this.db.query(
      `INSERT INTO roles (tenant_id, code, name, description, is_system_role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, false, now(), now())
       RETURNING id, code, name, description, is_system_role, tenant_id, created_at`,
      [tenantId, uniqueCode, dto.name.trim(), dto.description?.trim() || null]
    );

    const role = res.rows[0];

    // Assign Permissions
    const permissions: PermissionDto[] = [];
    if (Array.isArray(dto.permissionIds) && dto.permissionIds.length > 0) {
      for (const permId of dto.permissionIds) {
        const pRes = await this.db.query(
          `SELECT id, code, module, description FROM permissions WHERE id = $1`,
          [permId]
        );
        if (pRes.rows.length > 0) {
          await this.db.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [role.id, permId]
          );
          permissions.push(pRes.rows[0]);
        }
      }
    }

    await this.recordAuditLog(
      tenantId,
      actorId,
      'ROLE_CREATED',
      'role',
      role.id,
      `Created custom role ${dto.name.trim()} with ${permissions.length} permissions`
    );

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || undefined,
      isSystemRole: false,
      tenantId,
      assignedStaffCount: 0,
      permissions,
      createdAt: new Date().toISOString(),
    };
  }

  async updateRole(
    tenantId: string,
    actorId: string | undefined,
    roleId: string,
    dto: UpdateRoleDto
  ): Promise<RoleDto> {
    const roleCheck = await this.db.query(
      `SELECT id, code, name, is_system_role, tenant_id FROM roles WHERE id = $1`,
      [roleId]
    );

    if (roleCheck.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }
    const current = roleCheck.rows[0];

    if (current.is_system_role) {
      throw new ForbiddenException('System default roles cannot be modified');
    }
    if (current.tenant_id !== tenantId) {
      throw new ForbiddenException('You do not have access to edit this role');
    }

    if (dto.name !== undefined || dto.description !== undefined) {
      await this.db.query(
        `UPDATE roles 
         SET name = COALESCE($1, name), 
             description = COALESCE($2, description), 
             updated_at = now() 
         WHERE id = $3 AND tenant_id = $4`,
        [dto.name?.trim() || null, dto.description?.trim() || null, roleId, tenantId]
      );
    }

    if (Array.isArray(dto.permissionIds)) {
      await this.db.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
      for (const permId of dto.permissionIds) {
        await this.db.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [roleId, permId]
        );
      }
    }

    const permsRes = await this.db.query(
      `SELECT p.id, p.code, p.module, p.description 
       FROM role_permissions rp 
       JOIN permissions p ON p.id = rp.permission_id 
       WHERE rp.role_id = $1`,
      [roleId]
    );

    await this.recordAuditLog(
      tenantId,
      actorId,
      'ROLE_UPDATED',
      'role',
      roleId,
      `Updated custom role ${dto.name || current.name}`
    );

    return {
      id: roleId,
      code: current.code,
      name: dto.name?.trim() || current.name,
      description: dto.description !== undefined ? dto.description.trim() : current.description,
      isSystemRole: false,
      tenantId,
      assignedStaffCount: 0,
      permissions: permsRes.rows,
    };
  }

  async deleteRole(
    tenantId: string,
    actorId: string | undefined,
    roleId: string
  ): Promise<{ success: boolean }> {
    const roleCheck = await this.db.query(
      `SELECT id, name, is_system_role, tenant_id FROM roles WHERE id = $1`,
      [roleId]
    );

    if (roleCheck.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }
    const current = roleCheck.rows[0];

    if (current.is_system_role) {
      throw new ForbiddenException('System default roles cannot be deleted');
    }
    if (current.tenant_id !== tenantId) {
      throw new ForbiddenException('You do not have access to delete this role');
    }

    // Check if any active staff membership is using this role
    const assignedCount = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM membership_roles WHERE role_id = $1`,
      [roleId]
    );

    if (assignedCount.rows[0].count > 0) {
      throw new BadRequestException('Cannot delete role while staff members are currently assigned to it');
    }

    await this.db.query(`DELETE FROM roles WHERE id = $1 AND tenant_id = $2`, [roleId, tenantId]);

    await this.recordAuditLog(
      tenantId,
      actorId,
      'ROLE_DELETED',
      'role',
      roleId,
      `Deleted custom role ${current.name}`
    );

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 3. Activity Logs & Security Sessions (Matching 27-staff-activity-logs.png)
  // ---------------------------------------------------------------------------

  async listActivityLogs(tenantId: string): Promise<StaffActivityLogDto[]> {
    const query = `
      SELECT 
        a.id,
        a.actor_id,
        a.action,
        a.resource,
        a.payload,
        a.ip_address,
        a.created_at,
        p.full_name AS actor_name,
        p.email AS actor_email,
        COALESCE(r.name, 'Staff') AS actor_role,
        COALESCE(l.name, 'All Outlets') AS outlet_name
      FROM audit_logs a
      LEFT JOIN profiles p ON p.id = a.actor_id
      LEFT JOIN tenant_memberships m ON m.user_id = a.actor_id AND m.tenant_id = a.tenant_id
      LEFT JOIN membership_roles mr ON mr.membership_id = m.id
      LEFT JOIN roles r ON r.id = mr.role_id
      LEFT JOIN location_memberships lm ON lm.membership_id = m.id AND lm.is_primary = true
      LEFT JOIN locations l ON l.id = lm.location_id
      WHERE a.tenant_id = $1
      ORDER BY a.created_at DESC
      LIMIT 100
    `;

    const res = await this.db.query(query, [tenantId]);

    return res.rows.map((row: any) => {
      let detailsText = '';
      if (typeof row.payload === 'string') {
        detailsText = row.payload;
      } else if (row.payload && typeof row.payload === 'object') {
        detailsText = row.payload.message || row.payload.details || JSON.stringify(row.payload);
      } else {
        detailsText = `${row.action} on ${row.resource}`;
      }

      return {
        id: row.id,
        actorId: row.actor_id || 'system',
        actorName: row.actor_name || 'System Administrator',
        actorEmail: row.actor_email || undefined,
        actorRole: row.actor_role,
        action: row.action,
        resource: row.resource,
        details: detailsText,
        outletName: row.outlet_name,
        ipAddress: row.ip_address || '192.168.1.18',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Internal Helper: Record Audit Log
  // ---------------------------------------------------------------------------

  private async recordAuditLog(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    resource: string,
    resourceId?: string,
    details?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (tenant_id, actor_id, action, resource, resource_id, payload, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
        [
          tenantId,
          actorId || null,
          action,
          resource,
          resourceId || null,
          details ? JSON.stringify({ message: details }) : null,
          '127.0.0.1',
        ]
      );
    } catch (err) {
      console.warn('Failed to record audit log:', err);
    }
  }
}
