import { apiClient } from '../apiClient';

/* ─── Types ─── */

export type RatePlanType = 'BASE' | 'SEASONAL' | 'PROMOTIONAL' | 'LAST_MINUTE';

export interface RatePlanDto {
  id: number;
  propertyId: number;
  name: string;
  type: RatePlanType;
  priority: number;
  nightlyPrice: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[] | null;
  minStayOverride: number | null;
  isActive: boolean;
}

export interface PricingCalendarDay {
  date: string;
  nightlyPrice: number | null;
  status: string;
  reservationId: number | null;
  priceSource: string;
}

export type CreateRatePlanRequest = Omit<RatePlanDto, 'id'>;
export type UpdateRatePlanRequest = Omit<RatePlanDto, 'id'>;

/* ─── API ─── */

export const ratePlanApi = {
  /** Get all rate plans for a property */
  getByProperty(propertyId: number) {
    return apiClient.get<RatePlanDto[]>('/rate-plans', { params: { propertyId } });
  },

  /** Create a new rate plan */
  create(data: CreateRatePlanRequest) {
    return apiClient.post<RatePlanDto>('/rate-plans', data);
  },

  /** Update an existing rate plan */
  update(id: number, data: UpdateRatePlanRequest) {
    return apiClient.put<RatePlanDto>(`/rate-plans/${id}`, data);
  },

  /** Delete a rate plan */
  delete(id: number) {
    return apiClient.delete<void>(`/rate-plans/${id}`);
  },

  /** Get enriched pricing calendar for a property (prices + source per day) */
  getPricingCalendar(propertyId: number, from: string, to: string) {
    return apiClient.get<PricingCalendarDay[]>(`/calendar/${propertyId}/pricing`, {
      params: { from, to },
    });
  },
};
