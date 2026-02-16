import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity?: string;
  propertyPostalCode?: string;
  propertyCountry?: string;
  requestorId: number;
  requestorName: string;
  assignedToId: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  actualDurationMinutes?: number;
  progressPercentage: number;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  photosUrl?: string;
  beforePhotosUrls?: string;
  afterPhotosUrls?: string;
  completedSteps?: string;
  validatedRooms?: string;
  paymentStatus?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InterventionFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

export interface InterventionListParams {
  [key: string]: string | number | boolean | undefined | null;
  propertyId?: number;
  size?: number;
  sort?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const interventionsApi = {
  getAll(params?: InterventionListParams) {
    return apiClient.get<Intervention[]>('/interventions', { params });
  },

  getById(id: number) {
    return apiClient.get<Intervention>(`/interventions/${id}`);
  },

  create(data: InterventionFormData) {
    return apiClient.post<Intervention>('/interventions', data);
  },

  update(id: number, data: Partial<InterventionFormData>) {
    return apiClient.put<Intervention>(`/interventions/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/interventions/${id}`);
  },

  start(id: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/start`);
  },

  updateProgress(id: number, progressPercentage: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/progress`, undefined, {
      params: { progressPercentage },
    });
  },

  reopen(id: number) {
    return apiClient.put<Intervention>(`/interventions/${id}/reopen`);
  },

  updateCompletedSteps(id: number, completedSteps: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/completed-steps`, undefined, {
      params: { completedSteps },
    });
  },

  updateNotes(id: number, notes: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/notes`, undefined, {
      params: { notes },
    });
  },

  updateValidatedRooms(id: number, validatedRooms: string) {
    return apiClient.put<Intervention>(`/interventions/${id}/validated-rooms`, undefined, {
      params: { validatedRooms },
    });
  },

  uploadPhotos(id: number, photos: File[], photoType: 'before' | 'after') {
    const formData = new FormData();
    photos.forEach((photo) => formData.append('photos', photo));
    formData.append('photoType', photoType);
    return apiClient.upload<Intervention>(`/interventions/${id}/photos`, formData);
  },

  assign(id: number, userId?: number, teamId?: number) {
    const params: Record<string, number> = {};
    if (userId) params.userId = userId;
    if (teamId) params.teamId = teamId;
    return apiClient.put<Intervention>(`/interventions/${id}/assign`, undefined, { params });
  },
};
