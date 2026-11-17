import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller.js';
import { TenantContextMiddleware } from './tenant-context.middleware.js';

@Module({
  controllers: [TenantController],
  providers: [TenantContextMiddleware],
  exports: [TenantContextMiddleware],
})
export class TenantModule {}
