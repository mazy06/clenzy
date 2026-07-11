import apiClient from '../apiClient';
import type { DashboardPeriod } from '../../modules/dashboard/DashboardDateFilter';

/**
 * Synthèse agrégée de l'écran Dashboard « Vue d'ensemble », calculée côté
 * backend (DashboardOverviewSummaryService). Remplace l'agrégation client de
 * 5 listes size=1000 + toutes les réservations (audit perf navigation 2026-07).
 * Org-scopé serveur ; HOST limité à ses logements, rôles opérationnels à leurs
 * interventions.
 */
export interface KpiTrend {
  value: number;
  /** Variation % vs la fenêtre précédente de même durée. */
  growth: number;
}

export interface DashboardOverviewSummary {
  occupancyRate: KpiTrend;
  totalRevenue: KpiTrend;
  adr: KpiTrend;
  revPan: KpiTrend;
  properties: { active: number; total: number; growth: number };
  serviceRequests: { pending: number; total: number };
  interventions: {
    today: number;
    total: number;
    growth: number;
    upcoming: number;
    completed: number;
    completionRate: number;
    totalRevenue: number;
  };
  urgentInterventionsCount: number;
  pendingPaymentsCount: number;
}

export const dashboardOverviewApi = {
  getSummary: (period: DashboardPeriod = 'month'): Promise<DashboardOverviewSummary> =>
    apiClient.get<DashboardOverviewSummary>('/dashboard/overview-summary', { params: { period } }),
};
