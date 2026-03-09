/**
 * Country-to-defaults mapping for IP geolocation auto-detection.
 *
 * When a new user visits the app, we detect their country via IP
 * and apply sensible defaults for currency, language, and fiscal settings.
 */

export interface CountryDefaults {
  countryCode: string;
  currency: 'EUR' | 'MAD' | 'SAR';
  language: 'fr' | 'en' | 'ar';
  fiscalCountry: 'FR' | 'MA' | 'SA';
}

// ─── Direct country mappings ────────────────────────────────────────────────

const COUNTRY_DEFAULTS_MAP: Record<string, CountryDefaults> = {
  FR: { countryCode: 'FR', currency: 'EUR', language: 'fr', fiscalCountry: 'FR' },
  MA: { countryCode: 'MA', currency: 'MAD', language: 'fr', fiscalCountry: 'MA' },
  SA: { countryCode: 'SA', currency: 'SAR', language: 'ar', fiscalCountry: 'SA' },
};

// ─── European countries → EUR fallback ──────────────────────────────────────

const EUR_COUNTRIES = new Set([
  'FR', 'DE', 'ES', 'IT', 'BE', 'NL', 'PT', 'AT', 'IE', 'FI',
  'LU', 'GR', 'SI', 'SK', 'EE', 'LV', 'LT', 'MT', 'CY', 'HR',
]);

// ─── Arabic-speaking countries → SAR-adjacent defaults ──────────────────────

const ARABIC_COUNTRIES = new Set([
  'SA', 'AE', 'BH', 'KW', 'OM', 'QA', 'YE', 'IQ', 'JO', 'LB',
  'SY', 'PS', 'EG', 'SD', 'LY', 'TN', 'DZ',
]);

/**
 * Get default preferences for a given ISO 3166-1 alpha-2 country code.
 */
export function getCountryDefaults(countryCode: string): CountryDefaults {
  const upper = countryCode.toUpperCase();

  // Direct match (FR, MA, SA)
  if (COUNTRY_DEFAULTS_MAP[upper]) {
    return COUNTRY_DEFAULTS_MAP[upper];
  }

  // Morocco special: already matched above, but Francophone North Africa
  if (upper === 'TN' || upper === 'DZ') {
    return { countryCode: upper, currency: 'EUR', language: 'fr', fiscalCountry: 'FR' };
  }

  // EU countries → EUR / French
  if (EUR_COUNTRIES.has(upper)) {
    return { countryCode: upper, currency: 'EUR', language: 'fr', fiscalCountry: 'FR' };
  }

  // Gulf / Arabic countries → SAR / Arabic
  if (ARABIC_COUNTRIES.has(upper)) {
    return { countryCode: upper, currency: 'SAR', language: 'ar', fiscalCountry: 'SA' };
  }

  // Global fallback → EUR / English
  return { countryCode: upper, currency: 'EUR', language: 'en', fiscalCountry: 'FR' };
}
