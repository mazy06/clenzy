// ============================================================================
// Analytics Types
// Extracted from useAnalyticsEngine.ts for reuse across the analytics module.
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
  estimatedImpact: number; // euro
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

export interface InterventionLike {
  estimatedCost?: number;
  actualCost?: number;
  type: string;
  status: string;
  scheduledDate?: string;
  createdAt?: string;
}

export interface ServiceRequestLike {
  status: string;
}
