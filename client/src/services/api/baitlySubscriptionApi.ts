import apiClient from '../apiClient';
import type { SubscriptionChange, SubscriptionChangeProposal, SubscriptionChangeTerms } from '../../../../shared/src/types/baitlySubscription';

import type { MonthlyPlan, MonthlyProposal, MonthlyContract, SubscriptionBill, MonthlyBillingCountry } from "../../../../shared/src/types/baitlySubscription";
export { BAITLY_BILLING_COUNTRIES } from "../../../../shared/src/types/baitlySubscription";
export type { MonthlyPlan, MonthlyQuote, MonthlyProposal, MonthlyContract, SubscriptionBill } from "../../../../shared/src/types/baitlySubscription";
const root = '/subscription/monthly';
export const baitlySubscriptionApi = {
  changes: (id: number) => apiClient.get<SubscriptionChange[]>(`${root}/${id}/changes`),
  changeProposal: (id: number, plan: MonthlyPlan) => apiClient.get<SubscriptionChangeProposal>(`${root}/${id}/change-proposal?${new URLSearchParams({ plan })}`),
  scheduleChange: (id: number, plan: MonthlyPlan, requestId: string, accepted: SubscriptionChangeTerms) => apiClient.post<SubscriptionChange>(`${root}/${id}/changes`, { plan, requestId, accepted }),
  paymentMethod: (id: number) => apiClient.post<{ url: string }>(`${root}/${id}/payment-method`, {}),
  billingCountry: () => apiClient.get<MonthlyBillingCountry>(`${root}/billing-country`),
  updateBillingCountry: (billingCountry: string) => apiClient.put<MonthlyBillingCountry>(`${root}/billing-country`, { billingCountry }),
  proposal: (plan: MonthlyPlan, promoCode: string) => apiClient.get<MonthlyProposal>(`${root}/proposal?${new URLSearchParams({ plan, promoCode })}`),
  contracts: () => apiClient.get<MonthlyContract[]>(root),
  invoices: () => apiClient.get<SubscriptionBill[]>(`${root}/invoices`),
  checkout: (plan: MonthlyPlan, requestId: string, promoCode: string | null) => apiClient.post<{ checkoutUrl: string; sessionId: string }>(`${root}/checkout`, { plan, requestId, promoCode }),
  refresh: (id: number) => apiClient.post<void>(`${root}/${id}/refresh`, {}),
  abandon: (id: number) => apiClient.post<void>(`${root}/${id}/abandon`, {}),
  cancel: (id: number) => apiClient.post<void>(`${root}/${id}/cancel-at-period-end`, {}),
};
