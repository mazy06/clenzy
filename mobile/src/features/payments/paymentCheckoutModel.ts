import type { PaymentSessionStatus } from '@/api/endpoints/paymentsApi';

/**
 * Where the payer stands. The checkout page belongs to whichever provider the server routes the
 * payment to (Stripe today, regional PSPs later): the app never assumes success, it reads the
 * status the server recorded from that provider.
 */
export type CheckoutPhase = 'ready' | 'opening' | 'checking' | 'paid' | 'unfinished' | 'failed';

export function phaseAfterCheck(status: PaymentSessionStatus['paymentStatus'] | undefined, attempts: number, maxAttempts: number): CheckoutPhase {
  if (status === 'PAID') return 'paid';
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed';
  // Closing the page without paying is normal: offer to resume, not an error.
  return attempts >= maxAttempts ? 'unfinished' : 'checking';
}

/** Only an https page can be a provider checkout; anything else is refused before opening. */
export function safeCheckoutUrl(url: string | null | undefined) {
  if (!url) return null;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}
