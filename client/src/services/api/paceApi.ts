import { apiClient } from '../apiClient';

// ─── Types (miroir des DTOs backend PaceSummaryDto / BookingCurveDto) ────────

export interface PaceMonth {
  month: string; // "2026-08"
  otbNights: number;
  otbRevenue: number;
  stlyNights: number;
  paceVsStlyPct: number | null;
  pickup7Nights: number;
  pickup28Nights: number;
  occupancyOtbPct: number | null;
}

export interface PaceSummary {
  generatedOn: string;
  activeProperties: number;
  months: PaceMonth[];
}

export interface BookingCurvePoint {
  daysBeforeMonthStart: number;
  otbNights: number;
  stlyOtbNights: number;
}

export interface BookingCurve {
  month: string;
  points: BookingCurvePoint[];
}

// ─── API (fondations RMS R1 — on-the-books / pace / pickup) ──────────────────

export const paceApi = {
  getSummary: (months: number, propertyId?: number | null) =>
    apiClient.get<PaceSummary>(
      `/analytics/pace/summary?months=${months}${propertyId ? `&propertyId=${propertyId}` : ''}`,
    ),

  getBookingCurve: (month: string, propertyId?: number | null) =>
    apiClient.get<BookingCurve>(
      `/analytics/pace/booking-curve?month=${encodeURIComponent(month)}${propertyId ? `&propertyId=${propertyId}` : ''}`,
    ),
};
