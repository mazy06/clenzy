import apiClient from '../apiClient';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status?: string;
  createdAt?: string;
}

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
}

export const usersApi = {
  getAll(params?: { role?: string }) {
    return apiClient.get<User[]>('/users', { params });
  },
  getById(id: number) {
    return apiClient.get<User>(`/users/${id}`);
  },
  create(data: UserFormData) {
    return apiClient.post<User>('/users', data);
  },
  update(id: number, data: Partial<UserFormData>) {
    return apiClient.put<User>(`/users/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/users/${id}`);
  },
};
