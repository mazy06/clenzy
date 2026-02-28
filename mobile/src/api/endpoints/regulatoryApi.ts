import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface AlurCompliance {
  daysRented: number;
  maxDays: number;
  daysRemaining: number;
  isCompliant: boolean;
  alertMessage: string | null;
}

export interface AlurBookingCheck {
  allowed: boolean;
  daysRemaining: number;
  requestedNights: number;
  message: string;
}

/* ─── API ─── */

export const regulatoryApi = {
  /** Get ALUR compliance status for a property */
  getAlurCompliance(propertyId: number, year?: number) {
    return apiClient.get<AlurCompliance>(`/regulatory/alur/${propertyId}`, {
      params: year ? { year } : undefined,
    });
  },

  /** Pre-booking check: can this reservation happen without exceeding 120 days? */
  checkAlurBooking(propertyId: number, checkIn: string, checkOut: string) {
    return apiClient.get<AlurBookingCheck>('/regulatory/alur/check', {
      params: { propertyId, checkIn, checkOut },
    });
  },
};
