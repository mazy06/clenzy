export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out';
export type ReservationSource = 'airbnb' | 'booking' | 'direct' | 'other';

export interface Reservation {
  id: number;
  propertyId: number;
  propertyName: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: ReservationStatus;
  source: ReservationSource;
  sourceName?: string;
  confirmationCode?: string;
  totalPrice: number;
  notes?: string;
}

export interface ReservationFilters {
  propertyIds?: number[];
  status?: ReservationStatus;
  source?: ReservationSource;
  from?: string;
  to?: string;
}

export interface CreateReservationData {
  propertyId: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCount: number;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  totalPrice?: number;
  notes?: string;
}
