import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChartDataItem {
  name: string;
  value: number;
  color?: string;
}

export interface MonthlyInterventionData {
  month: string;
  total: number;
  completed: number;
  pending: number;
}

export interface PropertyStatData {
  name: string;
  interventions: number;
  cost: number;
}

export interface TeamPerformanceData {
  name: string;
  completed: number;
  inProgress: number;
  pending: number;
}

export interface FinancialMonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface InterventionReportData {
  byStatus: ChartDataItem[];
  byType: ChartDataItem[];
  byMonth: MonthlyInterventionData[];
  byPriority: ChartDataItem[];
}

export interface PropertyReportData {
  propertyStats: PropertyStatData[];
}

export interface TeamReportData {
  teamPerformance: TeamPerformanceData[];
}

export interface FinancialReportData {
  monthlyFinancials: FinancialMonthlyData[];
  costBreakdown: ChartDataItem[];
}

// ─── Shapes serveur (agrégats Baitly, ReportStatsController) ────────────────
// Le serveur renvoie des agrégats bruts (GROUP BY SQL) : types NON regroupés
// en catégories, mois au format ISO yyyy-MM, pas de couleurs. Le regroupement
// d'affichage (catégories localisées, libellés de mois, couleurs) reste ici.

interface RawChartItem {
  name: string;
  value: number;
}

interface RawInterventionStats {
  byStatus: RawChartItem[];
  byType: RawChartItem[];
  byMonth: MonthlyInterventionData[]; // month = 'yyyy-MM'
  byPriority: RawChartItem[];
}

interface RawFinancialStats {
  monthlyFinancials: FinancialMonthlyData[]; // month = 'yyyy-MM'
  costBreakdown: RawChartItem[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ff9800',
  IN_PROGRESS: '#2196f3',
  COMPLETED: '#4caf50',
  CANCELLED: '#f44336',
  SCHEDULED: '#9c27b0',
  ON_HOLD: '#607d8b',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#4caf50',
  MEDIUM: '#ff9800',
  HIGH: '#f44336',
  URGENT: '#9c27b0',
};

// ─── Helpers (présentation uniquement) ──────────────────────────────────────

/** 'yyyy-MM' → libellé localisé court (ex. 'juil. 26'). */
function monthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

/** Catégorie d'affichage d'un type brut d'intervention. */
function typeCategory(type: string): string {
  const t = type.toUpperCase();
  if (t.includes('CLEANING')) return 'Nettoyage';
  if (t.includes('REPAIR') || t.includes('MAINTENANCE')) return 'Maintenance';
  if (t.includes('GARDENING') || t.includes('PEST') || t.includes('DISINFECTION') || t.includes('RESTORATION') || t.includes('EXTERIOR')) return 'Specialise';
  return 'Autre';
}

/** Regroupe des lignes par type brut en catégories d'affichage (somme des valeurs). */
function bucketByTypeCategory(items: RawChartItem[]): ChartDataItem[] {
  const sums = new Map<string, number>();
  for (const item of items) {
    const category = typeCategory(item.name);
    sums.set(category, (sums.get(category) || 0) + item.value);
  }
  return Array.from(sums.entries()).map(([name, value], idx) => ({
    name,
    value,
    color: CHART_COLORS[idx % CHART_COLORS.length],
  }));
}

// ─── API ────────────────────────────────────────────────────────────────────

export const reportsApi = {
  async getInterventionStats(): Promise<InterventionReportData> {
    const raw = await apiClient.get<RawInterventionStats>('/reports/stats/interventions');
    return {
      byStatus: raw.byStatus.map((item) => ({
        ...item,
        color: STATUS_COLORS[item.name] || CHART_COLORS[0],
      })),
      byType: bucketByTypeCategory(raw.byType),
      byMonth: raw.byMonth.map((m) => ({ ...m, month: monthLabel(m.month) })),
      byPriority: raw.byPriority.map((item) => ({
        ...item,
        color: PRIORITY_COLORS[item.name] || CHART_COLORS[0],
      })),
    };
  },

  getPropertyStats(): Promise<PropertyReportData> {
    return apiClient.get<PropertyReportData>('/reports/stats/properties');
  },

  getTeamStats(): Promise<TeamReportData> {
    return apiClient.get<TeamReportData>('/reports/stats/teams');
  },

  async getFinancialStats(): Promise<FinancialReportData> {
    const raw = await apiClient.get<RawFinancialStats>('/reports/stats/financial');
    return {
      monthlyFinancials: raw.monthlyFinancials.map((m) => ({ ...m, month: monthLabel(m.month) })),
      costBreakdown: bucketByTypeCategory(raw.costBreakdown),
    };
  },
};
