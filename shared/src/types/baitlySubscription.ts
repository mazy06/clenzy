export type MonthlyPlan = 'essential' | 'pro';
export interface SubscriptionChangeTerms {
  plan: MonthlyPlan; properties: number; currency: string; subscriptionMonth: number; effectiveAt: number;
  monthOne: number; monthFour: number; monthSeven: number; monthThirteen: number; version: string;
}
export interface SubscriptionChange { id: number; requestId: string; terms: SubscriptionChangeTerms; status: 'PREPARED' | 'SCHEDULED' | 'APPLIED' | 'CANCELLED' }
export interface SubscriptionChangeProposal { terms: SubscriptionChangeTerms; chargeNowCents: number; reason: string }
export interface MonthlyBillingCountry { billingCountry: string | null; sellerCountry: string | null }
export interface MonthlyQuote {
  version: string; plan: MonthlyPlan; market: string; currency: string; properties: number;
  subscriptionMonth: number; loyaltyPercent: number; baseCents: number; volumeCents: number; totalCents: number;
}
export interface MonthlyProposal {
  phases: MonthlyQuote[]; propertyCount: number; previousPlan: string | null;
  firstInvoiceExcludingTaxCents: number; promoCode: string | null; subscriptionMonth: number;
}
export interface MonthlyContract {
  id: number; requestId: string; plan: MonthlyPlan; status: string; currency: string; properties: number;
  firstInvoiceExcludingTaxCents: number; monthOneCents: number; monthFourCents: number;
  monthSevenCents: number; monthThirteenCents: number; promoCode: string | null; paidUntil: string | null; cancelAtPeriodEnd: boolean;
}
export interface SubscriptionBill {
  id: string; status: string; currency: string; excludingTaxCents: number; totalCents: number;
  paidCents: number; remainingCents: number; hostedUrl: string | null; pdfUrl: string | null; issuedAt: string;
}
