import apiClient from '../apiClient';
import { queryOptions } from '@tanstack/react-query';
import type { GlobalKPIs, RevenueMetrics, OccupancyMetrics } from '../../types/analytics';
import type { DashboardPeriod } from '../../modules/dashboard/DashboardDateFilter';

/**
 * Analytics agrégées du portefeuille calculées CÔTÉ SERVEUR (rapatriement des
 * slices global / revenue / occupancy). Les shapes correspondent exactement aux
 * types TS `GlobalKPIs` / `RevenueMetrics` / `OccupancyMetrics`.
 */
export interface PortfolioAnalytics {
  global: GlobalKPIs;
  revenue: RevenueMetrics;
  occupancy: OccupancyMetrics;
}

export const portfolioAnalyticsApi = {
  get: (period: DashboardPeriod) =>
    apiClient.get<PortfolioAnalytics>(`/analytics/portfolio?period=${period}`),
};

/** Cache partagé entre les rapports et les widgets du dashboard. */
export const portfolioAnalyticsQuery = (period: DashboardPeriod) => queryOptions({
  queryKey: ['analytics-portfolio', period],
  queryFn: () => portfolioAnalyticsApi.get(period),
  staleTime: 60_000,
});
