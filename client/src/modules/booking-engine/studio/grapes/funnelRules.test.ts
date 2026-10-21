import { expect, it } from 'vitest';
import { validateComposition } from './funnelRules';

it('accepts a cart populated on another page while reporting truly missing prerequisites', () => {
  expect(validateComposition(['booking-cart']).some((warning) => warning.capability === 'cart-item')).toBe(true);
  expect(validateComposition(['booking-cart', 'booking-guest-form'], ['booking-dates', 'booking-add-to-cart'])).toEqual([]);
  expect(validateComposition(['booking-price-summary'], ['booking-dates'])).toEqual([]);
});
