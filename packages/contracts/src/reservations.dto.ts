export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';

export type ReservationSource = 'WEBSITE' | 'PHONE' | 'WALK_IN' | 'STAFF' | 'APP';

export type WaitlistStatus = 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW' | 'COMPLETED';

export interface TableReservationDto {
  id: string;
  tenantId: string;
  locationId: string;
  locationName?: string;
  tableId: string | null;
  tableCode?: string | null;
  tableLabel?: string | null;
  reservationCode: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  partySize: number;
  reservationDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS or HH:MM
  endTime: string; // HH:MM:SS or HH:MM
  status: ReservationStatus;
  source: ReservationSource;
  occasion?: string | null;
  specialRequests?: string | null;
  notes?: string | null;
  seatedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TableWaitlistDto {
  id: string;
  tenantId: string;
  locationId: string;
  locationName?: string;
  queueNumber: number;
  guestName: string;
  guestPhone: string;
  partySize: number;
  sectionPreference: string;
  status: WaitlistStatus;
  estimatedWaitMinutes: number;
  assignedTableId: string | null;
  assignedTableCode?: string | null;
  assignedTableLabel?: string | null;
  notes?: string | null;
  notifiedAt?: string | null;
  seatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationRequestDto {
  locationId?: string;
  tableId?: string | null;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  partySize: number;
  reservationDate: string;
  startTime: string;
  endTime?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  occasion?: string;
  specialRequests?: string;
  notes?: string;
}

export interface UpdateReservationRequestDto {
  tableId?: string | null;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string | null;
  partySize?: number;
  reservationDate?: string;
  startTime?: string;
  endTime?: string;
  status?: ReservationStatus;
  source?: ReservationSource;
  occasion?: string | null;
  specialRequests?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
}

export interface CreateWaitlistRequestDto {
  locationId?: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  sectionPreference?: string;
  estimatedWaitMinutes?: number;
  notes?: string;
}

export interface UpdateWaitlistRequestDto {
  status?: WaitlistStatus;
  assignedTableId?: string | null;
  partySize?: number;
  sectionPreference?: string;
  estimatedWaitMinutes?: number;
  notes?: string | null;
}

export interface ReservationsOverviewDto {
  tenantId: string;
  locationId: string;
  date: string;
  summary: {
    totalReservations: number;
    confirmed: number;
    seated: number;
    completed: number;
    pending: number;
    cancelled: number;
    noShow: number;
  };
  reservations: TableReservationDto[];
}

export interface WaitlistOverviewDto {
  tenantId: string;
  locationId: string;
  summary: {
    totalWaiting: number;
    notified: number;
    seatedToday: number;
    completedToday: number;
    avgWaitMinutes: number;
  };
  waitlist: TableWaitlistDto[];
}
