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
  createdAt: string;
  updatedAt: string;
}

export const reservationsApi = {
  getAll(params?: Record<string, string>) {
    return apiClient.get<PaginatedResponse<Reservation>>('/reservations', { params });
  },

  getById(id: number) {
    return apiClient.get<Reservation>(`/reservations/${id}`);
  },

  getByProperty(propertyId: number) {
    return apiClient.get<Reservation[]>(`/reservations/property/${propertyId}`);
  },
};
