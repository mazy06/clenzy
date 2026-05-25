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

  /**
   * Nombre d'incidents ouverts.
   * Si {@code severity} est fourni, compte uniquement les incidents de cette severite.
   * Si {@code includeBreakdown=true}, retourne aussi le total toutes severites.
   */
  getOpenCount: async (params?: {
    severity?: IncidentSeverity;
    includeBreakdown?: boolean;
  }): Promise<{ count: number; totalAllSeverities?: number }> => {
    const queryParams: Record<string, string | number | boolean | null | undefined> = {};
    if (params?.severity) queryParams.severity = params.severity;
    if (params?.includeBreakdown) queryParams.severityBreakdown = true;

    const res: { count: number; totalAllSeverities?: number } = await apiClient.get(
      `${BASE}/open/count`,
      { params: queryParams },
    );
    return {
      count: res.count ?? 0,
      totalAllSeverities: res.totalAllSeverities,
    };
  },

  /** Retester le service associe a un incident */
  retestIncident: async (id: number): Promise<RetestResult> => {
    return apiClient.post<RetestResult>(`${BASE}/${id}/retest`);
  },

  /**
   * Suppression dure d'un incident. Pour les cas où le retest ne suffit pas (incident
   * verrouillé OPEN parce que le service n'est plus configuré localement, ou ancien
   * incident RESOLVED dont la durée pollue la moyenne P1). SUPER_ADMIN uniquement.
   */
  deleteIncident: async (id: number): Promise<{ deleted: boolean; id: number }> => {
    return apiClient.delete<{ deleted: boolean; id: number }>(`${BASE}/${id}`);
  },
};
