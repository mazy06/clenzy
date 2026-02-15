import apiClient from '../apiClient';

export interface UpgradeResponse {
  checkoutUrl?: string;
  error?: string;
}

export const subscriptionApi = {
  /**
   * Demande un upgrade de forfait.
   * Retourne l'URL Stripe Checkout pour rediriger l'utilisateur.
   */
  async upgrade(targetForfait: string): Promise<UpgradeResponse> {
    return apiClient.post<UpgradeResponse>('/subscription/upgrade', { targetForfait });
  },
};
