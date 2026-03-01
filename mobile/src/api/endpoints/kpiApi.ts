import { apiClient } from '../apiClient';

export interface KpiItem {
  label: string;
  value: number;
  unit?: string;
  trend?: number;
  period?: string;
}

export const kpiApi = {
  getDashboard() {
    return apiClient.get<KpiItem[]>('/kpi/dashboard');
  },

  getRevenue(params?: Record<string, string>) {
    return apiClient.get<KpiItem[]>('/kpi/revenue', { params });
  },

  getOccupancy(params?: Record<string, string>) {
    return apiClient.get<KpiItem[]>('/kpi/occupancy', { params });
  },
};
