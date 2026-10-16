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
  property?:{id:number;name:string};
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
  async getAll(params?: Record<string, string>) {
    const page=await apiClient.get<PaginatedResponse<ServiceRequest>>('/service-requests', { params });
    return {...page,content:page.content.map(normalizeServiceRequest)};
  },

  async getById(id: number) {
    return normalizeServiceRequest(await apiClient.get<ServiceRequest>(`/service-requests/${id}`));
  },

  create(data: Partial<ServiceRequest>) {
    return apiClient.post<ServiceRequest>('/service-requests', data);
  },

  update(id: number, data: Partial<ServiceRequest>) {
    return apiClient.put<ServiceRequest>(`/service-requests/${id}`, data);
  },
};
export function normalizeServiceRequest(item:ServiceRequest):ServiceRequest {return {...item,propertyId:item.propertyId??item.property?.id,propertyName:item.propertyName??item.property?.name};}
