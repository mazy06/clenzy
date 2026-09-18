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
  /** URL ticketee de la photo de profil, servie par le backend. */
  avatarUrl?: string | null;
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
  serviceItemCodes?: string[];
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
  serviceItemCodes?: string[];
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
    const first = await apiClient.get<unknown>('/teams');
    const rows = extractApiList<Team>(first);
    if (!first || typeof first !== 'object' || Array.isArray(first)) return rows;
    const page = first as { totalPages?: number; size?: number };
    if (!Number.isInteger(page.totalPages) || !page.totalPages || page.totalPages <= 1) return rows;
    const size = Number.isInteger(page.size) && page.size! > 0 ? page.size! : 20;
    for (let index = 1; index < page.totalPages; index++) {
      rows.push(...extractApiList<Team>(await apiClient.get<unknown>('/teams?page=' + index + '&size=' + size)));
    }
    return [...new Map(rows.map(team => [team.id, team])).values()];
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
