import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomerService } from './customer.service.js';
import type {
  ResolveQrRequestDto,
  CreateCustomerOrderRequestDto,
} from '@restaurant-saas/contracts';

@Controller('v1')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('public/table/resolve-qr')
  @HttpCode(HttpStatus.OK)
  async resolveQr(@Body() dto: ResolveQrRequestDto) {
    return this.customerService.resolveQrToken(dto.qrToken);
  }

  @Get('public/menu/:tenantSlug')
  async getMenu(@Param('tenantSlug') tenantSlug: string) {
    return this.customerService.getPublicMenu(tenantSlug);
  }

  @Post('customer/orders')
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: CreateCustomerOrderRequestDto) {
    return this.customerService.createCustomerOrder(dto);
  }

  /**
   * SEC-AUTH-01: Order status requires a valid table session credential
   */
  @Get('customer/orders/:orderId')
  async getOrder(
    @Param('orderId') orderId: string,
    @Headers('x-session-token') sessionTokenHeader?: string,
    @Query('sessionToken') sessionTokenQuery?: string
  ) {
    const sessionToken = sessionTokenHeader || sessionTokenQuery;
    if (!sessionToken || sessionToken.trim() === '') {
      throw new UnauthorizedException('Valid table session credential is required to view order status');
    }
    return this.customerService.getOrderForSession(orderId, sessionToken.trim());
  }

  @Get('customer/sessions/:sessionToken/orders')
  async getSessionOrders(@Param('sessionToken') sessionToken: string) {
    return this.customerService.getTableSessionOrders(sessionToken);
  }
}
