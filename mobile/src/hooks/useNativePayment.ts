import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { paymentsApi, PaymentSheetRequest } from '@/api/endpoints/paymentsApi';
import { STRIPE_CONFIG } from '@/config/stripe';

export type PaymentState = 'idle' | 'loading' | 'ready' | 'presenting' | 'success' | 'cancelled' | 'error';

interface UseNativePaymentReturn {
  state: PaymentState;
  error: string | null;
  initAndPresentPaymentSheet: (request: PaymentSheetRequest) => Promise<boolean>;
  reset: () => void;
}

/**
 * Hook pour les paiements natifs via Stripe Payment Sheet.
 * Gere le flow complet : appel backend → initialisation → presentation du Payment Sheet.
 */
export function useNativePayment(): UseNativePaymentReturn {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [state, setState] = useState<PaymentState>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
  }, []);

  const initAndPresentPaymentSheet = useCallback(
    async (request: PaymentSheetRequest): Promise<boolean> => {
      try {
        setState('loading');
        setError(null);

        // 1. Appeler le backend pour obtenir les secrets
        const response = await paymentsApi.createPaymentSheet(request);

        // 2. Initialiser le Payment Sheet
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: STRIPE_CONFIG.merchantDisplayName,
          customerId: response.customer,
          customerEphemeralKeySecret: response.ephemeralKey,
          paymentIntentClientSecret: response.paymentIntent,
          allowsDelayedPaymentMethods: false,
          applePay: {
            merchantCountryCode: STRIPE_CONFIG.merchantCountryCode,
          },
          googlePay: {
            merchantCountryCode: STRIPE_CONFIG.merchantCountryCode,
            testEnv: __DEV__,
          },
          defaultBillingDetails: {
            address: {
              country: 'FR',
            },
          },
        });

        if (initError) {
          setState('error');
          setError(initError.message);
          return false;
        }

        setState('ready');

        // 3. Presenter le Payment Sheet
        setState('presenting');
        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          if (presentError.code === 'Canceled') {
            setState('cancelled');
            return false;
          }
          setState('error');
          setError(presentError.message);
          return false;
        }

        // 4. Paiement reussi
        setState('success');
        return true;
      } catch (err: any) {
        setState('error');
        const message = err?.response?.data?.error || err?.message || 'Erreur inconnue';
        setError(message);
        return false;
      }
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  return {
    state,
    error,
    initAndPresentPaymentSheet,
    reset,
  };
}
