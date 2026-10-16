import { allowedQuoteActions, catalogMoneyParts, formatMoney, isCivilDate, normalizeQuoteAmount, providerRating, validateRequestContext } from '../domain';
import type { QuoteRequest, ServiceItem } from '../api';

const request = { status: 'QUOTED', expired: false } as QuoteRequest;
const onsite = { propertyRequired: true, slotRequired: true } as ServiceItem;

it('only displays a rating backed by reviews and a valid average', () => {
  expect(providerRating(4.7, 12)).toBe(4.7);
  expect(providerRating(5, 0)).toBeNull();
  expect(providerRating(null, 4)).toBeNull();
  expect(providerRating(0, 4)).toBeNull();
  expect(providerRating(5.1, 4)).toBeNull();
  expect(providerRating(Number.NaN, 4)).toBeNull();
  expect(providerRating(4, -1)).toBeNull();
  expect(providerRating(4, 1.5)).toBeNull();
});

it('does not accept an expired quote or expose owner decisions on the provider side', () => {
  expect(allowedQuoteActions(request, 'sent')).toEqual(['accept', 'decline']);
  expect(allowedQuoteActions({ ...request, expired: true }, 'sent')).toEqual([]);
  expect(allowedQuoteActions(request, 'received')).toEqual([]);
  expect(allowedQuoteActions({ ...request, status: 'ACCEPTED' }, 'sent')).toEqual([]);
});
it('uses actual currencies and preserves fractions without relabelling prices for another country', () => {
  expect(catalogMoneyParts(35, 'EUR', 'fr', 'MA')?.find(p => p.type === 'currency')?.value).toBe('€');
  expect(catalogMoneyParts(35, 'USD', 'en', 'US')?.find(p => p.type === 'currency')?.value).toBe('$');
  expect(catalogMoneyParts(350, 'MAD', 'fr', 'MA')?.some(p => p.type === 'fraction')).toBe(false);
  expect(catalogMoneyParts(350.50, 'MAD', 'fr', 'MA')?.find(p => p.type === 'fraction')?.value).toBe('50');
  expect(catalogMoneyParts(0, 'MAD', 'ar', 'MA')).not.toBeNull();
  expect(catalogMoneyParts(350, null, 'fr', 'MA')).toBeNull();
});
it('still renders monetary values on Hermes without formatToParts', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl.NumberFormat.prototype, 'formatToParts')!;
  Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', { configurable: true, value: undefined });
  try {
    const parts = catalogMoneyParts(350, 'MAD', 'fr', 'MA');
    expect(parts?.find(p => p.type === 'currency')?.value).toBe('MAD');
    expect(parts?.map(p => p.value).join('')).toContain('350');
    expect(catalogMoneyParts(35.50, 'EUR', 'fr', 'FR')?.map(p => p.value).join('')).toContain('35,50');
  } finally { Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', descriptor); }
});
it('offers withdrawal only before a quote and refusal only to the receiving provider', () => {
  expect(allowedQuoteActions({ ...request, status: 'SENT' }, 'sent')).toEqual(['withdraw']);
  expect(allowedQuoteActions({ ...request, status: 'SENT' }, 'received')).toEqual(['turn-down']);
});
it.each(['0', '0.00', '-2', '1.001', '1e3', '10abc', '10000000000', 'NaN'])('rejects invalid monetary input %s without rounding it', input => {
  expect(normalizeQuoteAmount(input)).toBeNull();
});
it('preserves exact decimal input and handles the local comma separator', () => {
  expect(normalizeQuoteAmount(' 19,90 ')).toBe('19.90');
  expect(normalizeQuoteAmount('9999999999.99')).toBe('9999999999.99');
});
it.each(['2026-02-29', '2026-02-31', '2026-13-01', '12/10/2026'])('rejects invalid civil date %s', date => {
  expect(isCivilDate(date)).toBe(false);
});
it('accepts leap dates without shifting the date to a local timezone', () => {
  expect(isCivilDate('2028-02-29')).toBe(true);
});
it('requires onsite property and valid time and duration, but permits remote work without them', () => {
  expect(validateRequestContext(onsite, { date: '2026-10-20', time: '14:00', duration: '60' })).toBe('property');
  expect(validateRequestContext(onsite, { propertyId: 1, date: '', time: '14:00', duration: '60' })).toBe('date');
  expect(validateRequestContext(onsite, { propertyId: 1, date: '2026-10-20', time: '24:00', duration: '60' })).toBe('slot');
  expect(validateRequestContext(onsite, { propertyId: 1, date: '2026-10-20', time: '14:00', duration: '14' })).toBe('slot');
  expect(validateRequestContext({ propertyRequired: false, slotRequired: false } as ServiceItem, { date: '', time: '', duration: '' })).toBeNull();
});
it('does not invent a currency or treat a known zero amount as missing', () => {
  expect(formatMoney(10, undefined, 'fr')).toBeNull();
  expect(formatMoney(0, 'MAD', 'fr')).not.toBeNull();
  expect(formatMoney(Number.NaN, 'MAD', 'fr')).toBeNull();
});
