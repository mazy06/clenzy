import apiClient from '../apiClient';

export interface PortfolioStats {
  totalPortfolios: number;
  totalClients: number;
  totalProperties: number;
  totalTeamMembers: number;
  activePortfolios: number;
  inactivePortfolios: number;
  recentAssignments: Array<{
    id: number;
    type: 'CLIENT' | 'TEAM';
    name: string;
    portfolioName: string;
    assignedAt: string;
  }>;
  portfolioBreakdown: Array<{
    portfolioId: number;
    portfolioName: string;
    clientCount: number;
    teamMemberCount: number;
    isActive: boolean;
  }>;
}

export interface ManagerAssociations {
  clients: Array<{ id: number; firstName: string; lastName: string; email: string; role: string; phoneNumber?: string; associatedAt: string }>;
  teams: Array<{ id: number; name: string; memberCount?: number; description?: string; assignedAt?: string }>;
  portfolios: Array<{ id: number; name: string }>;
  properties: Array<{ id: number; name: string; address?: string; city?: string; type?: string; createdAt?: string; ownerId?: number }>;
  users: Array<{ id: number; firstName: string; lastName: string; email?: string; role?: string; assignedAt?: string }>;
}

export const portfoliosApi = {
  getByManager(managerId: string | number) {
    return apiClient.get<unknown[]>(`/portfolios/manager/${managerId}`);
  },
  getStatsByManager(managerId: string | number) {
    return apiClient.get<PortfolioStats>(`/portfolios/manager/${managerId}/stats`);
  },
  assignClient(portfolioId: string | number, data: unknown) {
    return apiClient.post(`/portfolios/${portfolioId}/clients`, data);
  },
  assignTeam(portfolioId: string | number, data: unknown) {
    return apiClient.post(`/portfolios/${portfolioId}/team`, data);
  },
};

export const managersApi = {
  getAll() {
    return apiClient.get<unknown[]>('/managers/all');
  },
  getHosts() {
    return apiClient.get<unknown[]>('/managers/hosts');
  },
  getTeams() {
    return apiClient.get<unknown[]>('/managers/teams');
  },
  getOperationalUsers() {
    return apiClient.get<unknown[]>('/managers/operational-users');
  },
  getPropertiesByClients() {
    return apiClient.get<unknown[]>('/managers/properties/by-clients');
  },
  getAssociations(managerId: string | number) {
    return apiClient.get<ManagerAssociations>(`/managers/${managerId}/associations`);
  },
  assignClients(managerId: string | number, data: { clientIds: (string | number)[]; propertyIds?: (string | number)[] }) {
    return apiClient.post(`/managers/${managerId}/assign`, data);
  },
  reassignClient(clientId: string | number, data: { newManagerId: string | number }) {
    return apiClient.put(`/managers/${clientId}/reassign`, data);
  },
  removeClient(managerId: string | number, clientId: string | number) {
    return apiClient.delete(`/managers/${managerId}/clients/${clientId}`);
  },
  removeTeam(managerId: string | number, teamId: string | number) {
    return apiClient.delete(`/managers/${managerId}/teams/${teamId}`);
  },
  removeUser(managerId: string | number, userId: string | number) {
    return apiClient.delete(`/managers/${managerId}/users/${userId}`);
  },
  assignProperty(managerId: string | number, propertyId: string | number) {
    return apiClient.post(`/managers/${managerId}/properties/${propertyId}/assign`);
  },
  removeProperty(managerId: string | number, propertyId: string | number) {
    return apiClient.delete(`/managers/${managerId}/properties/${propertyId}`);
  },
};
