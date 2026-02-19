import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reservationsApi } from '../services/api/reservationsApi';
import { propertiesApi } from '../services/api/propertiesApi';
import { interventionsApi } from '../services/api/interventionsApi';
import { serviceRequestsApi } from '../services/api/serviceRequestsApi';
import type { Reservation, ReservationSource } from '../services/api/reservationsApi';
import type { Property } from '../services/api/propertiesApi';
import type { DashboardPeriod } from '../modules/dashboard/DashboardDateFilter';

// ============================================================================
// Types
// ============================================================================

export interface TrendValue {
  value: number;
  previous: number;
  growth: number; // percentage
}

export interface GlobalKPIs {
  revPAN: TrendValue;
  adr: TrendValue;
  occupancyRate: TrendValue;
  totalRevenue: TrendValue;
  netMargin: TrendValue;
  roi: TrendValue;
  avgStayDuration: TrendValue;
  activeProperties: number;
  pendingRequests: number;
  activeInterventions: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface ChannelRevenue {
  name: string;
  value: number;
  color: string;
}

export interface PropertyRevenue {
  propertyId: number;
  name: string;
  revenue: number;
}

export interface RevenueMetrics {
  byMonth: MonthlyRevenue[];
  byChannel: ChannelRevenue[];
  byProperty: PropertyRevenue[];
  revenueGrowth: number;
  avgRevenuePerBooking: number;
}

export interface MonthlyOccupancy {
  month: string;
  occupied: number;
  vacant: number;
  rate: number;
}

export interface PropertyOccupancy {
  propertyId: number;
  name: string;
  rate: number;
  occupiedNights: number;
  totalNights: number;
}

export interface DayOccupancy {
  date: string;
  rate: number; // 0 to 1
}

export interface OccupancyMetrics {
  globalRate: number;
  byProperty: PropertyOccupancy[];
  byMonth: MonthlyOccupancy[];
  gapNights: number;
  heatmap: DayOccupancy[];
}

export interface PricingMetrics {
  avgPriceVsRevPAN: Array<{ month: string; avgPrice: number; revPAN: number }>;
  byPropertyType: Array<{ type: string; avgPrice: number; count: number }>;
  optimalPrice: number;
  elasticity: number; // coefficient
}

export interface ForecastScenario {
  label: string;
  revenue: number;
  occupancy: number;
}

export interface ForecastPoint {
  month: string;
  actual?: number;
  forecast?: number;
  upper?: number;
  lower?: number;
}

export interface ForecastMetrics {
  revenue30d: number;
  revenue90d: number;
  revenue365d: number;
  occupancy30d: number;
  scenarios: {
    optimistic: ForecastScenario;
    realistic: ForecastScenario;
    pessimistic: ForecastScenario;
  };
  chartData: ForecastPoint[];
}

export type RecommendationType = 'pricing' | 'calendar' | 'cost' | 'risk';
export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  estimatedImpact: number; // €
  confidence: number; // 0-100
  priority: RecommendationPriority;
}

export interface ClientMetrics {
  bySource: ChannelRevenue[];
  avgGuestCount: number;
  avgStayDuration: number;
  topProperties: Array<{ name: string; bookings: number }>;
  totalBookings: number;
}

export interface PropertyPerformanceItem {
  propertyId: number;
  name: string;
  revPAN: number;
  occupancyRate: number;
  revenue: number;
  costs: number;
  netMargin: number;
  score: number; // 0-100
}

export interface BenchmarkMetrics {
  radarData: Array<{ metric: string; portfolio: number; best: number }>;
  portfolioAvg: { revPAN: number; occupancy: number; margin: number };
  bestProperty: { name: string; revPAN: number; occupancy: number; margin: number };
  stdDevPerformance: number;
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface BusinessAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: string;
  route?: string;
}

export interface AnalyticsData {
  global: GlobalKPIs;
  revenue: RevenueMetrics;
  occupancy: OccupancyMetrics;
  pricing: PricingMetrics;
  forecast: ForecastMetrics;
  recommendations: Recommendation[];
  clients: ClientMetrics;
  properties: PropertyPerformanceItem[];
  benchmark: BenchmarkMetrics;
  alerts: BusinessAlert[];
}

// ============================================================================
// Constants
// ============================================================================

const CHANNEL_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  direct: '#4A9B8E',
  other: '#94A3B8',
};

// ============================================================================
// Helpers
// ============================================================================

function periodToDays(period: DashboardPeriod): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 30;
  }
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getMonthLabel(d));
  }
  return months;
}

function getNext6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(getMonthLabel(d));
  }
  return months;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function makeTrend(current: number, previous: number): TrendValue {
  return { value: current, previous, growth: calcGrowth(current, previous) };
}

function filterByPeriod(reservations: Reservation[], days: number): Reservation[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return reservations.filter((r) => new Date(r.checkIn) >= cutoff || new Date(r.checkOut) >= cutoff);
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// ============================================================================
// Compute functions
// ============================================================================

interface InterventionLike {
  estimatedCost?: number;
  actualCost?: number;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt?: string;
}

interface ServiceRequestLike {
  status: string;
}

function computeGlobalKPIs(
  reservations: Reservation[],
  properties: Property[],
  interventions: InterventionLike[],
  serviceRequests: ServiceRequestLike[],
  days: number,
): GlobalKPIs {
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - days * 2);

  const current = reservations.filter(
    (r) => new Date(r.checkOut) >= cutoff && new Date(r.checkIn) <= now,
  );
  const previous = reservations.filter(
    (r) => new Date(r.checkOut) >= prevCutoff && new Date(r.checkOut) < cutoff,
  );

  const activeProperties = properties.filter((p) => p.status === 'ACTIVE').length || 1;
  const totalNightsAvailable = activeProperties * days;

  // Revenue
  const curRevenue = current.reduce((s, r) => s + r.totalPrice, 0);
  const prevRevenue = previous.reduce((s, r) => s + r.totalPrice, 0);

  // Occupied nights
  const curNights = current.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
  const prevNights = previous.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);

  // Costs
  const curCosts = interventions
    .filter((i) => {
      const d = new Date(i.scheduledDate || i.createdAt || '');
      return d >= cutoff && d <= now;
    })
    .reduce((s, i) => s + (i.actualCost || i.estimatedCost || 0), 0);
  const prevCosts = interventions
    .filter((i) => {
      const d = new Date(i.scheduledDate || i.createdAt || '');
      return d >= prevCutoff && d < cutoff;
    })
    .reduce((s, i) => s + (i.actualCost || i.estimatedCost || 0), 0);

  const curRevPAN = totalNightsAvailable > 0 ? curRevenue / totalNightsAvailable : 0;
  const prevRevPAN = totalNightsAvailable > 0 ? prevRevenue / totalNightsAvailable : 0;

  const curADR = curNights > 0 ? curRevenue / curNights : 0;
  const prevADR = prevNights > 0 ? prevRevenue / prevNights : 0;

  const curOccupancy = totalNightsAvailable > 0 ? (curNights / totalNightsAvailable) * 100 : 0;
  const prevOccupancy = totalNightsAvailable > 0 ? (prevNights / totalNightsAvailable) * 100 : 0;

  const curMargin = curRevenue > 0 ? ((curRevenue - curCosts) / curRevenue) * 100 : 0;
  const prevMargin = prevRevenue > 0 ? ((prevRevenue - prevCosts) / prevRevenue) * 100 : 0;

  const curROI = curCosts > 0 ? ((curRevenue - curCosts) / curCosts) * 100 : 0;
  const prevROI = prevCosts > 0 ? ((prevRevenue - prevCosts) / prevCosts) * 100 : 0;

  const curStay = current.length > 0
    ? current.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0) / current.length
    : 0;
  const prevStay = previous.length > 0
    ? previous.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0) / previous.length
    : 0;

  // Counters
  const activePropertiesCount = properties.filter((p) => p.status === 'ACTIVE').length;
  const pendingRequestsCount = serviceRequests.filter(
    (sr) => sr.status === 'PENDING' || sr.status === 'NEW' || sr.status === 'IN_PROGRESS',
  ).length;
  const activeInterventionsCount = interventions.filter(
    (i) => i.status === 'IN_PROGRESS' || i.status === 'SCHEDULED' || i.status === 'PENDING',
  ).length;

  return {
    revPAN: makeTrend(Math.round(curRevPAN * 100) / 100, Math.round(prevRevPAN * 100) / 100),
    adr: makeTrend(Math.round(curADR * 100) / 100, Math.round(prevADR * 100) / 100),
    occupancyRate: makeTrend(Math.round(curOccupancy * 10) / 10, Math.round(prevOccupancy * 10) / 10),
    totalRevenue: makeTrend(Math.round(curRevenue), Math.round(prevRevenue)),
    netMargin: makeTrend(Math.round(curMargin * 10) / 10, Math.round(prevMargin * 10) / 10),
    roi: makeTrend(Math.round(curROI * 10) / 10, Math.round(prevROI * 10) / 10),
    avgStayDuration: makeTrend(Math.round(curStay * 10) / 10, Math.round(prevStay * 10) / 10),
    activeProperties: activePropertiesCount,
    pendingRequests: pendingRequestsCount,
    activeInterventions: activeInterventionsCount,
  };
}

function computeRevenueMetrics(
  reservations: Reservation[],
  properties: Property[],
  days: number,
): RevenueMetrics {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const prevCutoff = new Date();
  prevCutoff.setDate(prevCutoff.getDate() - days * 2);

  const current = reservations.filter(
    (r) => new Date(r.checkOut) >= cutoff,
  );
  const previous = reservations.filter(
    (r) => new Date(r.checkOut) >= prevCutoff && new Date(r.checkOut) < cutoff,
  );

  // By month
  const months = getLast6Months();
  const byMonth: MonthlyRevenue[] = months.map((month) => {
    const monthRes = reservations.filter((r) => getMonthLabel(new Date(r.checkIn)) === month);
    const revenue = monthRes.reduce((s, r) => s + r.totalPrice, 0);
    const expenses = Math.round(revenue * 0.25); // ~25% operational costs
    return { month, revenue: Math.round(revenue), expenses, profit: Math.round(revenue - expenses) };
  });

  // By channel
  const channelMap: Record<string, number> = {};
  current.forEach((r) => {
    channelMap[r.source] = (channelMap[r.source] || 0) + r.totalPrice;
  });
  const byChannel: ChannelRevenue[] = Object.entries(channelMap).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: Math.round(value),
    color: CHANNEL_COLORS[name] || '#94A3B8',
  }));

  // By property (top 5)
  const propMap: Record<number, { name: string; revenue: number }> = {};
  current.forEach((r) => {
    if (!propMap[r.propertyId]) {
      propMap[r.propertyId] = { name: r.propertyName || `Property #${r.propertyId}`, revenue: 0 };
    }
    propMap[r.propertyId].revenue += r.totalPrice;
  });
  const byProperty: PropertyRevenue[] = Object.entries(propMap)
    .map(([id, d]) => ({ propertyId: Number(id), name: d.name, revenue: Math.round(d.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const curRev = current.reduce((s, r) => s + r.totalPrice, 0);
  const prevRev = previous.reduce((s, r) => s + r.totalPrice, 0);

  return {
    byMonth,
    byChannel,
    byProperty,
    revenueGrowth: calcGrowth(Math.round(curRev), Math.round(prevRev)),
    avgRevenuePerBooking: current.length > 0 ? Math.round(curRev / current.length) : 0,
  };
}

function computeOccupancyMetrics(
  reservations: Reservation[],
  properties: Property[],
  days: number,
): OccupancyMetrics {
  const activeProps = properties.filter((p) => p.status === 'ACTIVE');
  const totalNightsAvailable = activeProps.length * days;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const now = new Date();

  const current = reservations.filter(
    (r) => new Date(r.checkOut) >= cutoff && new Date(r.checkIn) <= now && r.status !== 'cancelled',
  );

  const totalOccupied = current.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
  const globalRate = totalNightsAvailable > 0 ? (totalOccupied / totalNightsAvailable) * 100 : 0;

  // By property
  const byProperty: PropertyOccupancy[] = activeProps.map((p) => {
    const propRes = current.filter((r) => r.propertyId === p.id);
    const occupied = propRes.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
    const rate = days > 0 ? (occupied / days) * 100 : 0;
    return {
      propertyId: p.id,
      name: p.name,
      rate: Math.round(rate * 10) / 10,
      occupiedNights: occupied,
      totalNights: days,
    };
  }).sort((a, b) => b.rate - a.rate);

  // By month
  const months = getLast6Months();
  const byMonth: MonthlyOccupancy[] = months.map((month) => {
    const monthRes = reservations.filter((r) => {
      const ci = new Date(r.checkIn);
      return getMonthLabel(ci) === month && r.status !== 'cancelled';
    });
    const occupied = monthRes.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
    const monthDays = 30;
    const available = activeProps.length * monthDays;
    const vacant = Math.max(0, available - occupied);
    return {
      month,
      occupied: Math.min(occupied, available),
      vacant,
      rate: available > 0 ? Math.round((occupied / available) * 1000) / 10 : 0,
    };
  });

  // Gap nights
  const gapNights = Math.max(0, totalNightsAvailable - totalOccupied);

  // Heatmap (last 42 days = 6 weeks)
  const heatmap: DayOccupancy[] = [];
  for (let i = 41; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOccupied = current.filter(
      (r) => r.checkIn <= dateStr && r.checkOut > dateStr,
    ).length;
    heatmap.push({
      date: dateStr,
      rate: activeProps.length > 0 ? dayOccupied / activeProps.length : 0,
    });
  }

  return {
    globalRate: Math.round(globalRate * 10) / 10,
    byProperty,
    byMonth,
    gapNights,
    heatmap,
  };
}

function computePricingMetrics(
  reservations: Reservation[],
  properties: Property[],
  days: number,
): PricingMetrics {
  const months = getLast6Months();
  const activeProps = properties.filter((p) => p.status === 'ACTIVE');

  const avgPriceVsRevPAN = months.map((month) => {
    const monthRes = reservations.filter(
      (r) => getMonthLabel(new Date(r.checkIn)) === month && r.status !== 'cancelled',
    );
    const totalPrice = monthRes.reduce((s, r) => s + r.totalPrice, 0);
    const totalNights = monthRes.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
    const avgPrice = totalNights > 0 ? totalPrice / totalNights : 0;
    const available = activeProps.length * 30;
    const revPAN = available > 0 ? totalPrice / available : 0;
    return { month, avgPrice: Math.round(avgPrice), revPAN: Math.round(revPAN * 100) / 100 };
  });

  // By property type
  const typeMap: Record<string, { total: number; count: number }> = {};
  activeProps.forEach((p) => {
    const type = p.type || 'Autre';
    if (!typeMap[type]) typeMap[type] = { total: 0, count: 0 };
    typeMap[type].total += p.nightlyPrice || 0;
    typeMap[type].count += 1;
  });
  const byPropertyType = Object.entries(typeMap).map(([type, d]) => ({
    type,
    avgPrice: d.count > 0 ? Math.round(d.total / d.count) : 0,
    count: d.count,
  }));

  // Optimal price = average of top performing properties (highest RevPAN)
  const propRevPAN = activeProps.map((p) => {
    const propRes = reservations.filter((r) => r.propertyId === p.id && r.status !== 'cancelled');
    const rev = propRes.reduce((s, r) => s + r.totalPrice, 0);
    return { price: p.nightlyPrice, revPAN: days > 0 ? rev / days : 0 };
  }).sort((a, b) => b.revPAN - a.revPAN);

  const topPerformers = propRevPAN.slice(0, Math.max(1, Math.ceil(propRevPAN.length / 3)));
  const optimalPrice = topPerformers.length > 0
    ? Math.round(topPerformers.reduce((s, p) => s + p.price, 0) / topPerformers.length)
    : 0;

  // Simple elasticity: correlation between price and occupancy
  const elasticity = -0.8; // Simplified placeholder

  return { avgPriceVsRevPAN, byPropertyType, optimalPrice, elasticity };
}

function computeForecast(
  reservations: Reservation[],
  properties: Property[],
): ForecastMetrics {
  const months = getLast6Months();
  const activeProps = properties.filter((p) => p.status === 'ACTIVE').length || 1;

  // Historical monthly revenue
  const monthlyRevenue = months.map((month) => {
    const monthRes = reservations.filter(
      (r) => getMonthLabel(new Date(r.checkIn)) === month && r.status !== 'cancelled',
    );
    return monthRes.reduce((s, r) => s + r.totalPrice, 0);
  });

  // Weighted Moving Average (weights: 3, 2, 1 for last 3 months)
  const weights = [3, 2, 1];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const last3 = monthlyRevenue.slice(-3);
  const wma = last3.reduce((s, v, i) => s + v * weights[i], 0) / weightSum;

  // Seasonality factor (simplified: +10% for months 6-9, -10% for 11-2)
  const currentMonth = new Date().getMonth();
  const seasonFactor = (currentMonth >= 5 && currentMonth <= 8) ? 1.1 : (currentMonth >= 10 || currentMonth <= 1) ? 0.9 : 1.0;

  const monthlyForecast = wma * seasonFactor;
  const revenue30d = Math.round(monthlyForecast);
  const revenue90d = Math.round(monthlyForecast * 3);
  const revenue365d = Math.round(monthlyForecast * 12);

  // Occupancy forecast
  const lastMonthOccupied = reservations.filter((r) => {
    const ci = new Date(r.checkIn);
    const now = new Date();
    return ci.getMonth() === now.getMonth() - 1 && ci.getFullYear() === now.getFullYear() && r.status !== 'cancelled';
  }).reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
  const availableNights = activeProps * 30;
  const occupancy30d = availableNights > 0 ? Math.round((lastMonthOccupied / availableNights) * 100) : 0;

  // Scenarios
  const scenarios = {
    optimistic: { label: 'Optimiste', revenue: Math.round(revenue30d * 1.2), occupancy: Math.min(100, Math.round(occupancy30d * 1.15)) },
    realistic: { label: 'Réaliste', revenue: revenue30d, occupancy: occupancy30d },
    pessimistic: { label: 'Pessimiste', revenue: Math.round(revenue30d * 0.8), occupancy: Math.round(occupancy30d * 0.85) },
  };

  // Chart data
  const futureMonths = getNext6Months();
  const chartData: ForecastPoint[] = [
    ...months.map((month, i) => ({ month, actual: Math.round(monthlyRevenue[i]) })),
    ...futureMonths.map((month, i) => {
      const decay = 1 + i * 0.03; // Uncertainty grows
      const base = Math.round(monthlyForecast * (1 + (i * 0.02)));
      return {
        month,
        forecast: base,
        upper: Math.round(base * (1 + 0.15 * decay)),
        lower: Math.round(base * (1 - 0.15 * decay)),
      };
    }),
  ];

  return { revenue30d, revenue90d, revenue365d, occupancy30d, scenarios, chartData };
}

function computeRecommendations(
  global: GlobalKPIs,
  occupancy: OccupancyMetrics,
  revenue: RevenueMetrics,
  properties: Property[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Low occupancy alert
  if (global.occupancyRate.value < 60) {
    recs.push({
      id: 'rec-occ-low',
      type: 'calendar',
      title: 'Taux d\'occupation faible',
      description: `Le taux d'occupation est de ${global.occupancyRate.value}%. Réduire les prix de 10-15% pourrait augmenter les réservations.`,
      estimatedImpact: Math.round(global.totalRevenue.value * 0.12),
      confidence: 75,
      priority: 'high',
    });
  }

  // Gap nights
  if (occupancy.gapNights > 10) {
    recs.push({
      id: 'rec-gap',
      type: 'calendar',
      title: 'Nuits vacantes à combler',
      description: `${occupancy.gapNights} nuits vacantes détectées. Proposer des promotions last-minute pour les gaps > 2 jours.`,
      estimatedImpact: Math.round(occupancy.gapNights * (global.adr.value * 0.7)),
      confidence: 65,
      priority: 'medium',
    });
  }

  // High costs
  if (global.netMargin.value < 65) {
    recs.push({
      id: 'rec-cost',
      type: 'cost',
      title: 'Marge nette à optimiser',
      description: `La marge nette est de ${global.netMargin.value}%. Analyser les coûts d'intervention pour identifier des économies.`,
      estimatedImpact: Math.round(global.totalRevenue.value * 0.05),
      confidence: 70,
      priority: 'medium',
    });
  }

  // Revenue declining
  if (global.totalRevenue.growth < -5) {
    recs.push({
      id: 'rec-rev-decline',
      type: 'risk',
      title: 'Revenus en baisse',
      description: `Les revenus ont baissé de ${Math.abs(global.totalRevenue.growth)}% par rapport à la période précédente.`,
      estimatedImpact: Math.abs(global.totalRevenue.value - global.totalRevenue.previous),
      confidence: 85,
      priority: 'high',
    });
  }

  // Pricing optimization
  const avgNightlyPrice = properties.length > 0
    ? properties.reduce((s, p) => s + (p.nightlyPrice || 0), 0) / properties.length
    : 0;
  if (global.adr.value < avgNightlyPrice * 0.8) {
    recs.push({
      id: 'rec-pricing',
      type: 'pricing',
      title: 'Prix potentiellement sous-évalué',
      description: `L'ADR moyen (${Math.round(global.adr.value)}€) est inférieur au prix catalogue moyen (${Math.round(avgNightlyPrice)}€). Ajuster les prix à la hausse.`,
      estimatedImpact: Math.round(global.totalRevenue.value * 0.1),
      confidence: 60,
      priority: 'medium',
    });
  }

  // Low performing properties
  occupancy.byProperty
    .filter((p) => p.rate < 40)
    .slice(0, 2)
    .forEach((p) => {
      recs.push({
        id: `rec-prop-${p.propertyId}`,
        type: 'calendar',
        title: `${p.name} sous-performe`,
        description: `Taux d'occupation de ${p.rate}%. Revoir l'annonce, les photos ou baisser le prix.`,
        estimatedImpact: Math.round(global.adr.value * 30 * 0.3),
        confidence: 55,
        priority: 'low',
      });
    });

  return recs.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}

function computeClientMetrics(reservations: Reservation[]): ClientMetrics {
  const nonCancelled = reservations.filter((r) => r.status !== 'cancelled');

  // By source
  const sourceMap: Record<string, number> = {};
  nonCancelled.forEach((r) => {
    sourceMap[r.source] = (sourceMap[r.source] || 0) + 1;
  });
  const bySource: ChannelRevenue[] = Object.entries(sourceMap).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    color: CHANNEL_COLORS[name] || '#94A3B8',
  }));

  const avgGuestCount = nonCancelled.length > 0
    ? Math.round((nonCancelled.reduce((s, r) => s + r.guestCount, 0) / nonCancelled.length) * 10) / 10
    : 0;

  const avgStayDuration = nonCancelled.length > 0
    ? Math.round((nonCancelled.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0) / nonCancelled.length) * 10) / 10
    : 0;

  // Top properties by booking count
  const propMap: Record<string, number> = {};
  nonCancelled.forEach((r) => {
    const name = r.propertyName || `Property #${r.propertyId}`;
    propMap[name] = (propMap[name] || 0) + 1;
  });
  const topProperties = Object.entries(propMap)
    .map(([name, bookings]) => ({ name, bookings }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  return { bySource, avgGuestCount, avgStayDuration, topProperties, totalBookings: nonCancelled.length };
}

function computePropertyPerformance(
  reservations: Reservation[],
  properties: Property[],
  interventions: InterventionLike[],
  days: number,
): PropertyPerformanceItem[] {
  const activeProps = properties.filter((p) => p.status === 'ACTIVE');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return activeProps.map((p) => {
    const propRes = reservations.filter(
      (r) => r.propertyId === p.id && new Date(r.checkOut) >= cutoff && r.status !== 'cancelled',
    );
    const revenue = propRes.reduce((s, r) => s + r.totalPrice, 0);
    const occupied = propRes.reduce((s, r) => s + daysBetween(r.checkIn, r.checkOut), 0);
    const occupancyRate = days > 0 ? (occupied / days) * 100 : 0;
    const revPAN = days > 0 ? revenue / days : 0;

    const costs = interventions
      .filter((i) => {
        const iDate = new Date(i.scheduledDate || i.createdAt || '');
        return iDate >= cutoff;
      })
      .reduce((s, i) => s + (i.actualCost || i.estimatedCost || 0), 0) / (activeProps.length || 1);

    const netMargin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;

    // Score = weighted average of occupancy (40%), RevPAN (30%), margin (30%)
    const maxRevPAN = 200; // Normalized
    const score = Math.min(100, Math.round(
      (Math.min(occupancyRate, 100) / 100) * 40 +
      (Math.min(revPAN, maxRevPAN) / maxRevPAN) * 30 +
      (Math.min(Math.max(netMargin, 0), 100) / 100) * 30
    ));

    return {
      propertyId: p.id,
      name: p.name,
      revPAN: Math.round(revPAN * 100) / 100,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      revenue: Math.round(revenue),
      costs: Math.round(costs),
      netMargin: Math.round(netMargin * 10) / 10,
      score,
    };
  }).sort((a, b) => b.score - a.score);
}

function computeBenchmark(propertyPerf: PropertyPerformanceItem[]): BenchmarkMetrics {
  if (propertyPerf.length === 0) {
    return {
      radarData: [],
      portfolioAvg: { revPAN: 0, occupancy: 0, margin: 0 },
      bestProperty: { name: '-', revPAN: 0, occupancy: 0, margin: 0 },
      stdDevPerformance: 0,
    };
  }

  const avg = {
    revPAN: propertyPerf.reduce((s, p) => s + p.revPAN, 0) / propertyPerf.length,
    occupancy: propertyPerf.reduce((s, p) => s + p.occupancyRate, 0) / propertyPerf.length,
    margin: propertyPerf.reduce((s, p) => s + p.netMargin, 0) / propertyPerf.length,
  };

  const best = propertyPerf[0]; // Already sorted by score desc

  const radarData = [
    { metric: 'RevPAN', portfolio: Math.round(avg.revPAN), best: Math.round(best.revPAN) },
    { metric: 'Occupation', portfolio: Math.round(avg.occupancy), best: Math.round(best.occupancyRate) },
    { metric: 'Marge', portfolio: Math.round(avg.margin), best: Math.round(best.netMargin) },
    { metric: 'Score', portfolio: Math.round(propertyPerf.reduce((s, p) => s + p.score, 0) / propertyPerf.length), best: best.score },
  ];

  return {
    radarData,
    portfolioAvg: { revPAN: Math.round(avg.revPAN * 100) / 100, occupancy: Math.round(avg.occupancy * 10) / 10, margin: Math.round(avg.margin * 10) / 10 },
    bestProperty: { name: best.name, revPAN: best.revPAN, occupancy: best.occupancyRate, margin: best.netMargin },
    stdDevPerformance: Math.round(stdDev(propertyPerf.map((p) => p.score)) * 10) / 10,
  };
}

function computeBusinessAlerts(
  global: GlobalKPIs,
  occupancy: OccupancyMetrics,
  propertyPerf: PropertyPerformanceItem[],
): BusinessAlert[] {
  const alerts: BusinessAlert[] = [];

  if (occupancy.gapNights > 20) {
    alerts.push({
      id: 'alert-gap',
      severity: 'critical',
      title: 'Nuits vacantes élevées',
      description: `${occupancy.gapNights} nuits vacantes sur la période. Action immédiate recommandée.`,
      action: 'Revoir la stratégie tarifaire',
      route: '/properties',
    });
  }

  if (global.occupancyRate.value < 50) {
    alerts.push({
      id: 'alert-occ',
      severity: 'critical',
      title: 'Taux d\'occupation critique',
      description: `Seulement ${global.occupancyRate.value}% d'occupation. Seuil minimum recommandé : 60%.`,
      action: 'Activer des promotions',
    });
  }

  if (global.totalRevenue.growth < -10) {
    alerts.push({
      id: 'alert-rev',
      severity: 'warning',
      title: 'Baisse significative des revenus',
      description: `Revenus en baisse de ${Math.abs(global.totalRevenue.growth)}% vs période précédente.`,
      action: 'Analyser les causes',
      route: '/reports',
    });
  }

  if (global.netMargin.value < 50) {
    alerts.push({
      id: 'alert-margin',
      severity: 'warning',
      title: 'Marge nette insuffisante',
      description: `Marge nette de ${global.netMargin.value}%. Objectif minimum : 60%.`,
      action: 'Optimiser les coûts',
    });
  }

  propertyPerf
    .filter((p) => p.occupancyRate < 30)
    .forEach((p) => {
      alerts.push({
        id: `alert-prop-${p.propertyId}`,
        severity: 'info',
        title: `${p.name} — occupation très basse`,
        description: `${p.occupancyRate}% d'occupation. Revoir l'annonce ou le prix.`,
        action: 'Revoir le listing',
        route: `/properties/${p.propertyId}`,
      });
    });

  return alerts.sort((a, b) => {
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

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

  // Fetch interventions (mock mode only — fournit les coûts pour marge/ROI)
  const interventionsQuery = useQuery({
    queryKey: ['analytics-interventions', isMock],
    queryFn: () => interventionsApi.getAll({ size: 1000 }),
    staleTime: 60_000,
    enabled: isMock,
  });

  // Fetch service requests (pour compteur "demandes en cours")
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

  // En mode mock : utiliser les interventions mock ; sinon le paramètre externe
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
