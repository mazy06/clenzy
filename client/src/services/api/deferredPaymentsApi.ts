import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UnpaidIntervention {
  id: number;
  title: string;
  scheduledDate: string;
  estimatedCost: number;
  status: string;
  paymentStatus: string;
}

export interface PropertyBalance {
  propertyId: number;
  propertyName: string;
  unpaidAmount: number;
  interventionCount: number;
  interventions: UnpaidIntervention[];
}

export interface HostBalanceSummary {
  hostId: number;
  hostName: string;
  hostEmail: string;
  totalUnpaid: number;
  totalInterventions: number;
  properties: PropertyBalance[];
}

export interface PaymentLinkResponse {
  sessionUrl: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const deferredPaymentsApi = {
  /** Consulter le solde impaye d'un host (ADMIN/MANAGER) */
  getHostBalance(hostId: number) {
    return apiClient.get<HostBalanceSummary>(`/deferred-payments/balance/${hostId}`);
  },

  /** Creer un lien de paiement Stripe groupe (ADMIN/MANAGER) */
  sendPaymentLink(hostId: number) {
    return apiClient.post<PaymentLinkResponse>(`/deferred-payments/send-payment-link/${hostId}`);
  },
};
