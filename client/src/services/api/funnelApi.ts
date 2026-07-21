import { apiClient } from '../apiClient';

// ─── Types (miroir du DTO backend FunnelAnalyticsDto) ────────────────────────

export interface FunnelDailyPoint {
  date: string;
  counts: Record<string, number>;
}

export interface FunnelDeniedStay {
  checkIn: string | null;
  checkOut: string | null;
  guests: string | null;
  count: number;
}

export interface FunnelAnalytics {
  from: string;
  to: string;
  searches: number;
  deniedSearches: number;
  propertyViews: number;
  checkoutStarts: number;
  confirmed: number;
  conversionPct: number | null;
  deniedPct: number | null;
  daily: FunnelDailyPoint[];
  topDenied: FunnelDeniedStay[];
}

// ─── API (fondations RMS R1 — funnel du booking engine, org-level) ───────────

export const funnelApi = {
  get: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return apiClient.get<FunnelAnalytics>(`/analytics/funnel${qs ? `?${qs}` : ''}`);
  },
};
