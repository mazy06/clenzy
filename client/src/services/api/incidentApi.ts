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

export interface RetestResult {
  service: string;
  status: 'UP' | 'DOWN';
  message: string;
  resolved: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/admin/incidents';

interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const incidentApi = {
  /** Liste des incidents avec filtres */
  getIncidents: async (params?: IncidentListParams): Promise<IncidentDto[]> => {
    const res: PaginatedResponse<IncidentDto> = await apiClient.get(BASE, {
      params: params as Record<string, string | number | boolean | null | undefined>,
    });
    return res.content ?? [];
  },

  /** Nombre d'incidents ouverts */
  getOpenCount: async (): Promise<number> => {
    const res: { count: number } = await apiClient.get(`${BASE}/open/count`);
    return res.count ?? 0;
  },

  /** Retester le service associe a un incident */
  retestIncident: async (id: number): Promise<RetestResult> => {
    return apiClient.post<RetestResult>(`${BASE}/${id}/retest`);
  },
};
