import { apiClient } from '../apiClient';

/* ─── Types ─── */

export interface OccupancyForecast {
  propertyId: number;
  date: string;
  predictedOccupancy: number;
  confidence: number;
  isBooked: boolean;
  dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  season: 'HIGH' | 'MID' | 'LOW';
  reason: string;
}

export interface RevenueAnalytics {
  totalNights: number;
  bookedNights: number;
  occupancyRate: number;
  totalRevenue: number;
  adr: number;         // Average Daily Rate
  revPAR: number;      // Revenue Per Available Room
  occupancyByMonth: Record<string, number>;
  revenueByMonth: Record<string, number>;
  bookingsBySource: Record<string, number>;
  forecast: OccupancyForecast[];
}

/* ─── API ─── */

export const aiAnalyticsApi = {
  /** Get AI-powered revenue analytics & occupancy forecast for a property */
  getAnalytics(propertyId: number, from: string, to: string) {
    return apiClient.get<RevenueAnalytics>(`/ai/analytics/${propertyId}`, {
      params: { from, to },
    });
  },
};
