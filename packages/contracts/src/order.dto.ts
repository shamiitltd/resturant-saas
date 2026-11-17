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
  discountMinor: number;
  totalMinor: number;
  chefEtaMinutes?: number;
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
  orders: CustomerOrderResponseDto[];
  consolidatedSubtotalMinor: number;
  consolidatedTaxMinor: number;
  consolidatedTotalMinor: number;
}
