import apiClient from '../apiClient';

// Types de service personnalisés (« Autre ») réutilisables, org-scopés côté back.

export type CustomServiceCategory = 'cleaning' | 'maintenance' | 'other';

export interface CustomServiceType {
  id: number;
  category: CustomServiceCategory;
  label: string;
}

export const customServiceTypesApi = {
  /** Liste les types personnalisés de l'org courante pour une catégorie. */
  async list(category: CustomServiceCategory): Promise<CustomServiceType[]> {
    return apiClient.get<CustomServiceType[]>(`/custom-service-types?category=${encodeURIComponent(category)}`);
  },

  /** Crée (ou récupère si déjà présent) un type personnalisé. */
  async create(category: CustomServiceCategory, label: string): Promise<CustomServiceType> {
    return apiClient.post<CustomServiceType>('/custom-service-types', { category, label });
  },
};
