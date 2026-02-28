/**
 * Dynamic currency formatting — multi-currency support.
 *
 * Replaces hardcoded `new Intl.NumberFormat('fr-FR', { currency: 'EUR' })`
 * with a flexible utility that respects the actual currency of each entity.
 */

/**
 * Format an amount with the specified currency.
 * Defaults to EUR if no currency is provided.
 *
 * @param amount  The numeric amount
 * @param currency  ISO 4217 currency code (EUR, MAD, SAR, USD, etc.)
 * @param locale  BCP 47 locale — defaults to 'fr-FR'
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'EUR',
  locale: string = 'fr-FR',
): string {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if the currency code is invalid
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Format an amount without the currency symbol (plain number).
 */
export function formatAmount(
  amount: number | null | undefined,
  locale: string = 'fr-FR',
): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a tax rate as a percentage.
 * Input: 0.10 → "10 %", 0.20 → "20 %"
 */
export function formatTaxRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(rate);
}

/**
 * Get the currency symbol for a given currency code.
 */
export function getCurrencySymbol(currency: string = 'EUR', locale: string = 'fr-FR'): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Common currency options for select dropdowns.
 */
export const CURRENCY_OPTIONS = [
  { code: 'EUR', label: 'Euro (EUR)', symbol: '\u20AC' },
  { code: 'MAD', label: 'Dirham marocain (MAD)', symbol: 'MAD' },
  { code: 'SAR', label: 'Riyal saoudien (SAR)', symbol: 'SAR' },
  { code: 'USD', label: 'Dollar US (USD)', symbol: '$' },
  { code: 'GBP', label: 'Livre sterling (GBP)', symbol: '\u00A3' },
  { code: 'CHF', label: 'Franc suisse (CHF)', symbol: 'CHF' },
] as const;

/**
 * Country options for fiscal profile.
 */
export const COUNTRY_OPTIONS = [
  { code: 'FR', label: 'France' },
  { code: 'MA', label: 'Maroc' },
  { code: 'SA', label: 'Arabie Saoudite' },
] as const;
