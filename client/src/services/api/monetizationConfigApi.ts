import apiClient from '../apiClient';

/**
 * Taux de monétisation des upsells (en %), sur deux niveaux :
 * - Commission PLATEFORME (staff-only).
 * - Commission ORG/conciergerie (org-editable) sur le reste après plateforme.
 *
 * Les taux d'activités ont été retirés : elles passent par affiliation, aucun
 * montant ne transite par Baitly, il n'y a donc rien à répartir.
 */
export interface MonetizationConfig {
  upsellPlatformFeePct: number;
  upsellOrgCommissionPct: number;
}

export const monetizationConfigApi = {
  get: () => apiClient.get<MonetizationConfig>('/monetization-config'),
  /** Commission plateforme — staff uniquement. */
  updatePlatform: (data: { upsellPlatformFeePct: number }) =>
    apiClient.put<MonetizationConfig>('/monetization-config/platform', data),
  /** Commission org/conciergerie — éditable par l'org/host. */
  updateOrg: (data: { upsellOrgCommissionPct: number }) =>
    apiClient.put<MonetizationConfig>('/monetization-config/org', data),
};
