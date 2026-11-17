import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { CustomerModule } from './modules/customer/customer.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { PlatformController } from './modules/platform/platform.controller.js';
import { TenantContextMiddleware } from './modules/tenant/tenant-context.middleware.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
    CustomerModule,
    StaffModule,
  ],
  controllers: [PlatformController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
