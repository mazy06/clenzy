import apiClient from '../apiClient';
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
