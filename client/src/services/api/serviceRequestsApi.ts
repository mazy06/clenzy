import apiClient from '../apiClient';

export interface ServiceRequest {
  id: number;
  title: string;
  description: string;
  propertyId: number;
  propertyName?: string;
  propertyAddress?: string;
  reservationId?: number;
  userId: number;
  userName?: string;
  serviceType: string;
  priority: string;
  status: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  desiredDate: string;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  assignedToName?: string;
  assignedToUser?: { id: number; firstName: string; lastName: string };
  assignedToTeam?: { id: number; name: string };
  paymentStatus?: string;
  autoAssignStatus?: 'searching' | 'found' | 'exhausted' | null;
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
  getAll(params?: { propertyId?: number; reservationId?: number; userId?: number; status?: string; serviceType?: string }) {
    return apiClient.get<ServiceRequest[]>('/service-requests', { params });
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
  /** Refuser une assignation (ASSIGNED → PENDING, re-assignation tentée) */
  refuse(id: number) {
    return apiClient.post<ServiceRequest>(`/service-requests/${id}/refuse`);
  },
  /** Créer une session de paiement Stripe pour la SR (ASSIGNED → AWAITING_PAYMENT) */
  createPaymentSession(id: number) {
    return apiClient.post<{ checkoutUrl: string }>(`/service-requests/${id}/create-payment-session`);
  },
  /** Créer une session embedded Stripe pour la SR (modal inline) */
  createEmbeddedSession(id: number) {
    return apiClient.post<{ sessionId: string; clientSecret: string }>(`/service-requests/${id}/create-embedded-session`);
  },
  /** Assigner manuellement une équipe ou un utilisateur (admin/manager uniquement) */
  manualAssign(id: number, assignedToId: number, assignedToType: 'user' | 'team') {
    return apiClient.post<ServiceRequest>(`/service-requests/${id}/assign`, null, {
      params: { assignedToId, assignedToType },
    });
  },
  /** Vérifier le statut du paiement Stripe (fallback si webhook raté) */
  checkPaymentStatus(id: number) {
    return apiClient.post<{ paymentStatus: string; message: string }>(`/service-requests/${id}/check-payment`);
  },
  /** SR en AWAITING_PAYMENT pour le planning Gantt */
  getPlanningAwaitingPayment(filters?: { propertyIds?: number[]; from?: string; to?: string }) {
    const params: Record<string, string> = {};
    if (filters?.propertyIds?.length) params.propertyIds = filters.propertyIds.join(',');
    if (filters?.from) params.from = filters.from;
    if (filters?.to) params.to = filters.to;
    return apiClient.get<PlanningServiceRequest[]>('/service-requests/planning', { params });
  },
};

export interface PlanningServiceRequest {
  id: number;
  propertyId: number;
  propertyName: string;
  serviceType: string;
  title: string;
  assignedToName?: string;
  startDate: string;
  startTime?: string;
  endTime?: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  status: string;
  reservationId?: number;
}
