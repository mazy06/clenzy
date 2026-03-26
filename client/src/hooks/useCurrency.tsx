import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { CURRENCY_OPTIONS, formatCurrency } from '../utils/currencyUtils';
import { exchangeRateApi, type RateMatrix } from '../services/api/exchangeRateApi';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  currencySymbol: string;
  currencyLabel: string;
  /** Convertit et formate un montant. Prefixe "≈ " si conversion appliquee. */
  convertAndFormat: (amount: number | null | undefined, fromCurrency?: string) => string;
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

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSavedCurrency(): CurrencyCode {
  try {
    const saved = storageService.getItem(STORAGE_KEYS.CURRENCY);
    if (saved && CURRENCY_OPTIONS.some((o) => o.code === saved)) {
      return saved as CurrencyCode;
    }
  } catch {
    // Silent fail
  }
  return 'EUR';
}

function getCurrencyMeta(code: CurrencyCode) {
  return CURRENCY_OPTIONS.find((o) => o.code === code) ?? CURRENCY_OPTIONS[0];
}

/** Stale time for the rate matrix cache (30 min). */
const MATRIX_STALE_MS = 30 * 60 * 1000;

// ─── Provider ───────────────────────────────────────────────────────────────

interface CurrencyProviderProps {
  children: React.ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(getSavedCurrency);
  const [rateMatrix, setRateMatrix] = useState<RateMatrix | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const fetchedAt = useRef<number>(0);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    storageService.setItem(STORAGE_KEYS.CURRENCY, code);
  }, []);

  // Fetch rate matrix when needed (currency !== EUR or stale cache)
  useEffect(() => {
    const now = Date.now();
    const isStale = now - fetchedAt.current > MATRIX_STALE_MS;

    // Only fetch if not EUR and (no cache or stale)
    if (currency === 'EUR' && rateMatrix) return;
    if (rateMatrix && !isStale) return;

    let cancelled = false;
    setRatesLoading(true);

    exchangeRateApi
      .getMatrix()
      .then((matrix) => {
        if (!cancelled) {
          setRateMatrix(matrix);
          fetchedAt.current = Date.now();
        }
      })
      .catch((err) => {
        console.warn('[CurrencyProvider] Failed to fetch rate matrix:', err);
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = getCurrencyMeta(currency);
  const rates = rateMatrix?.rates ?? null;

  const convert = useCallback(
    (amount: number, fromCurrency: string): number => {
      if (!rates || fromCurrency === currency) return amount;
      // Rates are EUR-based: rates[X] = how many X per 1 EUR
      const fromRate = rates[fromCurrency] ?? 1;
      const toRate = rates[currency] ?? 1;
      return amount * (toRate / fromRate);
    },
    [rates, currency],
  );

  const convertAndFormat = useCallback(
    (amount: number | null | undefined, fromCurrency?: string): string => {
      if (amount == null) return '—';
      const from = fromCurrency ?? 'EUR';

      // Same currency or no rates → format directly
      if (from === currency || !rates) {
        return formatCurrency(amount, currency);
      }

      const converted = convert(amount, from);
      return '≈ ' + formatCurrency(converted, currency);
    },
    [currency, rates, convert],
  );

  const contextValue = useMemo<CurrencyContextType>(
    () => ({
      currency,
      setCurrency,
      currencySymbol: meta.symbol,
      currencyLabel: meta.label,
      convertAndFormat,
      convert,
      isConverting: currency !== 'EUR',
      rateDate: rateMatrix?.date ?? null,
      rates,
      ratesLoading,
    }),
    [currency, setCurrency, meta.symbol, meta.label, convertAndFormat, convert, rateMatrix, rates, ratesLoading],
  );

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
