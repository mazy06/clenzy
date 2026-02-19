import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyTeamMapping {
  id: number;
  propertyId: number;
  teamId: number;
  teamName: string;
  teamInterventionType: string;
  assignedAt: string;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const propertyTeamsKeys = {
  all: ['property-teams'] as const,
  byProperties: (ids: number[]) =>
    [...propertyTeamsKeys.all, 'by-properties', ...ids.map(String)] as const,
  byProperty: (id: number) =>
    [...propertyTeamsKeys.all, 'property', id] as const,
};

// ─── API ─────────────────────────────────────────────────────────────────────

export const propertyTeamsApi = {
  getByProperty(propertyId: number) {
    return apiClient.get<PropertyTeamMapping>(
      `/property-teams/property/${propertyId}`,
    );
  },

  getByProperties(ids: number[]) {
    return apiClient.post<PropertyTeamMapping[]>(
      '/property-teams/by-properties',
      ids,
    );
  },

  assign(propertyId: number, teamId: number) {
    return apiClient.post<PropertyTeamMapping>('/property-teams', {
      propertyId,
      teamId,
    });
  },

  remove(propertyId: number) {
    return apiClient.delete(`/property-teams/property/${propertyId}`);
  },
};
