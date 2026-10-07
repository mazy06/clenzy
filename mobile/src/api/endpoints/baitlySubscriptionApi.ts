import { apiClient } from '../apiClient';
import type { MonthlyPlan, MonthlyProposal, MonthlyContract, MonthlyBillingCountry } from '@shared/types/baitlySubscription';
import type { SubscriptionChange, SubscriptionChangeProposal, SubscriptionChangeTerms } from '@shared/types/baitlySubscription';

const root = '/subscription/monthly';
export const baitlySubscriptionApi = {
  changes: (id: number) => apiClient.get<SubscriptionChange[]>(`${root}/${id}/changes`),
  changeProposal: (id: number, plan: MonthlyPlan) => apiClient.get<SubscriptionChangeProposal>(`${root}/${id}/change-proposal`, { params: { plan } }),
  scheduleChange: (id: number, plan: MonthlyPlan, requestId: string, accepted: SubscriptionChangeTerms) => apiClient.post<SubscriptionChange>(`${root}/${id}/changes`, { plan, requestId, accepted }),
  paymentMethod: (id: number) => apiClient.post<{ url: string }>(`${root}/${id}/payment-method`, {}),
  billingCountry: () => apiClient.get<MonthlyBillingCountry>(`${root}/billing-country`),
  updateBillingCountry: (billingCountry: string) => apiClient.put<MonthlyBillingCountry>(`${root}/billing-country`, { billingCountry }),
  proposal: (plan: MonthlyPlan, promoCode: string) => apiClient.get<MonthlyProposal>(`${root}/proposal`, { params: { plan, promoCode } }),
  contracts: () => apiClient.get<MonthlyContract[]>(root),
  checkout: (plan: MonthlyPlan, requestId: string, promoCode: string | null) => apiClient.post<{ checkoutUrl: string; sessionId: string }>(`${root}/checkout`, { plan, requestId, promoCode }),
  refresh: (id: number) => apiClient.post<void>(`${root}/${id}/refresh`, {}),
  abandon: (id: number) => apiClient.post<void>(`${root}/${id}/abandon`, {}),
};

export function requireBaitlyStripeCheckout(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'checkout.stripe.com' || parsed.username || parsed.password)
    throw new Error('Adresse de paiement inattendue');
  return url;
}
