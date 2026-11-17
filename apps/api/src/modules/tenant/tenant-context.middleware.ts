import { Injectable, NestMiddleware, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../../database/database.service.js';
import type { TenantContextDto } from '@restaurant-saas/contracts';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email?: string;
    }
    interface Request {
      tenantContext?: TenantContextDto;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly db: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.userId;
    if (!userId) {
      return next(); // Unauthenticated requests (e.g. public endpoints) handled by route guards
    }

    const requestedTenantId = req.headers['x-tenant-id'] as string | undefined;
    const requestedLocationId = req.headers['x-location-id'] as string | undefined;

    // Check if user is platform admin
    const adminCheck = await this.db.query<{ id: string }>(
      `SELECT r.id FROM membership_roles mr
       JOIN tenant_memberships tm ON tm.id = mr.membership_id
       JOIN roles r ON r.id = mr.role_id
       WHERE tm.user_id = $1 AND r.code = 'PLATFORM_ADMIN' AND tm.status = 'ACTIVE'`,
      [userId]
    );
    const isPlatformAdmin = adminCheck.rows.length > 0;

    // Resolve tenant membership
    let tenantQuery = `
      SELECT tm.id as membership_id, tm.tenant_id, tm.status
      FROM tenant_memberships tm
      JOIN tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = $1 AND tm.status = 'ACTIVE' AND t.status = 'ACTIVE'
    `;
    const params: any[] = [userId];

    if (requestedTenantId) {
      tenantQuery += ` AND tm.tenant_id = $2`;
      params.push(requestedTenantId);
    }

    const membershipRes = await this.db.query<{
      membership_id: string;
      tenant_id: string;
      status: string;
    }>(tenantQuery, params);

    // If a specific tenant was requested but the user is not a member of it
    if (requestedTenantId && membershipRes.rows.length === 0) {
      if (isPlatformAdmin) {
        // Platform admin can operate across tenants
        req.tenantContext = {
          tenantId: requestedTenantId,
          locationId: requestedLocationId || null,
          actorType: 'PLATFORM_ADMIN',
          actorId: userId,
          membershipId: null,
          roleCodes: ['PLATFORM_ADMIN'],
          permissions: ['platform.manage_tenants'],
          requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
        };
        return next();
      }
      // Negative test verification: Tenant A user cannot access Tenant B!
      throw new ForbiddenException(`Cross-tenant access denied: You are not an active member of tenant ${requestedTenantId}`);
    }

    const activeMembership = membershipRes.rows[0];

    if (activeMembership) {
      // Resolve roles
      const rolesRes = await this.db.query<{ code: string }>(
        `SELECT r.code
         FROM membership_roles mr
         JOIN roles r ON r.id = mr.role_id
         WHERE mr.membership_id = $1`,
        [activeMembership.membership_id]
      );

      // Resolve permissions
      const permsRes = await this.db.query<{ code: string }>(
        `SELECT DISTINCT p.code
         FROM membership_roles mr
         JOIN role_permissions rp ON rp.role_id = mr.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE mr.membership_id = $1`,
        [activeMembership.membership_id]
      );

      // Verify location scope if location requested
      let resolvedLocationId: string | null = null;
      if (requestedLocationId) {
        const locCheck = await this.db.query(
          `SELECT location_id FROM location_memberships
           WHERE membership_id = $1 AND location_id = $2`,
          [activeMembership.membership_id, requestedLocationId]
        );
        if (locCheck.rows.length === 0 && !isPlatformAdmin) {
          throw new ForbiddenException(`Location access denied: You do not have permissions for location ${requestedLocationId}`);
        }
        resolvedLocationId = requestedLocationId;
      }

      req.tenantContext = {
        tenantId: activeMembership.tenant_id,
        locationId: resolvedLocationId,
        actorType: isPlatformAdmin ? 'PLATFORM_ADMIN' : 'TENANT_USER',
        actorId: userId,
        membershipId: activeMembership.membership_id,
        roleCodes: rolesRes.rows.map((r) => r.code),
        permissions: permsRes.rows.map((p) => p.code),
        requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      };
    }

    next();
  }
}
