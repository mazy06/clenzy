import apiClient from '../apiClient';

/**
 * Crédits IA (campagne T-08) — solde, poches, packs de recharge, ledger.
 * 1 crédit = 1000 millicredits. Les montants des packs sont définis serveur.
 */

export interface CreditPocket {
  source: 'SUBSCRIPTION' | 'TOPUP' | 'PROMO';
  remainingMillicredits: number;
  expiresAt: string;
}

export interface CreditBalance {
  totalMillicredits: number;
  pockets: CreditPocket[];
}

export interface CreditPack {
  key: string;
  millicredits: number;
  priceCents: number;
  label: string;
}

export interface CreditLedgerLine {
  createdAt: string;
  entryType: 'DEBIT' | 'GRANT' | 'EXPIRY' | 'ADJUSTMENT' | 'REFUND';
  agent: string;
  model: string | null;
  feature: string;
  millicredits: number;
  runId: string | null;
}

export const aiCreditsApi = {
  getBalance: (): Promise<CreditBalance> =>
    apiClient.get<CreditBalance>('/ai/credits/balance'),

  getPacks: (): Promise<CreditPack[]> =>
    apiClient.get<CreditPack[]>('/ai/credits/packs'),

  getLedger: (): Promise<CreditLedgerLine[]> =>
    apiClient.get<CreditLedgerLine[]>('/ai/credits/ledger'),

  /** Crée la session Stripe Checkout d'un pack — rediriger vers checkoutUrl. */
  createTopUp: (pack: string): Promise<{ checkoutUrl: string }> =>
    apiClient.post<{ checkoutUrl: string }>('/ai/credits/topup', { pack }),
};

/** Millicredits → crédits affichables (1 décimale, tabular-nums côté UI). */
export function toCredits(millicredits: number): string {
  return (millicredits / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
