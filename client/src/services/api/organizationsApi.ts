import apiClient from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrganizationDto {
  id: number;
  name: string;
  slug: string;
  type: string;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrganizationData {
  name: string;
  type: string;
}

export interface UpdateOrganizationData {
  name: string;
  type: string;
}

// ─── API ────────────────────────────────────────────────────────────────────

export const organizationsApi = {
  /**
   * Lister toutes les organisations (staff plateforme uniquement)
   */
  listAll() {
    return apiClient.get<OrganizationDto[]>('/organizations');
  },

  /**
   * Obtenir le detail d'une organisation
   */
  getById(id: number) {
    return apiClient.get<OrganizationDto>(`/organizations/${id}`);
  },

  /**
   * Creer une organisation (SUPER_ADMIN uniquement)
   */
  create(data: CreateOrganizationData) {
    return apiClient.post<OrganizationDto>('/organizations', data);
  },

  /**
   * Modifier une organisation
   */
  update(id: number, data: UpdateOrganizationData) {
    return apiClient.put<OrganizationDto>(`/organizations/${id}`, data);
  },

  /**
   * Supprimer une organisation (SUPER_ADMIN uniquement)
   */
  delete(id: number) {
    return apiClient.delete(`/organizations/${id}`);
  },
};
