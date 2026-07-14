import apiClient from '../apiClient';
import { isMockEnabled } from '../storageService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarPricingDay {
  date: string;
  nightlyPrice: number | null;
  priceSource: string;
  status: string;
  reservationId?: number;
  currency?: string;
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
  currency?: string;
}

export interface MinNightsOverride {
  id: number;
  propertyId: number;
  date: string;
  minNights: number;
  source?: string;
}

export interface BulkMinNightsOverrideData {
  propertyId: number;
  from: string;
  to: string;
  minNights: number;
  source?: string;
}

export interface BookingRestriction {
  id: number;
  propertyId: number;
  startDate: string;
  endDate: string;
  minStay?: number | null;
  maxStay?: number | null;
  closedToArrival?: boolean | null;
  closedToDeparture?: boolean | null;
  gapDays?: number | null;
  advanceNoticeDays?: number | null;
  daysOfWeek?: number[] | null;
  priority?: number | null;
}

export interface CreateBookingRestrictionData {
  propertyId: number;
  startDate: string;
  endDate: string;
  minStay?: number | null;
  maxStay?: number | null;
  closedToArrival?: boolean | null;
  closedToDeparture?: boolean | null;
  gapDays?: number | null;
  advanceNoticeDays?: number | null;
  daysOfWeek?: number[] | null;
  priority?: number | null;
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

export interface CalendarBlockedDay {
  propertyId: number;
  date: string;
  status: 'BLOCKED' | 'MAINTENANCE';
  source: string;
  notes: string | null;
}

// ─── Mock (démo planning) ─────────────────────────────────────────────────────

/**
 * Tarifs à la nuitée de démo pour un logement (mode mock planning uniquement).
 * Prix de base déterministe par logement + majoration week-end (ven/sam), arrondi
 * à 5 €. Chaque logement a donc SES tarifs sur toute la plage affichée.
 */
function generateMockPricing(propertyId: number, from: string, to: string): CalendarPricingDay[] {
  const base = 90 + ((propertyId * 37) % 8) * 20; // 90 → 230 €, varié par logement
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const cur = new Date(fy, (fm ?? 1) - 1, fd);
  const last = new Date(ty, (tm ?? 1) - 1, td);
  const out: CalendarPricingDay[] = [];
  while (cur <= last) {
    const dow = cur.getDay(); // 0 = dim … 6 = sam
    const weekend = dow === 5 || dow === 6;
    const price = Math.round((base * (weekend ? 1.25 : 1)) / 5) * 5;
    const date = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    out.push({ date, nightlyPrice: price, priceSource: 'MOCK', status: 'AVAILABLE', currency: 'EUR' });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const calendarPricingApi = {
  async getPricing(propertyId: number, from: string, to: string): Promise<CalendarPricingDay[]> {
    if (isMockEnabled('planning')) {
      return Promise.resolve(generateMockPricing(propertyId, from, to));
    }
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

  // Min-Nights Overrides
  async getMinNightsOverrides(propertyId: number, from: string, to: string): Promise<MinNightsOverride[]> {
    return apiClient.get<MinNightsOverride[]>('/min-nights-overrides', {
      params: { propertyId, from, to },
    });
  },

  async createMinNightsOverrideBulk(data: BulkMinNightsOverrideData): Promise<void> {
    return apiClient.post('/min-nights-overrides/bulk', data);
  },

  async deleteMinNightsOverride(id: number): Promise<void> {
    return apiClient.delete(`/min-nights-overrides/${id}`);
  },

  // Push pricing to Airbnb
  async pushPricing(propertyId: number): Promise<{ daysResolved: number; status: string }> {
    return apiClient.post(`/calendar/${propertyId}/push-pricing`, {});
  },

  // Blocked days for planning (batch multi-property)
  async getBlockedDays(propertyIds: number[], from: string, to: string): Promise<CalendarBlockedDay[]> {
    return apiClient.get<CalendarBlockedDay[]>('/calendar/blocked', {
      params: { propertyIds: propertyIds.join(','), from, to },
    });
  },

  // Block dates on a property
  async blockDates(propertyId: number, from: string, to: string, notes?: string): Promise<void> {
    return apiClient.post(`/calendar/${propertyId}/block`, { from, to, notes, source: 'MANUAL' });
  },

  // Unblock dates on a property
  async unblockDates(propertyId: number, from: string, to: string): Promise<void> {
    return apiClient.delete(`/calendar/${propertyId}/block`, { params: { from, to } });
  },

  // ─── Booking restrictions (min/max stay, CTA/CTD) — poussées vers les OTAs ──
  async getBookingRestrictions(propertyId: number): Promise<BookingRestriction[]> {
    return apiClient.get<BookingRestriction[]>('/booking-restrictions', { params: { propertyId } });
  },

  async createBookingRestriction(data: CreateBookingRestrictionData): Promise<BookingRestriction> {
    return apiClient.post<BookingRestriction>('/booking-restrictions', data);
  },

  async updateBookingRestriction(id: number, data: CreateBookingRestrictionData): Promise<BookingRestriction> {
    return apiClient.put<BookingRestriction>(`/booking-restrictions/${id}`, data);
  },

  async deleteBookingRestriction(id: number): Promise<void> {
    return apiClient.delete(`/booking-restrictions/${id}`);
  },
};
