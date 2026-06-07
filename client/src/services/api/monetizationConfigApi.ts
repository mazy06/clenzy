import apiClient from '../apiClient';

/** Taux de monétisation par org (part plateforme upsells / part hôte commissions activités), en %. */
export interface MonetizationConfig {
  upsellPlatformFeePct: number;
  activityHostSharePct: number;
}

export const monetizationConfigApi = {
  get: () => apiClient.get<MonetizationConfig>('/monetization-config'),
  update: (data: MonetizationConfig) => apiClient.put<MonetizationConfig>('/monetization-config', data),
};
