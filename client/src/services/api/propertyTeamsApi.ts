import { teamsApi } from './teamsApi';
import apiClient from '../apiClient';
// Hors React : la langue se lit a l'appel, pas au chargement du module.
import i18n from '../../i18n/config';

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
        throw new Error(i18n.t('propertyTeams.pickServiceItem'));
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
    if (rows.length !== 1) throw new Error(i18n.t('propertyTeams.pickAssociation'));
    return this.removeAssociation(rows[0].id);
  },
};
