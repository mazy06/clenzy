import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface Manager {
  id: number;
  keycloakId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  isActive?: boolean;
}

export interface HostClient {
  id: number;
  keycloakId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
}

export interface PortfolioTeam {
  id: number;
  name: string;
  description?: string;
  interventionType?: string;
  memberCount?: number;
  isActive?: boolean;
}

export interface OperationalUser {
  id: number;
  keycloakId?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive?: boolean;
}

export interface AssignmentProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  status?: string;
  ownerId: number;
  ownerName?: string;
  isActive?: boolean;
}

export interface AssignResult {
  clientsAssigned?: number;
  propertiesAssigned?: number;
  teamsAssigned?: number;
  usersAssigned?: number;
}

// ─── Query Keys (exported for cross-module invalidation) ─────────────────────

export const portfoliosKeys = {
  all: ['portfolios'] as const,
  associations: (managerId: string | number) => [...portfoliosKeys.all, 'associations', String(managerId)] as const,
  stats: (managerId: string | number) => [...portfoliosKeys.all, 'stats', String(managerId)] as const,
  managers: () => [...portfoliosKeys.all, 'managers'] as const,
  hosts: () => [...portfoliosKeys.all, 'hosts'] as const,
  teams: () => [...portfoliosKeys.all, 'teams'] as const,
  operationalUsers: () => [...portfoliosKeys.all, 'operational-users'] as const,
  propertiesByClients: (clientIds: number[]) => [...portfoliosKeys.all, 'properties-by-clients', ...clientIds.map(String)] as const,
};

// ─── API Methods ─────────────────────────────────────────────────────────────

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
    return apiClient.get<Manager[]>('/managers/all');
  },
  getHosts() {
    return apiClient.get<HostClient[]>('/managers/hosts');
  },
  getTeams() {
    return apiClient.get<PortfolioTeam[]>('/managers/teams');
  },
  getOperationalUsers() {
    return apiClient.get<OperationalUser[]>('/managers/operational-users');
  },
  getPropertiesByClients(clientIds: number[]) {
    return apiClient.post<AssignmentProperty[]>('/managers/properties/by-clients', clientIds);
  },
  getAssociations(managerId: string | number) {
    return apiClient.get<ManagerAssociations>(`/managers/${managerId}/associations`);
  },
  assignClients(managerId: string | number, data: { clientIds: (string | number)[]; propertyIds?: (string | number)[] }) {
    return apiClient.post<AssignResult>(`/managers/${managerId}/assign`, data);
  },
  assignTeamsUsers(managerId: string | number, data: { managerId: string | number; teamIds: number[]; userIds: number[] }) {
    return apiClient.post<AssignResult>(`/managers/${managerId}/assign-teams-users`, data);
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
