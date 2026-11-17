import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const tenantContext = req.tenantContext;

    if (!tenantContext) {
      throw new ForbiddenException('Tenant authorization context missing');
    }

    if (tenantContext.actorType === 'PLATFORM_ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) =>
      tenantContext.roleCodes.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenException(`Missing required role: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
