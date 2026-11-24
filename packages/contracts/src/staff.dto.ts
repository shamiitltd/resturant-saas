export type StaffStatus = 'ACTIVE' | 'INVITED' | 'ON_LEAVE' | 'INACTIVE';

export interface StaffLocationAccessDto {
  id: string;
  name: string;
  code?: string;
  isPrimary: boolean;
}

export interface StaffRoleSummaryDto {
  id: string;
  code: string;
  name: string;
  isSystemRole?: boolean;
}

export interface StaffMemberDto {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  status: StaffStatus;
  role: StaffRoleSummaryDto;
  locations: StaffLocationAccessDto[];
  joinedAt: string;
}

export interface CreateStaffDto {
  fullName: string;
  email: string;
  phone?: string;
  roleId: string;
  locationIds: string[];
  status?: StaffStatus;
}

export interface UpdateStaffDto {
  fullName?: string;
  phone?: string;
  roleId?: string;
  locationIds?: string[];
  status?: StaffStatus;
}

export interface PermissionDto {
  id: string;
  code: string;
  module: string;
  description: string;
}

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  tenantId?: string | null;
  assignedStaffCount: number;
  permissions: PermissionDto[];
  createdAt?: string;
}

export interface CreateRoleDto {
  name: string;
  code?: string;
  description?: string;
  permissionIds: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface StaffStatsDto {
  totalStaff: number;
  activeStaff: number;
  onLeaveStaff: number;
  invitedStaff: number;
  inactiveStaff: number;
  totalOutlets: number;
  totalRoles: number;
}

export interface StaffActivityLogDto {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  action: string;
  resource: string;
  details: string;
  outletName: string;
  ipAddress?: string;
  createdAt: string;
}
