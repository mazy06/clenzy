import apiClient from '../apiClient';
import { extractApiList } from '../../types';

export interface TeamMember {
  id: number;
  userId?: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  userName?: string;
  userEmail?: string;
  roleInTeam?: string;
}

export interface CoverageZone {
  id?: number;
  /** Code ISO 3166-1 alpha-2 ("FR", "MA", "SA"). Defaut "FR". */
  country: string;
  /** France uniquement. */
  department?: string | null;
  /** France uniquement. */
  arrondissement?: string | null;
  /** Hors France uniquement. */
  city?: string | null;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members?: TeamMember[];
  coverageZones?: CoverageZone[];
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'maintenance';
  createdAt?: string;
  lastIntervention?: string;
  totalInterventions?: number;
  averageRating?: number;
}

export interface TeamFormData {
  name: string;
  description: string;
  interventionType: string;
  members: { userId: number; role: string }[];
  coverageZones?: CoverageZone[];
}

export const teamsApi = {
  /**
   * Toutes les equipes de l'organisation.
   *
   * L'endpoint renvoie une PAGE Spring : la liste est dépliée ici pour que le
   * type annoncé dise la vérité. Il promettait un tableau alors qu'il rendait un
   * objet, et rien ne pouvait le contredire — le type est affirmé à la main sur
   * `apiClient.get<T>`. Un appelant qui s'y fiait plantait sur
   * « .filter is not a function ».
   */
  async getAll(): Promise<Team[]> {
    return extractApiList<Team>(await apiClient.get<unknown>('/teams'));
  },
  getById(id: number) {
    return apiClient.get<Team>(`/teams/${id}`);
  },
  getByManager(managerId: number) {
    return apiClient.get<Team[]>(`/teams/manager/${managerId}`);
  },
  create(data: TeamFormData) {
    return apiClient.post<Team>('/teams', data);
  },
  update(id: number, data: TeamFormData) {
    return apiClient.put<Team>(`/teams/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/teams/${id}`);
  },
};
