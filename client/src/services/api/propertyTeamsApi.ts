import { teamsApi } from './teamsApi';
import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PropertyTeamMapping {
  id: number;
  propertyId: number;
  teamId: number;
  teamName: string;
  teamInterventionType: string;
  assignedAt: string;
  serviceItemCode?: string;
  priority: number;
  active: boolean;
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

  getAssociations(propertyId: number) {
    return apiClient.get<PropertyTeamMapping[]>(`/property-teams/property/${propertyId}/associations`);
  },
  getCandidates(propertyId: number, serviceItemCode: string) {
    return apiClient.get<Array<{ id: number; name: string }>>(
      `/property-teams/property/${propertyId}/candidates?serviceItemCode=${encodeURIComponent(serviceItemCode)}`,
    );
  },
  removeAssociation(id: number) {
    return apiClient.delete(`/property-teams/${id}`);
  },
  async assign(propertyId: number, teamId: number, serviceItemCode?: string, priority = 100) {
    if (!serviceItemCode) {
      const team = await teamsApi.getById(teamId);
      if (team.serviceItemCodes?.length !== 1)
        throw new Error('Choisissez la prestation dans la fiche du logement.');
      serviceItemCode = team.serviceItemCodes[0];
    }
    return apiClient.post<PropertyTeamMapping>('/property-teams', {
      propertyId,
      teamId,
      serviceItemCode,
      priority,
    });
  },

  async remove(propertyId: number) {
    const rows = await this.getAssociations(propertyId);
    if (rows.length !== 1) throw new Error('Sélectionnez une association précise dans la fiche du logement.');
    return this.removeAssociation(rows[0].id);
  },
};
