import apiClient from '../apiClient';

/**
 * Taux de monétisation par org (en %), sur deux niveaux :
 * - Commission PLATEFORME (staff-only) : upsell + activités.
 * - Commission ORG/conciergerie (org-editable) sur le reste après plateforme.
 */
export interface MonetizationConfig {
  upsellPlatformFeePct: number;
  activityPlatformCommissionPct: number;
  upsellOrgCommissionPct: number;
  activityOrgCommissionPct: number;
}

export const monetizationConfigApi = {
  get: () => apiClient.get<MonetizationConfig>('/monetization-config'),
  /** Commission plateforme — staff uniquement. */
  updatePlatform: (data: { upsellPlatformFeePct: number; activityPlatformCommissionPct: number }) =>
    apiClient.put<MonetizationConfig>('/monetization-config/platform', data),
  /** Commission org/conciergerie — éditable par l'org/host. */
  updateOrg: (data: { upsellOrgCommissionPct: number; activityOrgCommissionPct: number }) =>
    apiClient.put<MonetizationConfig>('/monetization-config/org', data),
};
