import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isMockEnabled } from '../services/storageService';
import { reservationsApi } from '../services/api/reservationsApi';
import { propertiesApi } from '../services/api/propertiesApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';
import { portfolioAnalyticsApi } from '../services/api/portfolioAnalyticsApi';
import type { Property } from '../services/api/propertiesApi';
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
  const isMock = isMockEnabled('analytics');

  // Slices rapatriées côté serveur (formules corrigées, coûts d'intervention réels).
  const portfolioQuery = useQuery({
    queryKey: ['analytics-portfolio', period, isMock],
    queryFn: () => portfolioAnalyticsApi.get(period),
    staleTime: 60_000,
    enabled,
  });

  // Performance par logement (serveur) — remplace computePropertyPerformance.
  const performanceQuery = useQuery({
    queryKey: ['analytics-performance', days, isMock],
    queryFn: () => propertiesApi.getPerformanceSummaries(days),
    staleTime: 60_000,
    enabled,
  });

  // Données brutes encore nécessaires aux slices restées client (pricing, forecast,
  // clients — heuristiques ou dérivées, sans gain de correctness à porter serveur).
  const reservationsQuery = useQuery({
    queryKey: ['analytics-reservations', isMock],
    queryFn: () => reservationsApi.getAll(),
    staleTime: 60_000,
    enabled,
  });
  const propertiesQuery = useQuery({
    queryKey: ['analytics-properties', isMock],
    queryFn: () => propertiesApi.getAll({ size: 1000 }).then((res) => {
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'content' in (res as Record<string, unknown>)) {
        return (res as unknown as { content: Property[] }).content || [];
      }
      return [];
    }),
    staleTime: 60_000,
    enabled,
  });

  const reservations = useMemo(() => reservationsQuery.data || [], [reservationsQuery.data]);
  const properties = useMemo(() => propertiesQuery.data || [], [propertiesQuery.data]);
  const loading = enabled
    && (portfolioQuery.isLoading || performanceQuery.isLoading
      || reservationsQuery.isLoading || propertiesQuery.isLoading);

  const analytics = useMemo<AnalyticsData | null>(() => {
    if (!enabled) return null;
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

    const pricing = computePricingMetrics(reservations, properties, days);
    const forecast = computeForecast(reservations, properties);
    const clients = computeClientMetrics(reservations);
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
  }, [enabled, portfolioQuery.data, performanceQuery.data, reservations, properties, days]);

  return { analytics, loading };
}
