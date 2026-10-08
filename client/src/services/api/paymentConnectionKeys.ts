import type { PaymentScope } from './paymentConnectApi';

/** Le statut d'un compte PSP ne doit jamais être réutilisé entre deux identités ou organisations. */
export const paymentConnectionKey = (identity: string, scope: PaymentScope) => ['payment-connection', identity, scope] as const;
