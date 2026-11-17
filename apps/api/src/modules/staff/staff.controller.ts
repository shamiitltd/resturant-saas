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
  constructor(private readonly staffService: StaffService) {}

  /**
   * 1. GET /v1/staff/orders - Staff order queue for Reception, Kitchen, and Waiters
   */
  @Get()
  async listOrders(
    @Req() req: any,
    @Query() query: StaffOrderListQueryDto
  ): Promise<StaffOrderDto[]> {
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.listStaffOrders(req.tenantContext, query);
  }

  /**
   * 2. GET /v1/staff/orders/:orderId - Detailed view of single order
   */
  @Get(':orderId')
  async getOrder(
    @Req() req: any,
    @Param('orderId') orderId: string
  ): Promise<StaffOrderDto> {
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.getStaffOrderById(req.tenantContext, orderId);
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
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.updateOrderStatus(req.tenantContext, orderId, dto);
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
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.setChefEta(req.tenantContext, orderId, dto);
  }

  /**
   * 5. PATCH /v1/staff/orders/:orderId/pickup - Waiter picks up READY order
   */
  @Patch(':orderId/pickup')
  async pickupOrder(
    @Req() req: any,
    @Param('orderId') orderId: string
  ): Promise<StaffOrderDto> {
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.pickupOrder(req.tenantContext, orderId);
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
    if (!req.tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }
    return this.staffService.serveOrder(req.tenantContext, orderId, notes);
  }
}
