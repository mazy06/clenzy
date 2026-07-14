import apiClient from '../apiClient';

// ─── Payout Stripe Connect des prestataires ménage (Moteur Ménage 3B) ─────────

export type HousekeeperPayoutStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BLOCKED';

export interface HousekeeperPayoutRecord {
  id: number;
  /** users.id du prestataire bénéficiaire (résolu en nom côté écran admin). */
  userId: number;
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
  retry(recordId: number): Promise<HousekeeperPayoutRecord> {
    return apiClient.post<HousekeeperPayoutRecord>(`/housekeeper-payouts/${recordId}/retry`, {});
  },
};
