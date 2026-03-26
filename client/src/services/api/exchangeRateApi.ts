import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateMatrix {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface ExchangeRateHistoryItem {
  id: number;
  baseCurrency: string;
  targetCurrency: string;
  rate: number;
  rateDate: string;
  source: string;
}

export interface ExchangeRateHistoryPage {
  content: ExchangeRateHistoryItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ExchangeRateHistoryParams {
  baseCurrency?: string;
  targetCurrency?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = '/exchange-rates';

export const exchangeRateApi = {
  /** Matrice de tous les taux actuels (base EUR). */
  getMatrix: (): Promise<RateMatrix> =>
    apiClient.get(`${BASE}/matrix`),

  /** Historique des taux (admin). */
  getHistory: (params: ExchangeRateHistoryParams): Promise<ExchangeRateHistoryPage> =>
    apiClient.get(`${BASE}/history`, { params: params as Record<string, string | number> }),

  /** Force la mise a jour des taux depuis la BCE. */
  refresh: (): Promise<void> =>
    apiClient.post(`${BASE}/refresh`),
};
