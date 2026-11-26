import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { TablesService } from './tables.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { resolveTenantContextFromRequest } from '../tenant/tenant-context.middleware.js';
import type {
  CreateTableRequestDto,
  UpdateTableRequestDto,
} from '@restaurant-saas/contracts';

@Controller('v1/owner/tables')
@UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
export class TablesController {
  constructor(
    private readonly tablesService: TablesService,
    private readonly db: DatabaseService
  ) {}

  private async getContext(req: any) {
    if (req.tenantContext) return req.tenantContext;
    const ctx = await resolveTenantContextFromRequest(this.db, req);
    if (!ctx) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    req.tenantContext = ctx;
    return ctx;
  }

  @Get()
  async listTables(@Req() req: any, @Query('locationId') locationId?: string) {
    const tenantContext = await this.getContext(req);
    return this.tablesService.listTables(tenantContext, locationId);
  }

  @Post()
  async createTable(@Req() req: any, @Body() body: CreateTableRequestDto) {
    const tenantContext = await this.getContext(req);
    return this.tablesService.createTable(tenantContext, body);
  }

  @Patch(':tableId')
  async updateTable(
    @Req() req: any,
    @Param('tableId') tableId: string,
    @Body() body: UpdateTableRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.tablesService.updateTable(tenantContext, tableId, body);
  }

  @Post(':tableId/rotate-qr')
  async rotateQr(@Req() req: any, @Param('tableId') tableId: string) {
    const tenantContext = await this.getContext(req);
    return this.tablesService.rotateTableQrToken(tenantContext, tableId);
  }
}
