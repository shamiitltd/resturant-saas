export interface ResolveQrRequestDto {
  qrToken: string;
}

export interface ResolveQrResponseDto {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  locationId: string;
  locationName: string;
  tableId: string;
  tableCode: string;
  tableLabel: string;
  tableSessionId: string;
  sessionToken: string;
  currency: string;
  taxRatePercent?: number | null;
}

export interface OrderItemSubmissionDto {
  itemId: string;
  quantity: number;
  modifierIds?: string[];
  notes?: string;
}

export interface CreateCustomerOrderRequestDto {
  sessionToken: string;
  items: OrderItemSubmissionDto[];
  specialInstructions?: string;
  idempotencyKey: string;
}

export interface OrderItemSnapshotDto {
  itemId: string;
  itemName: string;
  unitPriceMinor: number;
  quantity: number;
  subtotalMinor: number;
  notes?: string;
  selectedModifiers: Array<{
    id: string;
    name: string;
    priceMinor: number;
  }>;
}

export interface CustomerOrderResponseDto {
  orderId: string;
  orderNumber: string;
  tableSessionId: string;
  tableCode: string;
  tableLabel: string;
  status: 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  taxRatePercent: number | null;
  discountMinor: number;
  totalMinor: number;
  chefEtaMinutes?: number;
  rejectionReason?: string;
  cancellationReason?: string;
  specialInstructions?: string;
  createdAt: string;
  items: OrderItemSnapshotDto[];
}

export interface TableSessionOrdersSummaryDto {
  tableSessionId: string;
  sessionStatus: 'OPEN' | 'CLOSING' | 'CLOSED';
  tableCode: string;
  tableLabel: string;
  currency: string;
  taxRatePercent: number | null;
  orders: CustomerOrderResponseDto[];
  consolidatedSubtotalMinor: number;
  consolidatedTaxMinor: number;
  consolidatedTotalMinor: number;
}

export type OrderLifecycleStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface StaffOrderDto {
  id: string;
  orderNumber: string;
  tableSessionId?: string;
  tableId?: string;
  tableCode: string;
  tableLabel: string;
  status: OrderLifecycleStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  chefEtaMinutes?: number;
  etaUpdatedAt?: string;
  specialInstructions?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  settlementNotes?: string;
  waiterId?: string;
  waiterName?: string;
  serviceMode: 'TABLE_SERVICE' | 'COUNTER_SERVICE' | 'HYBRID';
  createdAt: string;
  updatedAt: string;
  elapsedMinutes: number;
  items: OrderItemSnapshotDto[];
}

export interface UpdateOrderStatusRequestDto {
  status: OrderLifecycleStatus;
  notes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  chefEtaMinutes?: number;
}

export interface SetChefEtaRequestDto {
  chefEtaMinutes: number;
  notes?: string;
}

export interface StaffOrderListQueryDto {
  locationId?: string;
  status?: string;
  serviceMode?: string;
}

export interface StaffOrderTransitionResponseDto {
  order: StaffOrderDto;
  event: {
    fromStatus: OrderLifecycleStatus | null;
    toStatus: OrderLifecycleStatus;
    actorType: string;
    actorId?: string | null;
    occurredAt: string;
    notes?: string | null;
  };
}
