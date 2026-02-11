import apiClient from '../apiClient';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export const authApi = {
  login(credentials: { email: string; password: string }) {
    return apiClient.post<{ token: string }>('/auth/login', credentials);
  },
  logout() {
    return apiClient.post('/logout');
  },
  getMe() {
    return apiClient.get<AuthUser>('/me');
  },
};
