import apiClient from '../apiClient';

// Versements Baitly aux prestataires individuels et aux organisations, tous métiers.

export type HousekeeperPayoutStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BLOCKED';

export interface HousekeeperPayoutRecord {
  id: number;
  /** users.id du prestataire bénéficiaire (résolu en nom côté écran admin). */
  userId: number | null;
  beneficiaryOrganizationId?: number | null;
  interventionId: number;
  /** Montant NET versé au prestataire (rémunération − commission). */
  amount: number;
  commissionAmount: number;
  status: HousekeeperPayoutStatus;
  failureReason: string | null;
  /** Référence du transfert Stripe (présent quand SENT). */
  stripeTransferId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface MyPayouts {
  accountCreated: boolean;
  onboardingCompleted: boolean;
  records: HousekeeperPayoutRecord[];
}

export interface PayoutRetryQuote {
  amount: number;
  commissionAmount: number;
}

export const housekeeperPayoutsApi = {
  /** Statut d'onboarding + historique de MES versements (pro authentifié). */
  getMy(): Promise<MyPayouts> {
    return apiClient.get<MyPayouts>('/housekeeper-payouts/me');
  },

  /** Account Session Stripe pour l'onboarding EMBARQUÉ (client_secret). */
  createAccountSession(): Promise<{ clientSecret: string }> {
    return apiClient.post<{ clientSecret: string }>('/housekeeper-payouts/account-session', {});
  },

  /** Rafraîchit le statut d'onboarding depuis Stripe (retour du composant). */
  refreshStatus(): Promise<MyPayouts> {
    return apiClient.post<MyPayouts>('/housekeeper-payouts/refresh-status', {});
  },

  /** Versements de l'org — staff plateforme. */
  listOrg(): Promise<HousekeeperPayoutRecord[]> {
    return apiClient.get<HousekeeperPayoutRecord[]>('/housekeeper-payouts/org');
  },

  /** Relance d'un versement FAILED/BLOCKED — staff plateforme. */
  previewRetry(recordId: number): Promise<PayoutRetryQuote> {
    return apiClient.get<PayoutRetryQuote>(`/housekeeper-payouts/${recordId}/retry-preview`);
  },

  retry(recordId: number, quote: PayoutRetryQuote): Promise<HousekeeperPayoutRecord> {
    return apiClient.post<HousekeeperPayoutRecord>(`/housekeeper-payouts/${recordId}/retry`, quote);
  },
};
