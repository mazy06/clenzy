import { apiClient } from '../apiClient';

// ─── Versements Stripe Connect du pro (Moteur Ménage 3B/4B) ──────────────────
// Historique des versements de missions + onboarding Connect Express.
// Mobile : les composants embarqués (@stripe/connect-js) sont web-only →
// flux AccountLink hébergé ouvert dans un navigateur in-app.

export type PayoutStatus = 'PENDING' | 'SENT' | 'FAILED' | 'BLOCKED';

export interface PayoutRecord {
  id: number;
  interventionId: number;
  /** Montant net versé au pro (commission déduite). */
  amount: number;
  commissionAmount: number;
  status: PayoutStatus;
  /** PROOF_MISSING | ONBOARDING_INCOMPLETE | message Stripe (si FAILED/BLOCKED). */
  failureReason: string | null;
  createdAt: string;
}

export interface MyPayouts {
  /** Un compte Connect Express existe pour ce pro. */
  accountCreated: boolean;
  /** Onboarding Stripe terminé (versements possibles). */
  onboardingCompleted: boolean;
  records: PayoutRecord[];
}

export const housekeeperPayoutsApi = {
  /** Statut d'onboarding + historique de MES versements. */
  getMy() {
    return apiClient.get<MyPayouts>('/housekeeper-payouts/me');
  },

  /** URL AccountLink Stripe (onboarding hébergé — navigateur in-app). */
  createOnboardingLink() {
    return apiClient.post<{ url: string }>('/housekeeper-payouts/onboarding-link', {});
  },

  /** Re-synchronise le statut d'onboarding depuis Stripe (au retour du navigateur). */
  refreshStatus() {
    return apiClient.post<MyPayouts>('/housekeeper-payouts/refresh-status', {});
  },
};
