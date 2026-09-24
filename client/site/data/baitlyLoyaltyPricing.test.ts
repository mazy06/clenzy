import { describe, expect, it } from 'vitest';
import {
  loyaltyUnitPrice,
  loyaltyFirstYear,
  loyaltyQuote,
} from './baitlyLoyaltyPricing';

describe('Proposed Baitly loyalty pricing', () => {
  it.each([
    [1, 490],
    [3, 490],
    [4, 441],
    [6, 441],
    [7, 392],
    [12, 392],
    [13, 343],
    [60, 343],
  ])('charges the correct Pro tier in month %i', (month, price) => {
    expect(loyaltyUnitPrice('MA', 'pro', month)).toBe(price);
  });
  it('keeps reductions non-cumulative and prices stable after year one', () => {
    expect(loyaltyUnitPrice('MA', 'essential', 13)).toBe(203);
    expect(loyaltyUnitPrice('MA', 'essential', 24)).toBe(203);
  });
  it('totals actual first-year months without applying the month-13 discount early', () => {
    expect(loyaltyFirstYear('MA', 'pro', 1)).toEqual({
      total: 5145,
      reference: 5880,
      savings: 735,
    });
    expect(loyaltyFirstYear('MA', 'essential', 3)).toEqual({
      total: 9135,
      reference: 10440,
      savings: 1305,
    });
  });
  it('uses market-specific bases and preserves fractional prices', () => {
    expect(loyaltyUnitPrice('EU', 'essential', 13)).toBe(20.3);
    expect(loyaltyUnitPrice('SA', 'pro', 4)).toBe(170.1);
    expect(loyaltyFirstYear('SA', 'pro', 49)).toEqual({
      total: 81364.5,
      reference: 111132,
      savings: 29767.5,
    });
  });
  it.each([
    [4, 1960],
    [5, 2401],
    [9, 4165],
    [10, 4581.5],
    [19, 8330],
    [20, 8722],
    [49, 20090],
  ])('applies marginal volume bands to %i properties', (properties, total) => {
    expect(loyaltyQuote('MA', 'pro', 1, properties).total).toBe(total);
  });
  it('combines volume and loyalty in sequence rather than adding their percentages', () => {
    expect(loyaltyQuote('MA', 'pro', 13, 10)).toMatchObject({
      baseTotal: 4900,
      volumeTotal: 4581.5,
      volumeSavings: 318.5,
      loyaltySavings: 1374.45,
      total: 3207.05,
      average: 320.71,
    });
    expect(loyaltyFirstYear('MA', 'pro', 10)).toEqual({
      total: 48105.75,
      reference: 58800,
      savings: 10694.25,
    });
  });
  it('rounds each monthly total, never multiplying the rounded average', () => {
    expect(loyaltyQuote('EU', 'pro', 13, 10)).toMatchObject({
      total: 320.71,
      average: 32.07,
    });
    expect(loyaltyFirstYear('EU', 'pro', 10)).toEqual({
      total: 4810.59,
      reference: 5880,
      savings: 1069.41,
    });
  });
  it('keeps totals increasing and average unit prices non-increasing across every band', () => {
    for (const market of ['MA', 'EU', 'SA'] as const) {
      for (const plan of ['essential', 'pro'] as const) {
        for (const month of [1, 4, 7, 13]) {
          for (let count = 2; count <= 49; count++) {
            const previous = loyaltyQuote(market, plan, month, count - 1);
            const next = loyaltyQuote(market, plan, month, count);
            expect(next.total).toBeGreaterThan(previous.total);
            expect(next.average).toBeLessThanOrEqual(previous.average);
            expect(
              Math.round(
                (next.baseTotal - next.volumeSavings - next.loyaltySavings) *
                  100,
              ),
            ).toBe(Math.round(next.total * 100));
          }
        }
      }
    }
  });
  it('requires a custom quote beyond 49 and rejects invalid simulation inputs', () => {
    for (const count of [0, -1, 1.5, 50, NaN, Infinity]) {
      expect(() => loyaltyQuote('MA', 'pro', 1, count)).toThrow(RangeError);
    }
    expect(() => loyaltyQuote('MA', 'pro', 0, 1)).toThrow(RangeError);
  });
});
