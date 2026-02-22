import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiStatus = 'OK' | 'WARNING' | 'CRITICAL';

export interface KpiItem {
  id: string;
  name: string;
  value: string;
  rawValue: number;
  target: string;
  targetValue: number;
  unit: string;
  status: KpiStatus;
  critical: boolean;
  weight: number;
}

export interface KpiSnapshot {
  id: number | null;
  capturedAt: string;
  readinessScore: number;
  criticalFailed: boolean;
  kpis: KpiItem[];
  source: string;
}

export interface KpiHistoryPoint {
  capturedAt: string;
  readinessScore: number;
  uptimePct: number;
  syncErrorRatePct: number;
  apiLatencyP95Ms: number;
  calendarLatencyP95Ms: number;
  inventoryCoherencePct: number;
  doubleBookings: number;
  syncAvailabilityPct: number;
  outboxDrainTimeMs: number;
  reconciliationDivergencePct: number;
}

export interface KpiHistory {
  points: KpiHistoryPoint[];
  totalPoints: number;
  from: string;
  to: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/admin/kpi';

export const kpiApi = {
  /** Snapshot KPI temps reel */
  getCurrentSnapshot: (): Promise<KpiSnapshot> =>
    apiClient.get(`${BASE}/current`),

  /** Historique des snapshots */
  getHistory: (hours?: number): Promise<KpiHistory> =>
    apiClient.get(`${BASE}/history`, { params: { hours } }),

  /** Force un refresh et persiste un nouveau snapshot */
  refreshSnapshot: (): Promise<KpiSnapshot> =>
    apiClient.post(`${BASE}/refresh`, {}),
};
