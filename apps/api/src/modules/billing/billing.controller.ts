import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../rbac/permissions.guard.js';
import { BillingService } from './billing.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { resolveTenantContextFromRequest } from '../tenant/tenant-context.middleware.js';
import type {
  UpsertPaymentSettingsRequestDto,
  GenerateBillRequestDto,
  RecordStaffPaymentRequestDto,
  VerifyPaymentRequestDto,
  VoidBillRequestDto,
  CustomerSubmitPaymentReferenceRequestDto,
} from '@restaurant-saas/contracts';

@Controller('v1')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
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

  // ---------------------------------------------------------------------------
  // Owner / Branch Payment Settings (FR-PAY-02)
  // ---------------------------------------------------------------------------

  @Get('owner/payment-settings')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async getPaymentSettings(
    @Req() req: any,
    @Query('locationId') locationId?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.getBranchPaymentSettings(tenantContext, locationId);
  }

  @Put('owner/payment-settings')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async upsertPaymentSettings(
    @Req() req: any,
    @Body() dto: UpsertPaymentSettingsRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.upsertBranchPaymentSettings(tenantContext, dto);
  }

  // ---------------------------------------------------------------------------
  // Staff Billing & Payment Verification (FR-PAY-01, FR-PAY-03, FR-PAY-04)
  // ---------------------------------------------------------------------------

  @Get('staff/billing/queue')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async getBillingQueue(
    @Req() req: any,
    @Query('locationId') locationId?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.getStaffBillingQueue(tenantContext, locationId);
  }

  @Post('staff/table-sessions/:sessionId/bills')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async generateConsolidatedBill(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateBillRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.generateConsolidatedBill(tenantContext, sessionId, dto || {});
  }

  @Get('staff/bills/:billId')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async getBill(@Req() req: any, @Param('billId') billId: string) {
    const tenantContext = await this.getContext(req);
    return this.billingService.getBillById(tenantContext, billId);
  }

  @Post('staff/bills/:billId/payments')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async recordPayment(
    @Req() req: any,
    @Param('billId') billId: string,
    @Body() dto: RecordStaffPaymentRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.recordStaffPayment(tenantContext, billId, dto);
  }

  @Post('staff/payments/:paymentId/verify')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async verifyPayment(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Body() dto: VerifyPaymentRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.verifyPayment(tenantContext, paymentId, dto);
  }

  @Post('staff/bills/:billId/void')
  @UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
  async voidBill(
    @Req() req: any,
    @Param('billId') billId: string,
    @Body() dto: VoidBillRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.billingService.voidBill(tenantContext, billId, dto);
  }

  // ---------------------------------------------------------------------------
  // Customer Session Bill & Unverified UPI Reference (FR-PAY-05, T-06)
  // ---------------------------------------------------------------------------

  @Get('customer/sessions/:sessionToken/bill')
  async getCustomerBill(@Param('sessionToken') sessionToken: string) {
    return this.billingService.getCustomerSessionBill(sessionToken);
  }

  @Post('customer/sessions/:sessionToken/bill/payment-reference')
  async submitCustomerPaymentReference(
    @Param('sessionToken') sessionToken: string,
    @Body() dto: CustomerSubmitPaymentReferenceRequestDto
  ) {
    return this.billingService.submitCustomerPaymentReference(sessionToken, dto);
  }
}
