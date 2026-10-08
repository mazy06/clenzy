import type { FinancialKpis } from '../../hooks/useDashboardOverview';
import type { DashboardFinancialContext, KpiTrend } from '../../services/api/dashboardOverviewApi';

export const KPI_KEYS = ['occupancy', 'revenue', 'adr', 'revpan', 'bookings', 'rating'] as const;
export type DashboardKpiKey = typeof KPI_KEYS[number];
export type KpiLevel = 'excellent' | 'good' | 'watch' | 'alarming' | 'critical' | 'unrated';
export type KpiReason = 'level' | 'noData' | 'noReviews' | 'noBaseline' | 'fewReviews' | 'fewBookings' | 'priceBalance';
export interface KpiAssessment { level: KpiLevel; reason: KpiReason }

/** Product guideposts, not market benchmarks. Keep thresholds and their explanation together. */
export const KPI_THRESHOLDS = {
  occupancy: [80, 60, 40, 20],
  rating: [4.8, 4.3, 3.8, 3],
  trend: [15, 0, -15, -35],
} as const;
export const KPI_LEVELS = ['excellent', 'good', 'watch', 'alarming', 'critical'] as const;
export const KPI_SEVERITY: Record<KpiLevel, number> = { excellent: 0, good: 1, watch: 2, alarming: 3, critical: 4, unrated: -1 };

function classify(value: number, thresholds: readonly number[]): KpiLevel {
  return KPI_LEVELS[thresholds.findIndex((threshold) => value >= threshold)] ?? 'critical';
}

export function kpiTrend(key: DashboardKpiKey, kpis: FinancialKpis): KpiTrend | undefined {
  return ({ occupancy: kpis.occupancyRate, revenue: kpis.totalRevenue, adr: kpis.adr,
    revpan: kpis.revPAN, bookings: kpis.bookings, rating: undefined })[key];
}

export function hasKpiBaseline(trend?: KpiTrend): boolean {
  return !!trend && Number.isFinite(trend.value) && trend.value >= 0
    && Number.isFinite(trend.growth) && trend.previousValue != null
    && Number.isFinite(trend.previousValue) && trend.previousValue > 0;
}

export function assessDashboardKpi(key: DashboardKpiKey, kpis: FinancialKpis | null | undefined,
  context?: DashboardFinancialContext, activeProperties?: number): KpiAssessment {
  const unrated = (reason: KpiReason): KpiAssessment => ({ level: 'unrated', reason });
  if (!kpis) return unrated('noData');
  if (key === 'rating') {
    if (!Number.isFinite(kpis.guestRating.count) || !Number.isFinite(kpis.guestRating.average) || kpis.guestRating.average <= 0
      || kpis.guestRating.average > 5 || kpis.guestRating.count <= 0) return unrated('noReviews');
    if (kpis.guestRating.count < 5) return unrated('fewReviews');
    return { level: classify(kpis.guestRating.average, KPI_THRESHOLDS.rating), reason: 'level' };
  }
  const trend = kpiTrend(key, kpis)!;
  if (activeProperties === 0 || context?.availableNights === 0 || !Number.isFinite(trend.value) || trend.value < 0)
    return unrated('noData');
  if (key === 'occupancy') {
    // Older servers cannot distinguish zero demand from a fully closed calendar.
    if (trend.value > 100 || (trend.value === 0 && context?.availableNights == null)) return unrated('noData');
    if (trend.value === 0 && !hasKpiBaseline(trend)) return unrated('noBaseline');
    return { level: classify(trend.value, KPI_THRESHOLDS.occupancy), reason: 'level' };
  }
  if (!hasKpiBaseline(trend)) return unrated('noBaseline');
  if (key === 'bookings' && trend.previousValue! < 5) return unrated('fewBookings');
  if (key === 'adr' && trend.growth >= 0 && (!hasKpiBaseline(kpis.revPAN) || kpis.revPAN.growth < 0))
    return { level: 'watch', reason: 'priceBalance' };
  return { level: classify(trend.growth, KPI_THRESHOLDS.trend), reason: 'level' };
}
