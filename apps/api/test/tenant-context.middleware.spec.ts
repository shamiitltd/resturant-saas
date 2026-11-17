import { ForbiddenException } from '@nestjs/common';
import { TenantContextMiddleware } from '../src/modules/tenant/tenant-context.middleware.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('TenantContextMiddleware (T-01 & T-02 Verification)', () => {
  let middleware: TenantContextMiddleware;
  let mockDbService: any;

  beforeEach(() => {
    mockDbService = {
      query: jest.fn(),
    };
    middleware = new TenantContextMiddleware(mockDbService as unknown as DatabaseService);
  });

  it('T-01: throws ForbiddenException when user attempts to access an unassigned tenant', async () => {
    const req: any = {
      user: { userId: 'user-tenant-a' },
      headers: {
        'x-tenant-id': 'tenant-b-uuid',
      },
    };
    const res: any = {};
    const next = jest.fn();

    // 1. Not platform admin
    mockDbService.query.mockImplementationOnce(async () => ({ rows: [] }));
    // 2. Query for tenant membership returns empty (User A does NOT belong to Tenant B)
    mockDbService.query.mockImplementationOnce(async () => ({ rows: [] }));

    await expect(middleware.use(req, res, next)).rejects.toThrow(
      ForbiddenException
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('T-02: throws ForbiddenException when staff member attempts to access an unassigned location', async () => {
    const req: any = {
      user: { userId: 'staff-user-1' },
      headers: {
        'x-tenant-id': 'tenant-a-uuid',
        'x-location-id': 'unassigned-branch-uuid',
      },
    };
    const res: any = {};
    const next = jest.fn();

    // 1. Not platform admin
    mockDbService.query.mockImplementationOnce(async () => ({ rows: [] }));
    // 2. Belongs to tenant A
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ membership_id: 'mem-1', tenant_id: 'tenant-a-uuid', status: 'ACTIVE' }],
    }));
    // 3. Roles
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ code: 'WAITER' }],
    }));
    // 4. Permissions
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ code: 'orders.view' }],
    }));
    // 5. Check location membership returns empty (Not assigned to unassigned-branch-uuid)
    mockDbService.query.mockImplementationOnce(async () => ({ rows: [] }));

    await expect(middleware.use(req, res, next)).rejects.toThrow(
      ForbiddenException
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access and attaches trusted TenantContext for authorized tenant and location', async () => {
    const req: any = {
      user: { userId: 'chef-user-1' },
      headers: {
        'x-tenant-id': 'tenant-a-uuid',
        'x-location-id': 'kitchen-branch-1',
      },
    };
    const res: any = {};
    const next = jest.fn();

    // 1. Not platform admin
    mockDbService.query.mockImplementationOnce(async () => ({ rows: [] }));
    // 2. Membership
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ membership_id: 'mem-1', tenant_id: 'tenant-a-uuid', status: 'ACTIVE' }],
    }));
    // 3. Roles
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ code: 'CHEF' }],
    }));
    // 4. Permissions
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ code: 'kitchen.view' }, { code: 'kitchen.set_eta' }],
    }));
    // 5. Location verified
    mockDbService.query.mockImplementationOnce(async () => ({
      rows: [{ location_id: 'kitchen-branch-1' }],
    }));

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.tenantContext).toBeDefined();
    expect(req.tenantContext.tenantId).toBe('tenant-a-uuid');
    expect(req.tenantContext.locationId).toBe('kitchen-branch-1');
    expect(req.tenantContext.roleCodes).toContain('CHEF');
    expect(req.tenantContext.permissions).toContain('kitchen.view');
  });
});
