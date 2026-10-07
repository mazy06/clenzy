import apiClient from "../apiClient";

export type PaymentScope = "PERSONAL" | "ORGANIZATION";
export interface PaymentConnectionStatus {
  scope: PaymentScope;
  country: string | null;
  accountCreated: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  ready: boolean;
  canManageOrganization: boolean;
  creationAvailable: boolean;
  connectionAvailable: boolean;
  reconnectRequired: boolean;
}
export const paymentConnectApi = {
  status: (scope: PaymentScope) =>
    apiClient.get<PaymentConnectionStatus>(
      `/me/payment-connections/me?scope=${scope}`,
    ),
  start: (scope: PaymentScope, country: string, intent: "CREATE" | "CONNECT") =>
    apiClient.post<{ url: string }>("/me/payment-connections/stripe/start", {
      scope,
      country,
      intent,
    }),
  refresh: (scope: PaymentScope) =>
    apiClient.post<PaymentConnectionStatus>(
      `/me/payment-connections/stripe/refresh?scope=${scope}`,
      {},
    ),
  complete: (scope: PaymentScope, state: string, code: string) =>
    apiClient.post<PaymentConnectionStatus>(
      "/me/payment-connections/stripe/complete",
      { scope, state, code },
    ),
};

/** Only server-generated Stripe authorization links may navigate this flow. */
export function redirectToPaymentProvider(url: string) {
  const target = new URL(url);
  if (
    target.protocol !== "https:" ||
    !target.hostname.endsWith(".stripe.com") ||
    target.username ||
    target.password
  )
    throw new Error("Invalid payment provider URL");
  window.location.assign(target.href);
}
