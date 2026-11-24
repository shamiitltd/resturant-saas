import {
  Controller,
  Get,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireRoles } from '../rbac/decorators.js';

@Controller('v1/owner/analytics')
@UseGuards(RolesGuard)
@RequireRoles('OWNER', 'MANAGER', 'RESTAURANT_OWNER')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(@Req() req: any) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.analyticsService.getOwnerAnalytics(tenantId);
  }

  @Get('sales')
  async getSales(@Req() req: any) {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    return this.analyticsService.getOwnerAnalytics(tenantId);
  }
}
