import riad from '../assets/photos/guesthouse.jpg';
import pool from '../assets/photos/pool.jpg';
import terrace from '../assets/photos/terrace.jpg';
import bedroom from '../assets/photos/bedroom.jpg';
import food from '../assets/photos/food.jpg';
import excursion from '../assets/photos/excursion.jpg';

/** Illustrative storefronts, independent from the customer's template catalogue. */
export const BAITLY_BOOKING_TEMPLATES = [
  {
    id: 'riad',
    name: 'Maison Zayna',
    photo: riad,
    detail: bedroom,
    base: 360,
    prices: [36, 28],
    extras: [food, excursion],
  },
  {
    id: 'villa',
    name: 'Villa Naya',
    photo: pool,
    detail: terrace,
    base: 720,
    prices: [85, 45],
    extras: [food, pool],
  },
  {
    id: 'collection',
    name: 'Les échappées',
    photo: terrace,
    detail: riad,
    base: 540,
    prices: [40, 55],
    extras: [excursion, food],
  },
] as const;

export type BookingTemplate = typeof BAITLY_BOOKING_TEMPLATES[number];

/** Fictional rate comparison for the demos, on accommodation only. */
export const BOOKING_DEMO_DIRECT_DISCOUNT = 0.2;

export function getBookingDemoRate(direct: number) {
  const reference =
    Math.round((direct / (1 - BOOKING_DEMO_DIRECT_DISCOUNT)) * 100) / 100;
  return {
    direct,
    reference,
    savings: Math.round((reference - direct) * 100) / 100,
  };
}
