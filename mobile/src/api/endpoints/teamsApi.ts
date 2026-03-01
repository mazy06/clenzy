import { apiClient } from '../apiClient';

export interface Team {
  id: number;
  name: string;
  description?: string;
  coverageZone?: string;
  members?: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: number;
  userId: number;
  userName: string;
  role: string;
}

export const teamsApi = {
  getAll() {
    return apiClient.get<Team[]>('/teams');
  },

  getById(id: number) {
    return apiClient.get<Team>(`/teams/${id}`);
  },
};
