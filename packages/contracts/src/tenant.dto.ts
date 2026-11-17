export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  branding?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LocationDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  timezone: string;
  serviceMode: 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID';
  status: 'ACTIVE' | 'INACTIVE';
  address?: Record<string, unknown>;
  createdAt: string;
}

export interface TenantContextDto {
  tenantId: string;
  locationId: string | null;
  actorType: 'PLATFORM_ADMIN' | 'TENANT_USER' | 'CUSTOMER_GUEST';
  actorId: string | null;
  membershipId: string | null;
  roleCodes: string[];
  permissions: string[];
  requestId: string;
}
