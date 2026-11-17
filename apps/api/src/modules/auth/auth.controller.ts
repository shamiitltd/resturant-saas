import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import type { RegisterOwnerRequestDto, SelectOutletRequestDto } from '@restaurant-saas/contracts';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('supabase-jwt'))
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('register-owner')
  @UseGuards(AuthGuard('supabase-jwt'))
  @HttpCode(HttpStatus.CREATED)
  async registerOwner(@Req() req: any, @Body() dto: RegisterOwnerRequestDto) {
    return this.authService.registerOwner(req.user.userId, dto);
  }

  @Post('select-outlet')
  @UseGuards(AuthGuard('supabase-jwt'))
  @HttpCode(HttpStatus.OK)
  async selectOutlet(@Req() req: any, @Body() dto: SelectOutletRequestDto) {
    return this.authService.selectOutlet(req.user.userId, dto.membershipId, dto.locationId);
  }
}
