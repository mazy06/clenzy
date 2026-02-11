import apiClient from '../apiClient';

export interface ServiceRequest {
  id: number;
  title: string;
  description: string;
  propertyId: number;
  propertyName?: string;
  propertyAddress?: string;
  userId: number;
  userName?: string;
  serviceType: string;
  priority: string;
  status: string;
  estimatedDurationHours: number;
  desiredDate: string;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  assignedToName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ServiceRequestFormData {
  title: string;
  description: string;
  propertyId: number;
  serviceType: string;
  priority: string;
  estimatedDurationHours: number;
  desiredDate: string;
  userId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
}

export const serviceRequestsApi = {
  getAll() {
    return apiClient.get<ServiceRequest[]>('/service-requests');
  },
  getById(id: number) {
    return apiClient.get<ServiceRequest>(`/service-requests/${id}`);
  },
  create(data: ServiceRequestFormData) {
    return apiClient.post<ServiceRequest>('/service-requests', data);
  },
  update(id: number, data: Partial<ServiceRequestFormData> & { status?: string }) {
    return apiClient.put<ServiceRequest>(`/service-requests/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/service-requests/${id}`);
  },
  validate(id: number) {
    return apiClient.post<ServiceRequest>(`/service-requests/${id}/validate`);
  },
};
