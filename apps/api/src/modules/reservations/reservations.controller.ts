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
import { ReservationsService } from './reservations.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { resolveTenantContextFromRequest } from '../tenant/tenant-context.middleware.js';
import type {
  CreateReservationRequestDto,
  UpdateReservationRequestDto,
  CreateWaitlistRequestDto,
  UpdateWaitlistRequestDto,
} from '@restaurant-saas/contracts';

@Controller('v1')
@UseGuards(AuthGuard('supabase-jwt'), PermissionsGuard)
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
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
  // Owner & Staff Reservations Endpoints
  // ---------------------------------------------------------------------------

  @Get('owner/reservations')
  async listOwnerReservations(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.listReservations(tenantContext, locationId, date, status);
  }

  @Post('owner/reservations')
  async createOwnerReservation(
    @Req() req: any,
    @Body() body: CreateReservationRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.createReservation(tenantContext, body);
  }

  @Patch('owner/reservations/:id')
  async updateOwnerReservation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateReservationRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.updateReservation(tenantContext, id, body);
  }

  @Get('staff/reservations')
  async listStaffReservations(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.listReservations(tenantContext, locationId, date, status);
  }

  @Post('staff/reservations')
  async createStaffReservation(
    @Req() req: any,
    @Body() body: CreateReservationRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.createReservation(tenantContext, body);
  }

  @Patch('staff/reservations/:id')
  async updateStaffReservation(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateReservationRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.updateReservation(tenantContext, id, body);
  }

  // ---------------------------------------------------------------------------
  // Owner & Staff Waitlist / Walk-in Queue Endpoints
  // ---------------------------------------------------------------------------

  @Get('owner/waitlist')
  async listOwnerWaitlist(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.listWaitlist(tenantContext, locationId, status);
  }

  @Post('owner/waitlist')
  async createOwnerWaitlist(
    @Req() req: any,
    @Body() body: CreateWaitlistRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.addToWaitlist(tenantContext, body);
  }

  @Patch('owner/waitlist/:id')
  async updateOwnerWaitlist(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateWaitlistRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.updateWaitlist(tenantContext, id, body);
  }

  @Get('staff/waitlist')
  async listStaffWaitlist(
    @Req() req: any,
    @Query('locationId') locationId?: string,
    @Query('status') status?: string
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.listWaitlist(tenantContext, locationId, status);
  }

  @Post('staff/waitlist')
  async createStaffWaitlist(
    @Req() req: any,
    @Body() body: CreateWaitlistRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.addToWaitlist(tenantContext, body);
  }

  @Patch('staff/waitlist/:id')
  async updateStaffWaitlist(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateWaitlistRequestDto
  ) {
    const tenantContext = await this.getContext(req);
    return this.reservationsService.updateWaitlist(tenantContext, id, body);
  }
}
