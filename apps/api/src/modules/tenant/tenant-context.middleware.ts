import { Injectable, NestMiddleware, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
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

interface CachedContext {
  context: TenantContextDto;
  expiresAt: number;
}

const contextCache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 20_000; // 20-second memory cache to eliminate database lag during 5-second polling loops

/**
 * Reusable helper to resolve authoritative TenantContext from Request
 */
export async function resolveTenantContextFromRequest(
  db: DatabaseService,
  req: Request
): Promise<TenantContextDto | null> {
  // 1. Resolve userId from req.user (Guard) or extract from Bearer JWT (Middleware)
  let userId = req.user?.userId;
  if (!userId && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7);
      try {
        const parts = rawToken.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (payload && payload.sub) {
            userId = payload.sub;
          }
        }
      } catch {}
    }
  }

  if (!userId) {
    return null;
  }

  const requestedTenantId = req.headers['x-tenant-id'] as string | undefined;
  const requestedLocationId = req.headers['x-location-id'] as string | undefined;
  const cacheKey = `${userId}:${requestedTenantId || ''}:${requestedLocationId || ''}`;

  const cached = contextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.context,
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    };
  }

  // 1. Resolve tenant membership, roles, and permissions in a single optimized query
  let query = `
    SELECT
      tm.id as membership_id,
      tm.tenant_id,
      tm.status,
      COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as role_codes,
      COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') as permissions
    FROM tenant_memberships tm
    JOIN tenants t ON t.id = tm.tenant_id AND t.status = 'ACTIVE'
    LEFT JOIN membership_roles mr ON mr.membership_id = tm.id
    LEFT JOIN roles r ON r.id = mr.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE tm.user_id = $1 AND tm.status = 'ACTIVE'
  `;
  const params: any[] = [userId];

  if (requestedTenantId) {
    query += ` AND tm.tenant_id = $2`;
    params.push(requestedTenantId);
  }

  query += ` GROUP BY tm.id, tm.tenant_id, tm.status`;

  const membershipRes = await db.query<{
    membership_id: string;
    tenant_id: string;
    status: string;
    role_codes: string[];
    permissions: string[];
  }>(query, params);

  // If a specific tenant was requested but the user is not a direct member of it, check if platform admin
  if (requestedTenantId && membershipRes.rows.length === 0) {
    const adminCheck = await db.query<{ id: string }>(
      `SELECT r.id FROM membership_roles mr
       JOIN tenant_memberships tm ON tm.id = mr.membership_id
       JOIN roles r ON r.id = mr.role_id
       WHERE tm.user_id = $1 AND r.code = 'PLATFORM_ADMIN' AND tm.status = 'ACTIVE'`,
      [userId]
    );
    if (adminCheck.rows.length > 0) {
      const adminCtx: TenantContextDto = {
        tenantId: requestedTenantId,
        locationId: requestedLocationId || null,
        actorType: 'PLATFORM_ADMIN',
        actorId: userId,
        membershipId: null,
        roleCodes: ['PLATFORM_ADMIN'],
        permissions: ['platform.manage_tenants'],
        requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      };
      contextCache.set(cacheKey, { context: adminCtx, expiresAt: Date.now() + CACHE_TTL_MS });
      return adminCtx;
    }
    throw new ForbiddenException(`Cross-tenant access denied: You are not an active member of tenant ${requestedTenantId}`);
  }

  const activeMembership = membershipRes.rows[0];

  if (activeMembership) {
    const isPlatformAdmin = activeMembership.role_codes.includes('PLATFORM_ADMIN');

    // Verify location scope if location requested
    let resolvedLocationId: string | null = null;
    if (requestedLocationId) {
      const locCheck = await db.query(
        `SELECT location_id FROM location_memberships
         WHERE membership_id = $1 AND location_id = $2`,
        [activeMembership.membership_id, requestedLocationId]
      );
      if (locCheck.rows.length === 0 && !isPlatformAdmin) {
        throw new ForbiddenException(`Location access denied: You do not have permissions for location ${requestedLocationId}`);
      }
      resolvedLocationId = requestedLocationId;
    }

    const resolvedCtx: TenantContextDto = {
      tenantId: activeMembership.tenant_id,
      locationId: resolvedLocationId,
      actorType: isPlatformAdmin ? 'PLATFORM_ADMIN' : 'TENANT_USER',
      actorId: userId,
      membershipId: activeMembership.membership_id,
      roleCodes: activeMembership.role_codes,
      permissions: activeMembership.permissions,
      requestId: (req.headers['x-request-id'] as string) || crypto.randomUUID(),
    };

    if (contextCache.size > 1000) contextCache.clear();
    contextCache.set(cacheKey, { context: resolvedCtx, expiresAt: Date.now() + CACHE_TTL_MS });

    return resolvedCtx;
  }

  return null;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly db: DatabaseService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const context = await resolveTenantContextFromRequest(this.db, req);
      if (context) {
        req.tenantContext = context;
      }
    } catch (err) {
      return next(err);
    }

    next();
  }
}
