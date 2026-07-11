import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardOverviewApi } from '../services/api/dashboardOverviewApi';
import type { DashboardOverviewSummary, KpiTrend } from '../services/api/dashboardOverviewApi';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';
import type { TranslationFn, DashboardStats, AlertItem } from '../types/dashboard';

// Re-export public types for existing consumers
export type { DashboardStats, ActivityItem, UpcomingIntervention, PendingPaymentItem, ServiceRequestItem, AlertItem } from '../types/dashboard';

/**
 * Données de l'écran Dashboard « Vue d'ensemble ».
 *
 * Depuis l'audit perf navigation 2026-07, TOUT est agrégé côté backend par
 * `GET /api/dashboard/overview-summary` (DashboardOverviewSummaryService) :
 * l'ancienne version fetchait 5 listes size=1000 + les paiements et agrégait
 * en mémoire (~350 lignes de useMemo). Le scoping par rôle (HOST → ses biens,
 * opérationnels → leurs interventions) est appliqué serveur.
 */

export const overviewKeys = {
  all: ['dashboard', 'overview-summary'] as const,
  summary: (period: DashboardPeriod) => [...overviewKeys.all, period] as const,
};

/** KPI financiers au format attendu par les AnalyticsWidgetCard de l'overview. */
export interface FinancialKpis {
  occupancyRate: KpiTrend;
  totalRevenue: KpiTrend;
  adr: KpiTrend;
  revPAN: KpiTrend;
}

interface UseDashboardOverviewParams {
  period: DashboardPeriod;
  t: TranslationFn;
}

export function useDashboardOverview({ period, t }: UseDashboardOverviewParams) {
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: overviewKeys.summary(period),
    queryFn: () => dashboardOverviewApi.getSummary(period),
    staleTime: 30_000,
  });

  const summary: DashboardOverviewSummary | undefined = summaryQuery.data;

  const stats: DashboardStats | null = useMemo(() => {
    if (!summary) return null;
    return {
      properties: summary.properties,
      serviceRequests: { ...summary.serviceRequests, growth: 0 },
      interventions: {
        ...summary.interventions,
        // Champs du type historique non affichés par l'overview (calculés par
        // l'ancienne agrégation client, jamais rendus) — laissés à 0.
        overdue: 0,
        monthlyRevenue: 0,
      },
      revenue: { current: 0, previous: 0, growth: 0 },
    };
  }, [summary]);

  const financialKpis: FinancialKpis | null = useMemo(() => {
    if (!summary) return null;
    return {
      occupancyRate: summary.occupancyRate,
      totalRevenue: summary.totalRevenue,
      adr: summary.adr,
      revPAN: summary.revPan,
    };
  }, [summary]);

  const alerts: AlertItem[] = useMemo(() => {
    const count = summary?.urgentInterventionsCount ?? 0;
    if (count === 0) return [];
    return [{
      id: 1,
      type: 'urgent',
      title: t('dashboard.urgentInterventions'),
      description: `${count} ${t('dashboard.interventionsRequireAttention')}`,
      count,
      route: '/interventions?priority=URGENT',
    }];
  }, [summary?.urgentInterventionsCount, t]);

  const refreshAll = useMemo(
    () => () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
    [queryClient],
  );

  return {
    stats,
    financialKpis,
    alerts,
    pendingPaymentsCount: summary?.pendingPaymentsCount ?? 0,
    loading: summaryQuery.isLoading,
    error: summaryQuery.isError ? 'Erreur lors du chargement des statistiques' : null,
    refreshAll,
  };
}
