export type RestaurantTableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'INACTIVE';

export type RestaurantTableType = 'STANDARD' | 'BOOTH' | 'OUTDOOR' | 'PRIVATE';

export interface TableQrTokenDto {
  id: string;
  rawToken: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  rotatedAt?: string | null;
  expiresAt?: string | null;
}

export interface TableActiveSessionSummaryDto {
  id: string;
  status: string;
  openedAt: string;
  ordersCount: number;
}

export interface OwnerTableDto {
  id: string;
  tenantId: string;
  locationId: string;
  locationName?: string;
  tableCode: string;
  label: string;
  capacity: number;
  section: string;
  tableType: RestaurantTableType;
  status: RestaurantTableStatus;
  allowQrOrdering: boolean;
  notes?: string | null;
  activeQrToken: TableQrTokenDto | null;
  activeSession: TableActiveSessionSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerTablesOverviewDto {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  locationId: string;
  locationName: string;
  summary: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    inactive: number;
  };
  tables: OwnerTableDto[];
}

export interface CreateTableRequestDto {
  locationId?: string;
  tableCode: string;
  label: string;
  capacity: number;
  section?: string;
  tableType?: RestaurantTableType;
  status?: RestaurantTableStatus;
  allowQrOrdering?: boolean;
  notes?: string;
}

export interface UpdateTableRequestDto {
  tableCode?: string;
  label?: string;
  capacity?: number;
  section?: string;
  tableType?: RestaurantTableType;
  status?: RestaurantTableStatus;
  allowQrOrdering?: boolean;
  notes?: string | null;
}

export interface RotateTableQrResponseDto {
  tableId: string;
  revokedCount: number;
  activeQrToken: TableQrTokenDto;
}
