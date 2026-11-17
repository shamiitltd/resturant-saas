import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DatabaseService } from '../../database/database.service.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireRoles } from '../rbac/decorators.js';

@Controller('v1/platform')
@UseGuards(AuthGuard('supabase-jwt'), RolesGuard)
export class PlatformController {
  constructor(private readonly db: DatabaseService) {}

  @Get('tenants')
  @RequireRoles('PLATFORM_ADMIN')
  async listTenants(@Req() req: any) {
    const res = await this.db.query(
      `SELECT t.id, t.slug, t.name, t.status, t.created_at,
              COUNT(l.id) as location_count
       FROM tenants t
       LEFT JOIN locations l ON l.tenant_id = t.id
       GROUP BY t.id, t.slug, t.name, t.status, t.created_at
       ORDER BY t.created_at DESC`
    );
    return res.rows;
  }
}
