import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../services/api/reservationsApi';
import { propertiesApi } from '../services/api/propertiesApi';
import { propertiesListQuery } from './usePropertiesList';
import { portfolioAnalyticsQuery } from '../services/api/portfolioAnalyticsApi';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';
import type { AnalyticsData, InterventionLike, PropertyPerformanceItem } from '../types/analytics';
import { periodToDays } from './analyticsUtils';
import {
  computePricingMetrics,
  computeForecast,
  computeClientMetrics,
  computeBenchmark,
  computeRecommendations,
  computeBusinessAlerts,
} from './analyticsComputeFunctions';

// Re-export all types so existing consumers keep working with the same import path.
export type {
  TrendValue,
  GlobalKPIs,
  MonthlyRevenue,
  ChannelRevenue,
  PropertyRevenue,
  RevenueMetrics,
  MonthlyOccupancy,
  PropertyOccupancy,
  DayOccupancy,
  OccupancyMetrics,
  PricingMetrics,
  ForecastScenario,
  ForecastPoint,
  ForecastMetrics,
  RecommendationType,
  RecommendationPriority,
  Recommendation,
  ClientMetrics,
  PropertyPerformanceItem,
  BenchmarkMetrics,
  AlertSeverity,
  BusinessAlert,
  AnalyticsData,
} from '../types/analytics';

// ============================================================================
// Main hook
// ============================================================================

interface UseAnalyticsEngineParams {
  period: DashboardPeriod;
  interventions: InterventionLike[];
  /**
   * false = moteur inactif : aucun fetch, aucun compute (analytics=null).
   * Permet aux surfaces qui n'affichent pas d'analytics (ex : onglet non
   * visible) de monter le hook sans payer les 3 fetchs + l'agrégation lourde.
   */
  enabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `interventions` conservé pour
// compat de signature ; les coûts viennent désormais du serveur (portfolio + performance-summaries).
export function useAnalyticsEngine({ period, interventions: _interventions, enabled = true }: UseAnalyticsEngineParams) {
  const days = periodToDays(period);

  // Slices rapatriées côté serveur (formules corrigées, coûts d'intervention réels).
  const portfolioQuery = useQuery({
    ...portfolioAnalyticsQuery(period),
    staleTime: 60_000,
    enabled,
  });

  // Performance par logement (serveur) — remplace computePropertyPerformance.
  const performanceQuery = useQuery({
    queryKey: ['analytics-performance', days],
    queryFn: () => propertiesApi.getPerformanceSummaries(days),
    staleTime: 60_000,
    enabled,
  });

  // Données brutes encore nécessaires aux slices restées client (pricing, forecast,
  // clients — heuristiques ou dérivées, sans gain de correctness à porter serveur).
  const reservationsQuery = useQuery({
    queryKey: ['analytics-reservations'],
    queryFn: () => reservationsApi.getAll(),
    staleTime: 60_000,
    enabled,
  });
  const propertiesQuery = useQuery({
    ...propertiesListQuery(),
    enabled,
  });

  const reservations = useMemo(() => reservationsQuery.data || [], [reservationsQuery.data]);
  const properties = useMemo(() => propertiesQuery.data || [], [propertiesQuery.data]);
  // Les réponses portfolio/performance arrivent séparément. Ne pas recalculer
  // les projections lourdes à chaque arrivée quand leurs sources sont identiques.
  const pricing = useMemo(() => enabled ? computePricingMetrics(reservations, properties, days) : null, [enabled, reservations, properties, days]);
  const forecast = useMemo(() => enabled ? computeForecast(reservations, properties) : null, [enabled, reservations, properties]);
  const clients = useMemo(() => {
    if (!enabled) return null;
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days);
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return computeClientMetrics(reservations, { from: dateKey(cutoff), to: dateKey(today) });
  }, [enabled, reservations, days]);
  const loading = enabled
    && (portfolioQuery.isLoading || performanceQuery.isLoading
      || reservationsQuery.isLoading || propertiesQuery.isLoading);

  const analytics = useMemo<AnalyticsData | null>(() => {
    if (!enabled || !pricing || !forecast || !clients) return null;
    const portfolio = portfolioQuery.data;
    if (!portfolio) return null;

    const { global, revenue, occupancy } = portfolio;
    // Mapping DTO serveur (revPan) → type client (revPAN), sans windowDays.
    const propertyPerf: PropertyPerformanceItem[] = (performanceQuery.data || []).map((p) => ({
      propertyId: p.propertyId,
      name: p.name,
      revPAN: p.revPan,
      occupancyRate: p.occupancyRate,
      revenue: p.revenue,
      costs: p.costs,
      netMargin: p.netMargin,
      score: p.score,
    }));

    const benchmark = computeBenchmark(propertyPerf);
    const recommendations = computeRecommendations(global, occupancy, revenue, properties);
    const alerts = computeBusinessAlerts(global, occupancy, propertyPerf);

    return {
      global,
      revenue,
      occupancy,
      pricing,
      forecast,
      recommendations,
      clients,
      properties: propertyPerf,
      benchmark,
      alerts,
    };
  }, [enabled, portfolioQuery.data, performanceQuery.data, properties, pricing, forecast, clients]);

  return { analytics, loading };
}
