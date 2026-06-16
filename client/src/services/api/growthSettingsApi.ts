import apiClient from '../apiClient';

/**
 * Réglages de croissance org-level du booking engine (capture de leads, relance de panier).
 * Réellement appliqués côté serveur (endpoint /leads + scheduler de relance). Compteurs read-only.
 */

export interface GrowthSettings {
  leadCaptureEnabled: boolean;
  /** Popup exit-intent dans le widget (opt-in) — distinct du gate endpoint `leadCaptureEnabled`. */
  leadCapturePopupEnabled: boolean;
  abandonedCartRecoveryEnabled: boolean;
  contactsCaptured: number;
  cartsRecovered: number;
  /** Crédit fidélité (2.8) : % de chaque séjour direct gagné en crédit (null/0 = désactivé). */
  loyaltyCreditPercent: number | null;
  /** Parrainage (2.11) : crédit par côté en centimes quand un filleul réserve (null/0 = désactivé). */
  referralCreditCents: number | null;
}

export const growthSettingsApi = {
  get: () => apiClient.get<GrowthSettings>('/booking-engine/growth/settings'),
  update: (settings: {
    leadCaptureEnabled: boolean;
    leadCapturePopupEnabled: boolean;
    abandonedCartRecoveryEnabled: boolean;
    loyaltyCreditPercent: number | null;
    referralCreditCents: number | null;
  }) => apiClient.put<GrowthSettings>('/booking-engine/growth/settings', settings),
};
