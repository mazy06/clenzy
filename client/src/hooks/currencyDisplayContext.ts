import { createContext, useContext, type ReactNode } from 'react';
import type { CURRENCY_OPTIONS } from '../utils/currencyUtils';

/** Presentation-only context: importing a price must not initialize PMS authentication. */
export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export interface CurrencyContextType {
  /** Optional presentation renderer for isolated, read-only product demonstrations. */
  renderAmount?: (
    value: number,
    options: { from?: string; decimals?: number; symbolSize?: number },
  ) => ReactNode;
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  currencySymbol: string;
  currencyLabel: string;
  /** Convertit et formate un montant. Prefixe "≈ " si conversion appliquee. */
  convertAndFormat: (
    amount: number | null | undefined,
    fromCurrency?: string,
  ) => string;
  /** Convertit un montant brut (sans formatage). */
  convert: (amount: number, fromCurrency: string) => number;
  /** true si la devise d'affichage differe de EUR (conversion potentielle). */
  isConverting: boolean;
  /** Date des taux utilises (ex: "2026-03-25"). null si pas charge. */
  rateDate: string | null;
  /** Matrice de taux chargee. null si pas encore disponible. */
  rates: Record<string, number> | null;
  /** true pendant le chargement initial de la matrice. */
  ratesLoading: boolean;
}

// ─── Context ────────────────────────────────────────────────────────────────

export const CurrencyContext = createContext<CurrencyContextType | undefined>(
  undefined,
);

export const CurrencyDisplayProvider = CurrencyContext.Provider;

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
