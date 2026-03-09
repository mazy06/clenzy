import { useEffect, useRef } from 'react';
import { STORAGE_KEYS, getItem, setItem } from '../services/storageService';
import { getCountryDefaults } from '../utils/countryDefaults';
import { useCurrency } from './useCurrency';
import { useTranslation } from './useTranslation';

/**
 * Detect the user's country via IP geolocation on first visit.
 *
 * Flow:
 *  1. If `GEO_APPLIED` is already 'true' → skip (detection already done)
 *  2. If `CURRENCY` already exists → skip (existing user) + mark as applied
 *  3. Call ipapi.co with a 5-second timeout
 *  4. Map the detected country to currency + language defaults
 *  5. Apply defaults and mark as applied
 *
 * The detection is fire-and-forget: it never blocks rendering.
 * On failure, the user keeps existing defaults (EUR / fr).
 */
export function useGeoDetection() {
  const { setCurrency } = useCurrency();
  const { changeLanguage } = useTranslation();
  const calledRef = useRef(false);

  useEffect(() => {
    // Prevent double-call in React StrictMode
    if (calledRef.current) return;
    calledRef.current = true;

    // Already applied → nothing to do
    if (getItem(STORAGE_KEYS.GEO_APPLIED) === 'true') return;

    // Existing user (already picked a currency before geo was implemented)
    const existingCurrency = getItem(STORAGE_KEYS.CURRENCY);
    if (existingCurrency) {
      setItem(STORAGE_KEYS.GEO_APPLIED, 'true');
      return;
    }

    detectCountry()
      .then((countryCode) => {
        if (!countryCode) return;

        const defaults = getCountryDefaults(countryCode);

        // Store raw detected country (used by FiscalProfileSection)
        setItem(STORAGE_KEYS.GEO_COUNTRY, countryCode);

        // Apply currency
        setCurrency(defaults.currency);

        // Apply language (only if i18next hasn't already picked one from browser)
        const existingLang = getItem(STORAGE_KEYS.LANGUAGE);
        if (!existingLang) {
          changeLanguage(defaults.language);
        }

        // Mark as applied to prevent re-detection
        setItem(STORAGE_KEYS.GEO_APPLIED, 'true');
      })
      .catch(() => {
        // Geolocation failed — user keeps defaults (EUR / fr)
        // Mark as applied anyway to avoid retrying every page load
        setItem(STORAGE_KEYS.GEO_APPLIED, 'true');
      });
  }, [setCurrency, changeLanguage]);
}

// ─── IP Geolocation API ──────────────────────────────────────────────────────

async function detectCountry(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    return data.country_code || null; // ISO 3166-1 alpha-2
  } catch {
    return null;
  }
}
