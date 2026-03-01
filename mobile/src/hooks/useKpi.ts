import { useQuery } from '@tanstack/react-query';
import { kpiApi } from '@/api/endpoints/kpiApi';

const KEYS = {
  dashboard: ['kpi', 'dashboard'] as const,
  revenue: (params?: Record<string, string>) => ['kpi', 'revenue', params] as const,
  occupancy: (params?: Record<string, string>) => ['kpi', 'occupancy', params] as const,
};

export function useDashboardKpis() {
  return useQuery({
    queryKey: KEYS.dashboard,
    queryFn: () => kpiApi.getDashboard(),
  });
}

export function useRevenueKpis(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.revenue(params),
    queryFn: () => kpiApi.getRevenue(params),
  });
}

export function useOccupancyKpis(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.occupancy(params),
    queryFn: () => kpiApi.getOccupancy(params),
  });
}
