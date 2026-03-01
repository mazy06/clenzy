import { apiClient, PaginatedResponse } from '../apiClient';

export interface ServiceRequest {
  id: number;
  title: string;
  description?: string;
  serviceType: string;
  priority: string;
  status: string;
  propertyId?: number;
  propertyName?: string;
  desiredDate?: string;
  preferredTimeSlot?: string;
  estimatedDurationHours?: number;
  estimatedCost?: number;
  actualCost?: number;
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

export const serviceRequestsApi = {
  getAll(params?: Record<string, string>) {
    return apiClient.get<PaginatedResponse<ServiceRequest>>('/service-requests', { params });
  },

  getById(id: number) {
    return apiClient.get<ServiceRequest>(`/service-requests/${id}`);
  },

  create(data: Partial<ServiceRequest>) {
    return apiClient.post<ServiceRequest>('/service-requests', data);
  },

  update(id: number, data: Partial<ServiceRequest>) {
    return apiClient.put<ServiceRequest>(`/service-requests/${id}`, data);
  },
};
