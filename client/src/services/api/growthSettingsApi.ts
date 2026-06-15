import apiClient from '../apiClient';

/**
 * Réglages de croissance org-level du booking engine (capture de leads, relance de panier).
 * Réellement appliqués côté serveur (endpoint /leads + scheduler de relance). Compteurs read-only.
 */

export interface GrowthSettings {
  leadCaptureEnabled: boolean;
  abandonedCartRecoveryEnabled: boolean;
  contactsCaptured: number;
  cartsRecovered: number;
  /** Crédit fidélité (2.8) : % de chaque séjour direct gagné en crédit (null/0 = désactivé). */
  loyaltyCreditPercent: number | null;
}

export const growthSettingsApi = {
  get: () => apiClient.get<GrowthSettings>('/booking-engine/growth/settings'),
  update: (settings: { leadCaptureEnabled: boolean; abandonedCartRecoveryEnabled: boolean; loyaltyCreditPercent: number | null }) =>
    apiClient.put<GrowthSettings>('/booking-engine/growth/settings', settings),
};
