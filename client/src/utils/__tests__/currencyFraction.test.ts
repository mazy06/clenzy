import { describe, expect, it } from 'vitest';
import { stripCurrencyFraction } from '../currencyUtils';

describe('compact currency amounts', () => {
  it.each(['fr-FR', 'en-GB', 'ar-SA-u-nu-latn', 'ar-SA-u-nu-arab'])('preserves every thousands group in %s', (locale) => {
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
    const parts = formatter.formatToParts(1234567.89);
    const expected = parts.filter(({type}) => type !== 'decimal' && type !== 'fraction').map(({value}) => value).join('');
    expect(stripCurrencyFraction(formatter.format(1234567.89), locale)).toBe(expected);
    expect(stripCurrencyFraction(`≈ ${formatter.format(1234567.89)}`, locale)).toBe(`≈ ${expected}`);
  });
});
