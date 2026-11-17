import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './decorators.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const tenantContext = req.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }

    // Platform admin bypasses tenant permission restrictions
    if (tenantContext.actorType === 'PLATFORM_ADMIN') {
      return true;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      tenantContext.permissions.includes(perm)
    );

    if (!hasPermission) {
      throw new ForbiddenException(`Missing required permission: ${requiredPermissions.join(', ')}`);
    }

    return true;
  }
}
