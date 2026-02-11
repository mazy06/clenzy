import apiClient from '../apiClient';

export interface RolePermissions {
  role: string;
  permissions: string[];
}

export const permissionsApi = {
  getAll() {
    return apiClient.get<string[]>('/permissions/all');
  },
  getByRole(role: string) {
    return apiClient.get<string[]>(`/permissions/user/${role}`);
  },
  getAllRoles() {
    return apiClient.get<RolePermissions[]>('/permissions/roles');
  },
  getRolePermissions(role: string) {
    return apiClient.get<string[]>(`/permissions/roles/${role}`);
  },
  sync(userId: string) {
    return apiClient.post<{ permissions: string[] }>('/permissions/sync', { userId });
  },
  updateRole(role: string, permissions: string[]) {
    return apiClient.put(`/permissions/roles/${role}`, { permissions });
  },
  saveRole(role: string, permissions: string[]) {
    return apiClient.post(`/permissions/roles/${role}/save`, { permissions });
  },
  resetRole(role: string) {
    return apiClient.post(`/permissions/roles/${role}/reset`);
  },
  resetRoleToInitial(role: string) {
    return apiClient.post(`/permissions/roles/${role}/reset-to-initial`);
  },
  getRedisCache(userId: string) {
    return apiClient.get<{ permissions: string[] }>(`/permissions/redis/${userId}`);
  },
  updateRedisCache(userId: string, permissions: string[]) {
    return apiClient.put(`/permissions/redis/${userId}`, { permissions });
  },
  invalidateRedisCache(userId: string) {
    return apiClient.post(`/permissions/redis/${userId}/invalidate`);
  },
};
