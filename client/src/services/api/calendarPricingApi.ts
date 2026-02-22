import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarPricingDay {
  date: string;
  nightlyPrice: number | null;
  priceSource: string;
  status: string;
  reservationId?: number;
}

export interface RatePlan {
  id: number;
  propertyId: number;
  name: string;
  type: string; // BASE, SEASONAL, PROMOTIONAL, LAST_MINUTE
  priority: number;
  nightlyPrice: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  minStayOverride?: number;
  isActive: boolean;
}

export interface RateOverride {
  id: number;
  propertyId: number;
  date: string;
  nightlyPrice: number;
  source?: string;
}

export interface CreateRatePlanData {
  propertyId: number;
  name: string;
  type: string;
  priority: number;
  nightlyPrice: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek?: number[];
  minStayOverride?: number;
  isActive?: boolean;
}

export interface BulkRateOverrideData {
  propertyId: number;
  from: string;
  to: string;
  nightlyPrice: number;
  source?: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const calendarPricingApi = {
  async getPricing(propertyId: number, from: string, to: string): Promise<CalendarPricingDay[]> {
    return apiClient.get<CalendarPricingDay[]>(`/calendar/${propertyId}/pricing`, {
      params: { from, to },
    });
  },

  async updatePrice(propertyId: number, from: string, to: string, price: number): Promise<void> {
    return apiClient.put(`/calendar/${propertyId}/price`, { from, to, price });
  },

  // Rate Plans
  async getRatePlans(propertyId: number): Promise<RatePlan[]> {
    return apiClient.get<RatePlan[]>('/rate-plans', { params: { propertyId } });
  },

  async createRatePlan(data: CreateRatePlanData): Promise<RatePlan> {
    return apiClient.post<RatePlan>('/rate-plans', data);
  },

  async updateRatePlan(id: number, data: Partial<CreateRatePlanData>): Promise<RatePlan> {
    return apiClient.put<RatePlan>(`/rate-plans/${id}`, data);
  },

  async deleteRatePlan(id: number): Promise<void> {
    return apiClient.delete(`/rate-plans/${id}`);
  },

  // Rate Overrides
  async getOverrides(propertyId: number, from: string, to: string): Promise<RateOverride[]> {
    return apiClient.get<RateOverride[]>('/rate-overrides', {
      params: { propertyId, from, to },
    });
  },

  async createOverrideBulk(data: BulkRateOverrideData): Promise<void> {
    return apiClient.post('/rate-overrides/bulk', data);
  },

  async deleteOverride(id: number): Promise<void> {
    return apiClient.delete(`/rate-overrides/${id}`);
  },

  // Push pricing to Airbnb
  async pushPricing(propertyId: number): Promise<{ daysResolved: number; status: string }> {
    return apiClient.post(`/calendar/${propertyId}/push-pricing`, {});
  },
};
