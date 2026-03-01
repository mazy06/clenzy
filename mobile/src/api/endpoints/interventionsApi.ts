import { apiClient, PaginatedResponse } from '../apiClient';

export interface Intervention {
  id: number;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  propertyId?: number;
  propertyName?: string;
  propertyAddress?: string;
  assignedTechnicianId?: number;
  assignedTechnicianName?: string;
  teamId?: number;
  teamName?: string;
  startTime?: string;
  endTime?: string;
  isUrgent: boolean;
  requiresFollowUp: boolean;
  materialsUsed?: string;
  technicianNotes?: string;
  customerFeedback?: string;
  customerRating?: number;
  beforePhotosUrls?: string[];
  afterPhotosUrls?: string[];
  validatedRooms?: string;
  estimatedCost?: number;
  actualCost?: number;
  estimatedDurationHours?: number;
  paymentStatus?: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  stripeSessionId?: string;
  paidAt?: string;
  scheduledDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionListParams {
  page?: number;
  size?: number;
  status?: string;
  type?: string;
  priority?: string;
  propertyId?: number;
  assignedTo?: number;
  teamId?: number;
  startDate?: string;
  endDate?: string;
  sort?: string;
}

export const interventionsApi = {
  getAll(params?: InterventionListParams) {
    return apiClient.get<PaginatedResponse<Intervention>>('/interventions', { params: params as Record<string, string> });
  },

  getById(id: number) {
    return apiClient.get<Intervention>(`/interventions/${id}`);
  },

  create(data: Partial<Intervention>) {
    return apiClient.post<Intervention>('/interventions', data);
  },

  update(id: number, data: Partial<Intervention>) {
    return apiClient.put<Intervention>(`/interventions/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/interventions/${id}`);
  },

  uploadPhotos(id: number, formData: FormData) {
    return apiClient.upload(`/interventions/${id}/photos`, formData);
  },

  getPhotos(id: number) {
    return apiClient.get<{ beforePhotos: string[]; afterPhotos: string[] }>(`/interventions/${id}/photos`);
  },
};
