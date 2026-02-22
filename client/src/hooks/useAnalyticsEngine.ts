import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../services/api/reservationsApi';
import { propertiesApi } from '../services/api/propertiesApi';
import { interventionsApi } from '../services/api/interventionsApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';
import type { Property } from '../services/api/propertiesApi';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';
import type { AnalyticsData, InterventionLike, ServiceRequestLike } from '../types/analytics';
import { periodToDays } from './analyticsUtils';
import {
  computeGlobalKPIs,
  computeRevenueMetrics,
  computeOccupancyMetrics,
  computePricingMetrics,
  computeForecast,
  computeClientMetrics,
  computePropertyPerformance,
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
}

export function useAnalyticsEngine({ period, interventions }: UseAnalyticsEngineParams) {
  const days = periodToDays(period);
  const isMock = localStorage.getItem('clenzy_analytics_mock') === 'true';

  // Fetch reservations
  const reservationsQuery = useQuery({
    queryKey: ['analytics-reservations', isMock],
    queryFn: () => reservationsApi.getAll(),
    staleTime: 60_000,
  });

  // Fetch properties
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
  });

  // Fetch interventions (mock mode only -- provides costs for margin/ROI)
  const interventionsQuery = useQuery({
    queryKey: ['analytics-interventions', isMock],
    queryFn: () => interventionsApi.getAll({ size: 1000 }),
    staleTime: 60_000,
    enabled: isMock,
  });

  // Fetch service requests (for pending requests counter)
  const serviceRequestsQuery = useQuery({
    queryKey: ['analytics-service-requests', isMock],
    queryFn: () => serviceRequestsApi.getAll().then((res) => {
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'content' in (res as Record<string, unknown>)) {
        return (res as unknown as { content: ServiceRequestLike[] }).content || [];
      }
      return [];
    }),
    staleTime: 60_000,
  });

  const reservations = reservationsQuery.data || [];
  const properties = propertiesQuery.data || [];
  const serviceRequests = serviceRequestsQuery.data || [];
  const loading = reservationsQuery.isLoading || propertiesQuery.isLoading || (isMock && interventionsQuery.isLoading);

  // In mock mode: use mock interventions; otherwise the external parameter
  const effectiveInterventions = useMemo<InterventionLike[]>(() => {
    if (isMock && interventionsQuery.data) {
      return interventionsQuery.data.map((i) => ({
        estimatedCost: i.estimatedCost,
        actualCost: i.actualCost,
        type: i.type,
        status: i.status,
        scheduledDate: i.scheduledDate,
        createdAt: i.createdAt,
      }));
    }
    return interventions;
  }, [isMock, interventionsQuery.data, interventions]);

  const analytics = useMemo<AnalyticsData | null>(() => {
    if (reservations.length === 0 && properties.length === 0) return null;

    const global = computeGlobalKPIs(reservations, properties, effectiveInterventions, serviceRequests, days);
    const revenue = computeRevenueMetrics(reservations, properties, days);
    const occupancy = computeOccupancyMetrics(reservations, properties, days);
    const pricing = computePricingMetrics(reservations, properties, days);
    const forecast = computeForecast(reservations, properties);
    const clients = computeClientMetrics(reservations);
    const propertyPerf = computePropertyPerformance(reservations, properties, effectiveInterventions, days);
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
  }, [reservations, properties, effectiveInterventions, serviceRequests, days]);

  return { analytics, loading };
}
