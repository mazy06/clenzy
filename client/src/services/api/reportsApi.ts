import { interventionsApi, Intervention } from './interventionsApi';
import { propertiesApi, Property } from './propertiesApi';
import { teamsApi, Team } from './teamsApi';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// ─── Unwrap paginated responses ─────────────────────────────────────────────

/** Extracts the array from a paginated Spring Boot response or a plain array. */
function unwrapArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'content' in data) {
    const content = (data as { content: unknown }).content;
    if (Array.isArray(content)) return content as T[];
  }
  return [];
}

// ─── API ────────────────────────────────────────────────────────────────────

export const reportsApi = {
  async getInterventionStats(): Promise<InterventionReportData> {
    const interventions = await interventionsApi.getAll({ size: 1000 } as any);
    const list: Intervention[] = unwrapArray<Intervention>(interventions);

    // By status
    const statusGroups = groupBy(list, (i) => i.status || 'UNKNOWN');
    const byStatus: ChartDataItem[] = Object.entries(statusGroups).map(([status, items]) => ({
      name: status,
      value: items.length,
      color: STATUS_COLORS[status] || CHART_COLORS[0],
    }));

    // By type (group into categories: cleaning, maintenance, specialized, other)
    const typeGroups = groupBy(list, (i) => {
      const t = (i.type || '').toUpperCase();
      if (t.includes('CLEANING')) return 'Nettoyage';
      if (t.includes('REPAIR') || t.includes('MAINTENANCE')) return 'Maintenance';
      if (t.includes('GARDENING') || t.includes('PEST') || t.includes('DISINFECTION') || t.includes('RESTORATION') || t.includes('EXTERIOR')) return 'Specialise';
      return 'Autre';
    });
    const byType: ChartDataItem[] = Object.entries(typeGroups).map(([type, items], idx) => ({
      name: type,
      value: items.length,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    // By month (last 6 months)
    const months = getLast6Months();
    const byMonth: MonthlyInterventionData[] = months.map((month) => {
      const monthInterventions = list.filter((i) => {
        const d = new Date(i.scheduledDate || i.createdAt);
        return getMonthLabel(d) === month;
      });
      return {
        month,
        total: monthInterventions.length,
        completed: monthInterventions.filter((i) => i.status === 'COMPLETED').length,
        pending: monthInterventions.filter((i) => i.status === 'PENDING' || i.status === 'SCHEDULED').length,
      };
    });

    // By priority
    const priorityGroups = groupBy(list, (i) => i.priority || 'MEDIUM');
    const byPriority: ChartDataItem[] = Object.entries(priorityGroups).map(([priority, items]) => ({
      name: priority,
      value: items.length,
      color: PRIORITY_COLORS[priority] || CHART_COLORS[0],
    }));

    return { byStatus, byType, byMonth, byPriority };
  },

  async getPropertyStats(): Promise<PropertyReportData> {
    const [properties, interventions] = await Promise.all([
      propertiesApi.getAll({ size: 1000 }),
      interventionsApi.getAll({ size: 1000 } as any),
    ]);

    const propList: Property[] = unwrapArray<Property>(properties);
    const intList: Intervention[] = unwrapArray<Intervention>(interventions);

    const interventionsByProperty = groupBy(intList, (i) => String(i.propertyId));

    const propertyStats: PropertyStatData[] = propList
      .map((p) => {
        const propInterventions = interventionsByProperty[String(p.id)] || [];
        const totalCost = propInterventions.reduce((sum, i) => sum + (i.actualCost || i.estimatedCost || 0), 0);
        return {
          name: p.name,
          interventions: propInterventions.length,
          cost: Math.round(totalCost),
        };
      })
      .sort((a, b) => b.interventions - a.interventions)
      .slice(0, 10);

    return { propertyStats };
  },

  async getTeamStats(): Promise<TeamReportData> {
    const [teams, interventions] = await Promise.all([
      teamsApi.getAll(),
      interventionsApi.getAll({ size: 1000 } as any),
    ]);

    const teamList: Team[] = unwrapArray<Team>(teams);
    const intList: Intervention[] = unwrapArray<Intervention>(interventions);

    const teamPerformance: TeamPerformanceData[] = teamList.map((team) => {
      const teamInterventions = intList.filter(
        (i) => i.assignedToType === 'team' && i.assignedToId === team.id
      );
      return {
        name: team.name,
        completed: teamInterventions.filter((i) => i.status === 'COMPLETED').length,
        inProgress: teamInterventions.filter((i) => i.status === 'IN_PROGRESS').length,
        pending: teamInterventions.filter(
          (i) => i.status === 'PENDING' || i.status === 'SCHEDULED'
        ).length,
      };
    });

    return { teamPerformance };
  },

  async getFinancialStats(): Promise<FinancialReportData> {
    const interventions = await interventionsApi.getAll({ size: 1000 } as any);
    const list: Intervention[] = unwrapArray<Intervention>(interventions);

    // Monthly financials (last 6 months) - computed from intervention costs
    const months = getLast6Months();
    const monthlyFinancials: FinancialMonthlyData[] = months.map((month) => {
      const monthInterventions = list.filter((i) => {
        const d = new Date(i.scheduledDate || i.createdAt);
        return getMonthLabel(d) === month;
      });
      const expenses = monthInterventions.reduce(
        (sum, i) => sum + (i.actualCost || i.estimatedCost || 0),
        0
      );
      // Revenue is a rough estimate - in a real app this would come from a billing API
      const revenue = expenses * 1.3;
      return {
        month,
        revenue: Math.round(revenue),
        expenses: Math.round(expenses),
        profit: Math.round(revenue - expenses),
      };
    });

    // Cost breakdown by intervention type category
    const typeGroups = groupBy(list, (i) => {
      const t = (i.type || '').toUpperCase();
      if (t.includes('CLEANING')) return 'Nettoyage';
      if (t.includes('REPAIR') || t.includes('MAINTENANCE')) return 'Maintenance';
      if (t.includes('GARDENING') || t.includes('PEST') || t.includes('DISINFECTION') || t.includes('RESTORATION') || t.includes('EXTERIOR')) return 'Specialise';
      return 'Autre';
    });
    const costBreakdown: ChartDataItem[] = Object.entries(typeGroups).map(
      ([type, items], idx) => ({
        name: type,
        value: Math.round(
          items.reduce((sum, i) => sum + (i.actualCost || i.estimatedCost || 0), 0)
        ),
        color: CHART_COLORS[idx % CHART_COLORS.length],
      })
    );

    return { monthlyFinancials, costBreakdown };
  },
};
