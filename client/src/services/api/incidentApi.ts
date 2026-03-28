import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'P1' | 'P2' | 'P3';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface IncidentDto {
  id: number;
  type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  serviceName: string;
  title: string;
  description: string;
  openedAt: string;
  resolvedAt: string | null;
  resolutionMinutes: number | null;
  autoDetected: boolean;
  autoResolved: boolean;
}

export interface IncidentListParams {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  page?: number;
  size?: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/admin/incidents';

export const incidentApi = {
  /** Liste des incidents avec filtres */
  getIncidents: (params?: IncidentListParams): Promise<IncidentDto[]> =>
    apiClient.get(BASE, { params: params as Record<string, string | number | boolean | null | undefined> }),

  /** Nombre d'incidents ouverts */
  getOpenCount: (): Promise<number> =>
    apiClient.get(`${BASE}/open/count`),
};
