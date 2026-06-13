import apiClient from '../apiClient';

/**
 * Revenus par canal org-scopés pour le widget dashboard. Calculé côté backend
 * depuis les réservations réservées (non annulées) de l'org, regroupées par
 * source. Les reversements propriétaires vivent dans la carte « Gestion &
 * reversements » (calcul client depuis le module de reversements).
 */
export interface ChannelRevenue {
  /** clé canal : airbnb | booking | direct | other */
  source: string;
  label: string;
  amount: number;
  /** part % sur la période courante (0-100). */
  pct: number;
  /** part % sur la période précédente (null si N/A) → delta de comparaison. */
  comparePct: number | null;
}

export interface BillingOverview {
  currency: string;
  channels: ChannelRevenue[];
}

/** Portée d'agrégation des revenus par canal : mois ou année en cours. */
export type BillingScope = 'month' | 'year';

export const dashboardBillingApi = {
  getOverview: (scope: BillingScope = 'month'): Promise<BillingOverview> =>
    apiClient.get<BillingOverview>('/dashboard/billing-overview', { params: { scope } }),
};
