import { useState, useCallback, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { useCreatePaymentSession, usePaymentSessionStatus, useInvalidatePayments } from './usePayments';
import { useUiStore } from '@/store/uiStore';

export type CheckoutState = 'idle' | 'creating' | 'open' | 'polling' | 'success' | 'failed' | 'error';

interface UseStripeCheckoutReturn {
  state: CheckoutState;
  errorMessage: string | null;
  startCheckout: (interventionId: number, amount: number) => void;
  reset: () => void;
}

const MAX_POLL_ATTEMPTS = 30; // 30 * 2s = 60s max

export function useStripeCheckout(): UseStripeCheckoutReturn {
  const [state, setState] = useState<CheckoutState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  const createSession = useCreatePaymentSession();
  const invalidatePayments = useInvalidatePayments();
  const showToast = useUiStore((s) => s.showToast);

  // Polling is enabled only when state is 'polling' and we have a sessionId
  const isPolling = state === 'polling' && !!sessionId;
  const { data: sessionStatus } = usePaymentSessionStatus(sessionId, isPolling);

  // Watch polling results
  useEffect(() => {
    if (state !== 'polling' || !sessionStatus) return;

    pollCountRef.current += 1;

    if (sessionStatus.paymentStatus === 'PAID') {
      setState('success');
      invalidatePayments();
      showToast('Paiement confirme avec succes !', 'success');
    } else if (sessionStatus.paymentStatus === 'FAILED' || sessionStatus.paymentStatus === 'CANCELLED') {
      setState('failed');
      setErrorMessage('Le paiement a echoue. Veuillez reessayer.');
    } else if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      // Timeout after max attempts
      setState('failed');
      setErrorMessage('La verification du paiement a expire. Verifiez dans votre historique.');
    }
  }, [sessionStatus, state, invalidatePayments, showToast]);

  const startCheckout = useCallback(async (interventionId: number, amount: number) => {
    try {
      setState('creating');
      setErrorMessage(null);
      pollCountRef.current = 0;

      // 1. Create Stripe Checkout session
      const response = await createSession.mutateAsync({ interventionId, amount });

      setSessionId(response.sessionId);

      // 2. Open Stripe Checkout in browser
      setState('open');
      const result = await WebBrowser.openBrowserAsync(response.url, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      // 3. User came back from browser — start polling
      if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'opened') {
        setState('polling');
      }
    } catch (err: any) {
      setState('error');
      setErrorMessage(err?.message || 'Une erreur est survenue lors de la creation du paiement.');
      showToast('Erreur lors du paiement', 'error');
    }
  }, [createSession, showToast]);

  const reset = useCallback(() => {
    setState('idle');
    setSessionId(null);
    setErrorMessage(null);
    pollCountRef.current = 0;
  }, []);

  return { state, errorMessage, startCheckout, reset };
}
