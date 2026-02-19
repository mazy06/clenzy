import apiClient from '../apiClient';

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
  department: string;
  arrondissement?: string;
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
  members: { userId: number; roleInTeam: string }[];
  coverageZones?: CoverageZone[];
}

export const teamsApi = {
  getAll() {
    return apiClient.get<Team[]>('/teams');
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
