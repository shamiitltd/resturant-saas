import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DatabaseService } from '../../database/database.service.js';

@Controller('v1/tenants')
@UseGuards(AuthGuard('supabase-jwt'))
export class TenantController {
  constructor(private readonly db: DatabaseService) {}

  @Get('current')
  async getCurrentTenant(@Req() req: any) {
    const tenantContext = req.tenantContext;
    if (!tenantContext) {
      throw new ForbiddenException('No active tenant context resolved');
    }

    const tenantRes = await this.db.query(
      `SELECT id, slug, name, status, branding, created_at, updated_at
       FROM tenants WHERE id = $1`,
      [tenantContext.tenantId]
    );

    return {
      tenant: tenantRes.rows[0],
      context: tenantContext,
    };
  }

  @Get('current/locations')
  async getLocations(@Req() req: any) {
    const tenantContext = req.tenantContext;
    if (!tenantContext) {
      throw new ForbiddenException('No active tenant context resolved');
    }

    // Secure query strictly scoping to tenantContext.tenantId
    const locationsRes = await this.db.query(
      `SELECT id, code, name, timezone, service_mode, status, address
       FROM locations
       WHERE tenant_id = $1 AND status = 'ACTIVE'
       ORDER BY code ASC`,
      [tenantContext.tenantId]
    );

    return locationsRes.rows;
  }
}
