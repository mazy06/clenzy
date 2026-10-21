import type { BaitlyReportKind } from './baitlyReportMetrics';

interface PanelLayout { columns: 4 | 6 | 8 | 12; height?: number; order?: number }

/** La taille suit la lecture : évolution large, répartition étroite, tableau entier. */
const layouts: Record<BaitlyReportKind, Record<string, PanelLayout>> = {
  overview: {
    revenueTrend: { columns: 8, height: 340 }, channels: { columns: 4 }, occupancy: { columns: 4 },
    alerts: { columns: 4 }, recommendations: { columns: 4 }, highlights: { columns: 12 },
  },
  revenue: {
    trend: { columns: 8, height: 340 }, channels: { columns: 4 }, properties: { columns: 8 },
    costs: { columns: 4 }, highlights: { columns: 12 },
  },
  occupancy: {
    byMonth: { columns: 8, height: 340 }, byProperty: { columns: 4 }, sources: { columns: 4 },
    topProperties: { columns: 8 }, highlights: { columns: 12 },
  },
  pricing: {
    forecast: { columns: 8, height: 360 }, scenarios: { columns: 4, order: 1 },
    priceVsRevpan: { columns: 8, height: 340, order: 2 }, byType: { columns: 4, order: 3 }, highlights: { columns: 12, order: 4 },
  },
  pace: {
    otbVsStly: { columns: 8, height: 340 }, pace: { columns: 4 }, curve: { columns: 8, height: 340 },
    pickup: { columns: 4 }, table: { columns: 12, order: 4 }, highlights: { columns: 12, order: 5 },
  },
  properties: {
    score: { columns: 6 }, margin: { columns: 6, order: 1 }, interventions: { columns: 6, order: 2 },
    cost: { columns: 6, order: 3 }, benchmark: { columns: 6, order: 4 }, highlights: { columns: 6, order: 5 },
  },
  interventions: {
    trend: { columns: 8, height: 340 }, status: { columns: 4 }, type: { columns: 6 },
    priority: { columns: 6 }, highlights: { columns: 12 },
  },
  teams: { load: { columns: 8, height: 360 }, status: { columns: 4, order: 1 }, rate: { columns: 8, order: 2 }, highlights: { columns: 4, order: 3 } },
};

export function reportPanelLayout(report: BaitlyReportKind, key: string): PanelLayout {
  return layouts[report][key] ?? { columns: 6 };
}
