import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StaffManagementService } from './staff-management.service.js';
import { RolesGuard } from '../rbac/roles.guard.js';
import { RequireRoles } from '../rbac/decorators.js';
import type {
  CreateStaffDto,
  UpdateStaffDto,
  CreateRoleDto,
  UpdateRoleDto,
} from '@restaurant-saas/contracts';

@Controller('v1/owner/staff')
@UseGuards(RolesGuard)
@RequireRoles('OWNER', 'MANAGER', 'RESTAURANT_OWNER')
export class StaffManagementController {
  constructor(private readonly service: StaffManagementService) {}

  private getTenantId(req: any): string {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return tenantId;
  }

  private getActorId(req: any): string | undefined {
    return req.tenantContext?.actorId || req.user?.userId;
  }

  // ---------------------------------------------------------------------------
  // 1. Staff Members Endpoints
  // ---------------------------------------------------------------------------

  @Get()
  async listStaff(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.listStaff(tenantId);
  }

  @Get('stats')
  async getStaffStats(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.getStaffStats(tenantId);
  }

  @Post()
  async createStaff(@Req() req: any, @Body() body: CreateStaffDto) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.createStaff(tenantId, actorId, body);
  }

  @Patch(':id')
  async updateStaff(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateStaffDto
  ) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.updateStaff(tenantId, actorId, id, body);
  }

  @Delete(':id')
  async deleteStaff(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.deleteStaff(tenantId, actorId, id);
  }

  // ---------------------------------------------------------------------------
  // 2. Roles & Permissions Endpoints
  // ---------------------------------------------------------------------------

  @Get('roles/all')
  async listRoles(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.listRoles(tenantId);
  }

  @Post('roles')
  async createRole(@Req() req: any, @Body() body: CreateRoleDto) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.createRole(tenantId, actorId, body);
  }

  @Patch('roles/:id')
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateRoleDto
  ) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.updateRole(tenantId, actorId, id, body);
  }

  @Delete('roles/:id')
  async deleteRole(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    const actorId = this.getActorId(req);
    return this.service.deleteRole(tenantId, actorId, id);
  }

  @Get('permissions/all')
  async listPermissions() {
    return this.service.listPermissions();
  }

  // ---------------------------------------------------------------------------
  // 3. Activity Logs Endpoints
  // ---------------------------------------------------------------------------

  @Get('activity-logs')
  async listActivityLogs(@Req() req: any) {
    const tenantId = this.getTenantId(req);
    return this.service.listActivityLogs(tenantId);
  }
}
