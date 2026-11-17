import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { PlatformController } from './modules/platform/platform.controller.js';
import { TenantContextMiddleware } from './modules/tenant/tenant-context.middleware.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    TenantModule,
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
