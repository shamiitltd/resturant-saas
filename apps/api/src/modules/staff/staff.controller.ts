import {
  Controller,
  Get,
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
import { StaffService } from './staff.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { resolveTenantContextFromRequest } from '../tenant/tenant-context.middleware.js';
import type {
  StaffOrderDto,
  StaffOrderListQueryDto,
  UpdateOrderStatusRequestDto,
  SetChefEtaRequestDto,
  StaffOrderTransitionResponseDto,
} from '@restaurant-saas/contracts';

@Controller('v1/staff/orders')
@UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
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

  /**
   * 1. GET /v1/staff/orders - Staff order queue for Reception, Kitchen, and Waiters
   */
  @Get()
  async listOrders(
    @Req() req: any,
    @Query() query: StaffOrderListQueryDto
  ): Promise<StaffOrderDto[]> {
    const tenantContext = await this.getContext(req);
    return this.staffService.listStaffOrders(tenantContext, query);
  }

  /**
   * 2. GET /v1/staff/orders/:orderId - Detailed view of single order
   */
  @Get(':orderId')
  async getOrder(
    @Req() req: any,
    @Param('orderId') orderId: string
  ): Promise<StaffOrderDto> {
    const tenantContext = await this.getContext(req);
    return this.staffService.getStaffOrderById(tenantContext, orderId);
  }

  /**
   * 3. PATCH /v1/staff/orders/:orderId/status - Order Lifecycle State Transition
   */
  @Patch(':orderId/status')
  async updateStatus(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusRequestDto
  ): Promise<StaffOrderTransitionResponseDto> {
    const tenantContext = await this.getContext(req);
    return this.staffService.updateOrderStatus(tenantContext, orderId, dto);
  }

  /**
   * 4. PATCH /v1/staff/orders/:orderId/eta - Chef sets or updates preparation ETA
   */
  @Patch(':orderId/eta')
  async setChefEta(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: SetChefEtaRequestDto
  ): Promise<StaffOrderDto> {
    const tenantContext = await this.getContext(req);
    return this.staffService.setChefEta(tenantContext, orderId, dto);
  }

  /**
   * 5. PATCH /v1/staff/orders/:orderId/pickup - Waiter picks up READY order
   */
  @Patch(':orderId/pickup')
  async pickupOrder(
    @Req() req: any,
    @Param('orderId') orderId: string
  ): Promise<StaffOrderDto> {
    const tenantContext = await this.getContext(req);
    return this.staffService.pickupOrder(tenantContext, orderId);
  }

  /**
   * 6. PATCH /v1/staff/orders/:orderId/served - Waiter delivers or customer collects READY order
   */
  @Patch(':orderId/served')
  async serveOrder(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body('notes') notes?: string
  ): Promise<StaffOrderTransitionResponseDto> {
    const tenantContext = await this.getContext(req);
    return this.staffService.serveOrder(tenantContext, orderId, notes);
  }
}
