import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { BAITLY_BOOKING_MESSAGES } from './messages/baitlyBooking';
import { BAITLY_BOOKING_UPSELL_MESSAGES } from './messages/baitlyBookingUpsells';
import { BOOKING_STOREFRONT_COPY } from './messages/baitlyBookingStorefront';
import type { SiteLanguage } from './siteLanguage';
import balloon from '../assets/photos/balloon.jpg';
import desert from '../assets/photos/excursion.jpg';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  bookingLate: bedroom,
  bookingCleaning: cleaning,
  bookingChef: chef,
} = SITE_PHOTOS;

export interface BookingDemoExtra {
  id: string;
  title: string;
  detail: string;
  price: number;
  photo?: string;
}

/** Guest-facing catalogue for the fictional stays; no booking API is involved. */
export function getBookingDemoExtras(
  index: number,
  language: SiteLanguage,
): BookingDemoExtra[] {
  const template = BAITLY_BOOKING_TEMPLATES[index];
  const m = BAITLY_BOOKING_MESSAGES[language];
  const s = BOOKING_STOREFRONT_COPY[language];
  const u = BAITLY_BOOKING_UPSELL_MESSAGES[language];
  const featured = template.prices.map((price, i) => ({
    id: `${template.id}-${i}`,
    title: m.templates[index].extras[i],
    detail: s.templates[index].extras[i],
    price,
    photo:
      (template.id === 'riad' && i === 1) ||
      (template.id === 'collection' && i === 0)
        ? undefined
        : template.id === 'villa' && i === 0
          ? chef
          : template.extras[i],
  }));
  return [
    ...featured,
    template.id === 'villa'
      ? {
          id: 'airport',
          title: m.templates[0].extras[1],
          detail: s.templates[0].extras[1],
          price: 28,
        }
      : {
          id: 'late',
          title: m.templates[1].extras[1],
          detail: u.offers.late.detail,
          price: 45,
          photo: bedroom,
        },
    { id: 'cleaning', ...u.offers.cleaning, price: 60, photo: cleaning },
    { id: 'balloon', ...u.offers.balloon, price: 120, photo: balloon },
    { id: 'desert', ...u.offers.desert, price: 65, photo: desert },
  ];
}

export function getBookingDemoExtraTotal(
  offers: BookingDemoExtra[],
  selected: boolean[],
) {
  return offers.reduce(
    (sum, offer, index) => sum + (selected[index] ? offer.price : 0),
    0,
  );
}
