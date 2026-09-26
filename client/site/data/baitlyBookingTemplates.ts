import riad from '../assets/photos/guesthouse.jpg';
import terrace from '../assets/photos/terrace.jpg';
import { SITE_PHOTOS } from './baitlyPhotography';

const { bookingPatioRoom: bedroom, bookingDinner: food } = SITE_PHOTOS;

/** Illustrative storefronts, independent from the customer's template catalogue. */
export const BAITLY_BOOKING_TEMPLATES = [
  {
    id: 'riad',
    name: 'Maison Zayna',
    photo: riad,
    detail: bedroom,
    base: 360,
    prices: [36, 28],
    extras: [food, undefined],
  },
  {
    id: 'villa',
    name: 'Villa Naya',
    photo: SITE_PHOTOS.bookingVillaDetail,
    detail: SITE_PHOTOS.bookingVillaDetail,
    base: 720,
    prices: [85, 45],
    extras: [SITE_PHOTOS.bookingChef, SITE_PHOTOS.bookingLate],
  },
  {
    id: 'collection',
    name: 'Les échappées',
    photo: terrace,
    detail: riad,
    base: 540,
    prices: [40, 55],
    extras: [undefined, SITE_PHOTOS.bookingBreakfast],
  },
] as const;

export type BookingTemplate = (typeof BAITLY_BOOKING_TEMPLATES)[number];

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
