import type { QuoteAction, QuoteRequest, QuoteSide, ServiceItem } from './api';

export function providerRating(average: number | null | undefined, count: number | undefined): number | null {
  return typeof count === 'number' && Number.isInteger(count) && count > 0 && typeof average === 'number' && Number.isFinite(average)
    && average >= 1 && average <= 5 ? average : null;
}

export function allowedQuoteActions(request: QuoteRequest, side: QuoteSide): QuoteAction[] {
  if (side === 'received') return request.status === 'SENT' ? ['turn-down'] : [];
  if (request.status === 'SENT') return ['withdraw'];
  if (request.status === 'QUOTED' && !request.expired) return ['accept', 'decline'];
  return [];
}

/** Keep monetary input exact; the server remains authoritative. */
export function normalizeQuoteAmount(input: string): string | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value) || !/[1-9]/.test(value)) return null;
  return value;
}

export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateRequestContext(item: ServiceItem | undefined, context: {
  propertyId?: number; date: string; time: string; duration: string;
}): 'property' | 'date' | 'slot' | null {
  if (item?.propertyRequired && !context.propertyId) return 'property';
  if (((item?.slotRequired || context.time || context.duration) && !context.date) || (context.date && !isCivilDate(context.date))) return 'date';
  if (item?.slotRequired || context.time || context.duration) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(context.time)) return 'slot';
    if (!/^\d+$/.test(context.duration) || Number(context.duration) < 15 || Number(context.duration) > 1440) return 'slot';
  }
  return null;
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined, locale: string): string | null {
  if (amount == null || !currency || !Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(amount);
  } catch {
    return null;
  }
}

/** La région règle l’affichage ; la devise du prix reste celle du serveur. */
export function catalogMoneyParts(amount: number | null | undefined, currency: string | null | undefined, language: string, country?: string | null): Intl.NumberFormatPart[] | null {
  if (amount == null || !currency || !Number.isFinite(amount)) return null;
  try {
    const locale = /^[A-Z]{2}$/.test(country ?? '') ? `${language.split('-')[0]}-${country}` : language;
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency,
      currencyDisplay: currency === 'MAD' || currency === 'SAR' ? 'code' : 'narrowSymbol',
      numberingSystem: 'latn', minimumFractionDigits: Number.isInteger(amount) ? 0 : undefined });
    if (typeof formatter.formatToParts === 'function') return formatter.formatToParts(amount);
    // Certains binaires Hermes disposent de format(), sans formatToParts().
    const formatted = formatter.format(amount);
    const at = currency === 'MAD' || currency === 'SAR' ? formatted.indexOf(currency) : -1;
    return at < 0 ? [{ type: 'literal', value: formatted }] : [
      { type: 'literal', value: formatted.slice(0, at) }, { type: 'currency', value: currency },
      { type: 'literal', value: formatted.slice(at + currency.length) },
    ];
  } catch { return null; }
}
