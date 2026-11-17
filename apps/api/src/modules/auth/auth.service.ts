import { Injectable, BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { RegisterOwnerRequestDto, AuthMeResponseDto, ActiveMembershipDto, UserProfileDto } from '@restaurant-saas/contracts';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Resolve user profile, memberships, roles, permissions and locations
   */
  async getMe(userId: string): Promise<AuthMeResponseDto> {
    const userRes = await this.db.query<UserProfileDto>(
      `SELECT id, email, full_name as "fullName", phone, avatar_url as "avatarUrl"
       FROM profiles WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User profile not found');
    }
    const user = userRes.rows[0];

    // Fetch active memberships
    const membershipsRes = await this.db.query<{
      membership_id: string;
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
      membership_status: string;
    }>(
      `SELECT tm.id as membership_id, t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, tm.status as membership_status
       FROM tenant_memberships tm
       JOIN tenants t ON t.id = tm.tenant_id
       WHERE tm.user_id = $1 AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'`,
      [userId]
    );

    const activeMemberships: ActiveMembershipDto[] = [];
    let isPlatformAdmin = false;

    for (const mem of membershipsRes.rows) {
      // Roles
      const rolesRes = await this.db.query<{
        id: string;
        code: string;
        name: string;
      }>(
        `SELECT r.id, r.code, r.name
         FROM membership_roles mr
         JOIN roles r ON r.id = mr.role_id
         WHERE mr.membership_id = $1`,
        [mem.membership_id]
      );

      if (rolesRes.rows.some((r) => r.code === 'PLATFORM_ADMIN')) {
        isPlatformAdmin = true;
      }

      // Permissions
      const permissionsRes = await this.db.query<{ code: string }>(
        `SELECT DISTINCT p.code
         FROM membership_roles mr
         JOIN role_permissions rp ON rp.role_id = mr.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE mr.membership_id = $1`,
        [mem.membership_id]
      );

      // Locations
      const locationsRes = await this.db.query<{
        id: string;
        code: string;
        name: string;
        is_primary: boolean;
      }>(
        `SELECT l.id, l.code, l.name, lm.is_primary
         FROM location_memberships lm
         JOIN locations l ON l.id = lm.location_id
         WHERE lm.membership_id = $1 AND l.status = 'ACTIVE'`,
        [mem.membership_id]
      );

      activeMemberships.push({
        membershipId: mem.membership_id,
        tenantId: mem.tenant_id,
        tenantSlug: mem.tenant_slug,
        tenantName: mem.tenant_name,
        status: mem.membership_status,
        roles: rolesRes.rows,
        permissions: permissionsRes.rows.map((p) => p.code),
        locations: locationsRes.rows.map((l) => ({
          id: l.id,
          code: l.code,
          name: l.name,
          isPrimary: l.is_primary,
        })),
      });
    }

    return {
      user,
      isPlatformAdmin,
      memberships: activeMemberships,
      activeTenantId: activeMemberships[0]?.tenantId,
      activeLocationId: activeMemberships[0]?.locations[0]?.id,
    };
  }

  /**
   * Atomic Owner & Tenant Provisioning
   */
  async registerOwner(userId: string, dto: RegisterOwnerRequestDto): Promise<AuthMeResponseDto> {
    const slug = dto.restaurantSlug.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new BadRequestException('Restaurant slug must contain only lowercase alphanumeric characters and hyphens');
    }

    return await this.db.transaction(async (client) => {
      // 1. Check slug uniqueness
      const slugCheck = await client.query('SELECT id FROM tenants WHERE LOWER(slug) = $1', [slug]);
      if (slugCheck.rows.length > 0) {
        throw new ConflictException(`Restaurant URL slug '${slug}' is already in use`);
      }

      // 2. Insert or update profile
      await client.query(
        `INSERT INTO profiles (id, email, full_name, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone`,
        [userId, dto.email.toLowerCase().trim(), dto.fullName, dto.phone || null]
      );

      // 3. Insert Tenant
      const tenantRes = await client.query<{ id: string }>(
        `INSERT INTO tenants (slug, name, status)
         VALUES ($1, $2, 'ACTIVE')
         RETURNING id`,
        [slug, dto.restaurantName.trim()]
      );
      const tenantId = tenantRes.rows[0].id;

      // 4. Insert Primary Location
      const locationRes = await client.query<{ id: string }>(
        `INSERT INTO locations (tenant_id, code, name, timezone, service_mode, status)
         VALUES ($1, 'main-outlet', $2, $3, 'TABLE_SERVICE', 'ACTIVE')
         RETURNING id`,
        [tenantId, dto.primaryOutletName.trim() || `${dto.restaurantName} (Main)`, dto.timezone || 'UTC']
      );
      const locationId = locationRes.rows[0].id;

      // 5. Insert Tenant Membership
      const membershipRes = await client.query<{ id: string }>(
        `INSERT INTO tenant_memberships (tenant_id, user_id, status)
         VALUES ($1, $2, 'ACTIVE')
         RETURNING id`,
        [tenantId, userId]
      );
      const membershipId = membershipRes.rows[0].id;

      // 6. Find system OWNER role
      const ownerRoleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE code = 'OWNER' AND is_system_role = true LIMIT 1`
      );
      if (ownerRoleRes.rows.length === 0) {
        throw new Error('System OWNER role not initialized');
      }
      const ownerRoleId = ownerRoleRes.rows[0].id;

      // 7. Assign OWNER role
      await client.query(
        `INSERT INTO membership_roles (membership_id, role_id)
         VALUES ($1, $2)`,
        [membershipId, ownerRoleId]
      );

      // 8. Assign Location Membership
      await client.query(
        `INSERT INTO location_memberships (membership_id, location_id, is_primary)
         VALUES ($1, $2, true)`,
        [membershipId, locationId]
      );

      // 9. Record Audit Log
      await client.query(
        `INSERT INTO audit_logs (tenant_id, location_id, actor_id, actor_type, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, 'TENANT_USER', 'TENANT_REGISTERED', 'tenant', $1, $4)`,
        [tenantId, locationId, userId, JSON.stringify({ slug, restaurantName: dto.restaurantName })]
      );

      return this.getMe(userId);
    });
  }

  /**
   * Select active outlet context
   */
  async selectOutlet(userId: string, membershipId: string, locationId: string) {
    const valid = await this.db.query(
      `SELECT lm.id
       FROM location_memberships lm
       JOIN tenant_memberships tm ON tm.id = lm.membership_id
       WHERE tm.id = $1 AND tm.user_id = $2 AND lm.location_id = $3 AND tm.status = 'ACTIVE'`,
      [membershipId, userId, locationId]
    );

    if (valid.rows.length === 0) {
      throw new UnauthorizedException('You do not have access to this location/outlet');
    }

    return {
      success: true,
      membershipId,
      locationId,
    };
  }
}
