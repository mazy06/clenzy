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

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export const teamsApi = {
  async getAll(): Promise<Team[]> {
    const page = await apiClient.get<PageResponse<Team>>('/teams?size=1000');
    return page.content ?? [];
  },

  getById(id: number) {
    return apiClient.get<Team>(`/teams/${id}`);
  },
};
