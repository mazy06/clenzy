import { apiClient, PaginatedResponse } from '../apiClient';

export interface Reservation {
  id: number;
  propertyId: number;
  propertyName?: string;
  guestName?: string;
  guestCount?: number;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  source?: string;
  sourceName?: string;
  totalPrice?: number;
  confirmationCode?: string;
  notes?: string;
  guestId?: number;
  guestEmail?: string;
  guestPhone?: string;
  cleaningFee?: number;
  touristTaxAmount?: number;
  paymentLinkSentAt?: string;
  paymentLinkEmail?: string;
  paymentStatus?: string;
  paidAt?: string;
  interventionId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationUpdatePayload {
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  guestCount?: number;
  totalPrice?: number;
  notes?: string;
}

export const reservationsApi = {
  async getAll(params?: Record<string, string>) {
    // Backend uses 'from'/'to' not 'startDate'/'endDate'
    const mappedParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (k === 'startDate') mappedParams['from'] = v;
        else if (k === 'endDate') mappedParams['to'] = v;
        else mappedParams[k] = v;
      }
    }
    // Backend returns List<ReservationDto> (not paginated)
    const data = await apiClient.get<Reservation[]>('/reservations', { params: mappedParams });
    const list = Array.isArray(data) ? data : [];
    return { content: list, totalElements: list.length, totalPages: 1 };
  },

  getById(id: number) {
    return apiClient.get<Reservation>(`/reservations/${id}`);
  },

  getByProperty(propertyId: number) {
    return apiClient.get<Reservation[]>(`/reservations/property/${propertyId}`);
  },

  update(id: number, payload: ReservationUpdatePayload) {
    return apiClient.put<Reservation>(`/reservations/${id}`, payload);
  },

  cancel(id: number, reason?: string) {
    return apiClient.post<void>(`/reservations/${id}/cancel`, { reason });
  },

  sendPaymentLink(id: number, email?: string) {
    return apiClient.post<void>(`/reservations/${id}/send-payment-link`, { email: email ?? '' });
  },

  getLinkedInterventions(reservationId: number) {
    return apiClient.get<import('./interventionsApi').Intervention[]>(`/reservations/${reservationId}/interventions`);
  },
};
