import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import storageService, { STORAGE_KEYS } from '../services/storageService';
import { CURRENCY_OPTIONS, formatCurrency } from '../utils/currencyUtils';
import { exchangeRateApi, type RateMatrix } from '../services/api/exchangeRateApi';
import { useUserPreferences } from './useUserPreferences';
import keycloak from '../keycloak';

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
  // Boot synchrone depuis localStorage pour eviter le flash devise au mount.
  // Le backend (user_preferences.currency) reste la source de verite et
  // ecrase la valeur locale des qu'il repond (cf. useEffect ci-dessous).
  const [currency, setCurrencyState] = useState<CurrencyCode>(getSavedCurrency);
  const [rateMatrix, setRateMatrix] = useState<RateMatrix | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const fetchedAt = useRef<number>(0);

  // Sync backend → local (source de verite serveur). Ignore si pas authentifie
  // (le hook tournerait en 401). On garde le cache localStorage comme fallback.
  const { preferences, updatePreferences } = useUserPreferences();
  useEffect(() => {
    if (!keycloak.authenticated) return;
    const serverCurrency = preferences.currency as CurrencyCode | undefined;
    if (!serverCurrency) return;
    if (!CURRENCY_OPTIONS.some((o) => o.code === serverCurrency)) return;
    if (serverCurrency === currency) return;
    setCurrencyState(serverCurrency);
    storageService.setItem(STORAGE_KEYS.CURRENCY, serverCurrency);
  }, [preferences.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCurrency = useCallback((code: CurrencyCode) => {
    // Optimistic update : local + cache immediatement, puis push backend
    // en best-effort (le serveur reste source de verite au prochain reload).
    setCurrencyState(code);
    storageService.setItem(STORAGE_KEYS.CURRENCY, code);
    if (keycloak.authenticated) {
      updatePreferences({ currency: code }).catch(() => {
        // Best-effort : si la PUT echoue, la valeur locale persiste
        // jusqu'au prochain sync backend.
      });
    }
  }, [updatePreferences]);

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

      // Same currency → format directly
      if (from === currency) {
        return formatCurrency(amount, currency);
      }

      // No rates available, or target rate missing → show in original currency
      if (!rates || !(currency in rates)) {
        return formatCurrency(amount, from);
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
