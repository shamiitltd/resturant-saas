export type BillStatus = 'UNPAID' | 'PAYMENT_REPORTED' | 'VERIFIED_PAID' | 'VOIDED';

export type RestaurantPaymentMethod = 'RESTAURANT_UPI_QR' | 'CASH' | 'CARD' | 'OTHER';

export type RestaurantPaymentStatus =
  | 'UNPAID'
  | 'PAYMENT_REPORTED'
  | 'VERIFIED_PAID'
  | 'REJECTED'
  | 'VOIDED';

export interface RestaurantPaymentSettingsDto {
  id?: string;
  tenantId: string;
  locationId: string;
  locationName?: string;
  upiId: string | null;
  displayName: string | null;
  qrAssetUrl: string | null;
  instructions: string | null;
  acceptedMethods: RestaurantPaymentMethod[];
  isActive: boolean;
  taxRatePercent: number | null;
  updatedAt?: string;
}

export interface UpsertPaymentSettingsRequestDto {
  locationId?: string;
  upiId?: string | null;
  displayName?: string | null;
  qrAssetUrl?: string | null;
  instructions?: string | null;
  acceptedMethods?: RestaurantPaymentMethod[];
  isActive: boolean;
  taxRatePercent?: number | null;
}

export interface BillLineDto {
  id: string;
  orderId: string;
  orderNumber?: string;
  orderItemId?: string | null;
  itemNameSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  selectedModifiers: Array<{
    id: string;
    name: string;
    priceMinor: number;
  }>;
}

export interface RestaurantPaymentDto {
  id: string;
  billId: string;
  amountMinor: number;
  currency: string;
  method: RestaurantPaymentMethod;
  status: RestaurantPaymentStatus;
  customerReference?: string | null;
  reportedByType: 'CUSTOMER_GUEST' | 'TENANT_USER';
  reportedById?: string | null;
  reportedByName?: string | null;
  reportedAt: string;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  notes?: string | null;
}

export interface BillOrderSummaryDto {
  orderId: string;
  orderNumber: string;
  status: string;
  totalMinor: number;
  createdAt: string;
}

export interface RestaurantBillDto {
  id: string;
  tenantId: string;
  locationId: string;
  locationName?: string;
  tenantName?: string;
  tableSessionId: string | null;
  tableId: string | null;
  tableCode?: string | null;
  tableLabel?: string | null;
  billNumber: string;
  status: BillStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  taxRatePercent: number | null;
  discountMinor: number;
  totalMinor: number;
  notes?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt: string;
  orders: BillOrderSummaryDto[];
  lines: BillLineDto[];
  payments: RestaurantPaymentDto[];
}

export interface BillingQueueSessionDto {
  tableSessionId: string;
  sessionStatus: 'OPEN' | 'CLOSING' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  tableId: string;
  tableCode: string;
  tableLabel: string;
  currency: string;
  ordersCount: number;
  itemsCount: number;
  estimatedSubtotalMinor: number;
  estimatedTaxMinor: number;
  estimatedTotalMinor: number;
  taxRatePercent: number | null;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    createdAt: string;
    items: Array<{
      itemId: string;
      itemName: string;
      unitPriceMinor: number;
      quantity: number;
      subtotalMinor: number;
      selectedModifiers: Array<{ id: string; name: string; priceMinor: number }>;
    }>;
  }>;
  bill: RestaurantBillDto | null;
}

export interface BillingDailySummaryDto {
  billsToday: number;
  totalSalesMinor: number;
  avgBillMinor: number;
  upiCollectedMinor: number;
  cashCollectedMinor: number;
  cardOtherCollectedMinor: number;
  pendingBillsCount: number;
  reportedCount: number;
}

export interface StaffBillingQueueResponseDto {
  locationId: string;
  locationName: string;
  tenantName: string;
  paymentSettings: RestaurantPaymentSettingsDto;
  summary: BillingDailySummaryDto;
  sessions: BillingQueueSessionDto[];
}

export interface GenerateBillRequestDto {
  notes?: string;
  recalculate?: boolean;
}

export interface RecordStaffPaymentRequestDto {
  method: RestaurantPaymentMethod;
  customerReference?: string;
  notes?: string;
  idempotencyKey?: string;
  verifyImmediately?: boolean;
}

export interface VerifyPaymentRequestDto {
  approved: boolean;
  customerReference?: string;
  notes?: string;
}

export interface VoidBillRequestDto {
  voidReason: string;
}

export interface CustomerSubmitPaymentReferenceRequestDto {
  sessionToken: string;
  method: 'RESTAURANT_UPI_QR';
  customerReference: string;
  notes?: string;
  idempotencyKey: string;
}

export interface CustomerBillSummaryDto {
  tableSessionId: string;
  sessionStatus: 'OPEN' | 'CLOSING' | 'CLOSED';
  tableCode: string;
  tableLabel: string;
  tenantName: string;
  locationName: string;
  currency: string;
  taxRatePercent: number | null;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  bill: RestaurantBillDto | null;
  paymentSettings: {
    isActive: boolean;
    upiId: string | null;
    displayName: string | null;
    qrAssetUrl: string | null;
    instructions: string | null;
  } | null;
}
