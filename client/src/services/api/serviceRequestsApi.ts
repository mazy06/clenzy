import apiClient from '../apiClient';
import { extractApiList } from '../../types';

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
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création. */
  recommendedCost?: number;
  desiredDate: string;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  assignedToName?: string;
  assignedToUser?: { id: number; firstName: string; lastName: string };
  assignedToTeam?: { id: number; name: string };
  paymentStatus?: string;
  autoAssignStatus?: 'searching' | 'found' | 'exhausted' | null;
  // Chiffrage maintenance (devis structuré) — présents sur getById.
  quoteLines?: { label: string; quantity: number; unitPrice: number; interventionType?: string }[];
  pricingMode?: 'DIRECT' | 'DIAGNOSTIC';
  diagnosticFee?: number;
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
  /** Séjour auquel rattacher la prestation. Absent = prestation hors séjour. */
  reservationId?: number;
  estimatedCost?: number;
}

/** Un prestataire proposable pour un créneau. */
export interface AssignableTeam {
  teamId: number;
  name: string;
  /** `DEFAULT` = équipe attitrée au logement, `ZONE` = couvre la zone. */
  origin: 'DEFAULT' | 'ZONE';
  available: boolean;
  /** Interventions qui se chevauchent — ce qui explique l'indisponibilité. */
  conflicts: number;
}

export const serviceRequestsApi = {
  /**
   * Demandes de service, filtrables.
   *
   * L'endpoint renvoie une PAGE Spring : la liste est dépliée ici pour que le
   * type annoncé dise la vérité. Il promettait un tableau alors qu'il rendait un
   * objet, et rien ne pouvait le contredire — le type est affirmé à la main sur
   * `apiClient.get<T>`. Un appelant qui s'y fiait plantait sur
   * « .filter is not a function ».
   */
  async getAll(params?: { propertyId?: number; reservationId?: number; userId?: number; status?: string; serviceType?: string }): Promise<ServiceRequest[]> {
    return extractApiList<ServiceRequest>(await apiClient.get<unknown>('/service-requests', { params }));
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
  /**
   * Clôturer une demande qui n'aura pas lieu (→ CANCELLED).
   *
   * Ce n'est pas une suppression : la demande reste consultable avec son
   * historique. `delete` est réservé au staff plateforme.
   */
  cancel(id: number, reason?: string) {
    return apiClient.post<ServiceRequest>(`/service-requests/${id}/cancel`, { reason: reason ?? null });
  },
  /**
   * Prestataires proposables pour une date donnée.
   *
   * Même parcours que l'auto-assignation (équipe attitrée du logement, puis
   * zones de couverture), mais la liste complète : les équipes occupées sont
   * rendues aussi, marquées indisponibles — déplacer l'heure peut les libérer.
   */
  assignableTeams(id: number, date: string) {
    return apiClient.get<AssignableTeam[]>(`/service-requests/${id}/assignable-teams`, {
      params: { date },
    });
  },

  /**
   * Replanifier : clôture la demande et en crée une neuve.
   *
   * `reservationId` absent ou `null` = prestation hors séjour, c'est un choix.
   * `assignedToId` absent = on laisse la recherche automatique chercher.
   */
  reschedule(id: number, body: {
    desiredDate: string;
    assignedToId?: number | null;
    assignedToType?: 'user' | 'team' | null;
    reservationId?: number | null;
    reason?: string | null;
  }) {
    return apiClient.post<ServiceRequest>(`/service-requests/${id}/reschedule`, body);
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
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création. */
  recommendedCost?: number;
  status: string;
  reservationId?: number;
}
