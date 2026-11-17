import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { DatabaseService } from '../src/database/database.service.js';

describe('AuthService (Owner Provisioning & Security)', () => {
  let authService: AuthService;
  let mockDbService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    };

    mockDbService = {
      query: jest.fn(),
      transaction: jest.fn(async (cb) => cb(mockClient)),
    };

    authService = new AuthService(mockDbService as unknown as DatabaseService);
  });

  describe('registerOwner', () => {
    const validDto = {
      email: 'owner@bistro.com',
      fullName: 'Bistro Owner',
      restaurantName: 'Urban Bistro',
      restaurantSlug: 'urban-bistro',
      primaryOutletName: 'Uptown Branch',
      timezone: 'Asia/Kolkata',
    };

    it('rejects invalid restaurant slugs with BadRequestException', async () => {
      const invalidDto = { ...validDto, restaurantSlug: 'Invalid Slug!@#' };

      await expect(authService.registerOwner('user-1', invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('rejects duplicate restaurant slugs with ConflictException', async () => {
      mockClient.query.mockImplementationOnce(async (sql) => {
        if (sql.includes('SELECT id FROM tenants')) {
          return { rows: [{ id: 'existing-tenant-id' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      await expect(authService.registerOwner('user-1', validDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('creates tenant, location, profile, membership, and OWNER role atomically', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (sql.includes('SELECT id FROM tenants')) {
          return { rows: [], rowCount: 0 }; // Slug is available
        }
        if (sql.includes('INSERT INTO tenants')) {
          return { rows: [{ id: 'new-tenant-uuid' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO locations')) {
          return { rows: [{ id: 'new-location-uuid' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO tenant_memberships')) {
          return { rows: [{ id: 'new-membership-uuid' }], rowCount: 1 };
        }
        if (sql.includes('SELECT id FROM roles WHERE code = \'OWNER\'')) {
          return { rows: [{ id: 'owner-role-uuid' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      // Mock getMe returning the provisioned state
      jest.spyOn(authService, 'getMe').mockResolvedValueOnce({
        user: { id: 'user-1', email: 'owner@bistro.com', fullName: 'Bistro Owner' },
        isPlatformAdmin: false,
        memberships: [
          {
            membershipId: 'new-membership-uuid',
            tenantId: 'new-tenant-uuid',
            tenantSlug: 'urban-bistro',
            tenantName: 'Urban Bistro',
            status: 'ACTIVE',
            roles: [{ id: 'owner-role-uuid', code: 'OWNER', name: 'Restaurant Owner' }],
            permissions: ['orders.view', 'menu.manage'],
            locations: [{ id: 'new-location-uuid', code: 'main-outlet', name: 'Uptown Branch', isPrimary: true }],
          },
        ],
        activeTenantId: 'new-tenant-uuid',
        activeLocationId: 'new-location-uuid',
      });

      const result = await authService.registerOwner('user-1', validDto);

      expect(result.memberships[0].tenantSlug).toBe('urban-bistro');
      expect(result.memberships[0].roles[0].code).toBe('OWNER');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.any(Array)
      );
    });
  });
});
