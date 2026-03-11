import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'EXPIRED';
export type ContractType = 'FULL_MANAGEMENT' | 'BOOKING_ONLY' | 'MAINTENANCE_ONLY' | 'CUSTOM';

export interface ManagementContract {
  id: number;
  propertyId: number;
  ownerId: number;
  contractNumber: string;
  contractType: ContractType;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  commissionRate: number;
  minimumStayNights: number | null;
  autoRenew: boolean;
  noticePeriodDays: number;
  cleaningFeeIncluded: boolean;
  maintenanceIncluded: boolean;
  notes: string | null;
  signedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
}

export interface CreateManagementContractRequest {
  propertyId: number;
  ownerId: number;
  contractType: ContractType;
  startDate: string;
  endDate?: string | null;
  commissionRate: number;
  minimumStayNights?: number | null;
  autoRenew?: boolean;
  noticePeriodDays?: number;
  cleaningFeeIncluded?: boolean;
  maintenanceIncluded?: boolean;
  notes?: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const managementContractsApi = {
  async getAll(params?: {
    propertyId?: number;
    ownerId?: number;
    status?: ContractStatus;
  }): Promise<ManagementContract[]> {
    const query = new URLSearchParams();
    if (params?.propertyId) query.set('propertyId', String(params.propertyId));
    if (params?.ownerId) query.set('ownerId', String(params.ownerId));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return apiClient.get<ManagementContract[]>(
      `/management-contracts${qs ? `?${qs}` : ''}`
    );
  },

  async getById(id: number): Promise<ManagementContract> {
    return apiClient.get<ManagementContract>(`/management-contracts/${id}`);
  },

  async create(data: CreateManagementContractRequest): Promise<ManagementContract> {
    return apiClient.post<ManagementContract>('/management-contracts', data);
  },

  async update(id: number, data: CreateManagementContractRequest): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}`, data);
  },

  async activate(id: number): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/activate`, {});
  },

  async suspend(id: number): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/suspend`, {});
  },

  async terminate(id: number, reason: string): Promise<ManagementContract> {
    return apiClient.put<ManagementContract>(`/management-contracts/${id}/terminate`, { reason });
  },

  async expireAll(): Promise<{ expired: number }> {
    return apiClient.post<{ expired: number }>('/management-contracts/expire', {});
  },
};
