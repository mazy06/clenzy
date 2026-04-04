import { apiClient, PaginatedResponse } from '../apiClient';

export interface UserDto {
  id: number;
  keycloakId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  organizationId?: number;
  organizationName?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string;
  enabled?: boolean;
}

export const usersAdminApi = {
  getAll() {
    return apiClient.get<PaginatedResponse<UserDto>>('/users');
  },

  getById(id: number) {
    return apiClient.get<UserDto>(`/users/${id}`);
  },

  create(data: CreateUserData) {
    return apiClient.post<UserDto>('/users', data);
  },

  update(id: number, data: UpdateUserData) {
    return apiClient.put<UserDto>(`/users/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/users/${id}`);
  },

  searchUsers(query: string) {
    return apiClient.get<UserDto[]>('/v2/users/search', { params: { q: query } });
  },
};
