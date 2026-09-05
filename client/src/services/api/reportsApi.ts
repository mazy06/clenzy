import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChartDataItem {
  name: string;
  value: number;
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
// en catégories, mois au format ISO yyyy-MM. Le regroupement d'affichage
// (catégories, libellés de mois) reste ici.
//
// Les COULEURS, elles, ne passent plus par cette couche : chaque série portait
// un hexadécimal en dur (#2196f3, #4caf50…) hors de la charte, qui ne suivait
// ni le thème sombre ni la teinte d'accent. Les graphiques prennent désormais
// les jetons de série `--bui-chart-*`.

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
  return Array.from(sums.entries()).map(([name, value]) => ({ name, value }));
}

// ─── API ────────────────────────────────────────────────────────────────────

export const reportsApi = {
  async getInterventionStats(): Promise<InterventionReportData> {
    const raw = await apiClient.get<RawInterventionStats>('/reports/stats/interventions');
    return {
      byStatus: raw.byStatus,
      byType: bucketByTypeCategory(raw.byType),
      byMonth: raw.byMonth.map((m) => ({ ...m, month: monthLabel(m.month) })),
      byPriority: raw.byPriority,
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
