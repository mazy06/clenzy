import { apiClient } from '../apiClient';

// ─── Types (miroir des DTOs backend ReportView* / ReportResult*) ─────────────

export type ReportDimension = 'PROPERTY' | 'CHANNEL' | 'PERIOD' | 'COUNTRY';
export type ReportMetric = 'REVENUE' | 'ADR' | 'REVPAR' | 'OCCUPANCY' | 'FEES' | 'MARGIN';
export type ReportGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface ReportView {
  id: number;
  name: string;
  dimensions: string[];
  metrics: string[];
  granularity: string;
  filtersJson: string | null;
}

export interface ReportExecutionRequest {
  dimensions: string[];
  metrics: string[];
  granularity: string;
  from: string; // ISO date
  to: string;   // ISO date
}

export interface ReportResultRow {
  dimensionValues: string[];
  metrics: Record<string, number>;
}

export interface ReportResult {
  dimensions: string[];
  metrics: string[];
  granularity: string;
  from: string;
  to: string;
  currency: string;
  rows: ReportResultRow[];
}

// ─── API (Report Builder — vues sauvegardées + exécution, RMS R1) ────────────

export const reportViewsApi = {
  list: () => apiClient.get<ReportView[]>('/reports/views'),

  create: (view: { name: string; dimensions: string[]; metrics: string[]; granularity: string }) =>
    apiClient.post<ReportView>('/reports/views', view),

  remove: (id: number) => apiClient.delete<void>(`/reports/views/${id}`),

  execute: (request: ReportExecutionRequest) =>
    apiClient.post<ReportResult>('/reports/views/execute', request),

  executeView: (id: number, from: string, to: string) =>
    apiClient.post<ReportResult>(`/reports/views/${id}/execute`, { from, to }),
};
