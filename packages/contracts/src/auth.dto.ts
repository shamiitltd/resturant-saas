export interface LoginRequestDto {
  email: string;
  password?: string;
  otp?: string;
}

export interface RegisterOwnerRequestDto {
  email: string;
  password?: string;
  fullName: string;
  phone?: string;
  restaurantName: string;
  restaurantSlug: string;
  primaryOutletName: string;
  timezone?: string;
}

export interface SelectOutletRequestDto {
  membershipId: string;
  locationId: string;
}

export interface UserProfileDto {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ActiveMembershipDto {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  status: string;
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  permissions: string[];
  locations: Array<{
    id: string;
    code: string;
    name: string;
    isPrimary: boolean;
  }>;
}

export interface AuthMeResponseDto {
  user: UserProfileDto;
  isPlatformAdmin: boolean;
  memberships: ActiveMembershipDto[];
  activeTenantId?: string;
  activeLocationId?: string;
}

export interface AuthSessionResponseDto {
  accessToken: string;
  user: UserProfileDto;
  memberships: ActiveMembershipDto[];
}
