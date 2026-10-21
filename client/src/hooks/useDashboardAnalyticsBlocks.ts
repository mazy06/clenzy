import { useQuery } from '@tanstack/react-query';
import { dashboardOverviewApi, type MonthlyRevenueSplit } from '../services/api/dashboardOverviewApi';
import { useAuth } from './useAuth';
import { portfolioAnalyticsQuery, type PortfolioAnalytics } from '../services/api/portfolioAnalyticsApi';
import type { PropertyOccupancy } from '../types/analytics';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';

export type { MonthlyRevenueSplit } from '../services/api/dashboardOverviewApi';

/** Une seule synthèse serveur ; le cache ne traverse pas les comptes ni les organisations. */
export function useDashboardRevenueSplit(year = new Date().getFullYear(), enabled = true) {
  const { user } = useAuth();
  return useQuery<MonthlyRevenueSplit[]>({
    queryKey: ['dashboard', 'revenue-split', user?.id, user?.organizationId, year],
    queryFn: () => dashboardOverviewApi.getRevenueSplit(year),
    staleTime: 60_000,
    enabled: enabled && !!user,
  });
}

/** Occupation par logement sur la période — `occupancy.byProperty` du portefeuille. */
export function useDashboardOccupancyByProperty(period: DashboardPeriod, enabled = true) {
  return useQuery({
    ...portfolioAnalyticsQuery(period),
    select: selectOccupancy,
    enabled,
  });
}

const selectOccupancy = (analytics: PortfolioAnalytics): PropertyOccupancy[] =>
  [...(analytics.occupancy?.byProperty ?? [])].sort((a, b) => b.rate - a.rate);
