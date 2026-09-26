import { SITE_PHOTOS } from '../data/baitlyPhotography';
import { BAITLY_BOOKING_TEMPLATES } from '../data/baitlyBookingTemplates';
import { BOOKING_STOREFRONT_COPY } from './messages/baitlyBookingStorefront';
import { BOOKING_STAY_COPY } from './messages/baitlyBookingStay';
import type { SiteLanguage } from './siteLanguage';

export interface BookingDemoDates {
  arrival: string;
  departure: string | null;
}

export const DEFAULT_BOOKING_DATES: BookingDemoDates = {
  arrival: '2026-10-12',
  departure: '2026-10-15',
};
const DAY = 86400000;
export const bookingDate = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const dateISO = (date: Date) => date.toISOString().slice(0, 10);
export const addBookingDays = (iso: string, days: number) =>
  dateISO(new Date(bookingDate(iso).getTime() + days * DAY));
export const bookingNights = ({ arrival, departure }: BookingDemoDates) =>
  departure
    ? Math.max(
        0,
        Math.round(
          (bookingDate(departure).getTime() - bookingDate(arrival).getTime()) /
            DAY,
        ),
      )
    : 0;

// Fictional availability, shared by the calendar and range validation.
export const isBookingDayUnavailable = (iso: string) =>
  [8, 9, 22, 23].includes(bookingDate(iso).getUTCDate());
export function isBookingRangeAvailable(arrival: string, departure: string) {
  if (departure <= arrival) return false;
  for (let day = arrival; day <= departure; day = addBookingDays(day, 1)) {
    if (isBookingDayUnavailable(day)) return false;
  }
  return true;
}

export function formatBookingDate(
  iso: string,
  language: SiteLanguage,
  full = false,
) {
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: full ? 'long' : 'short',
    ...(full ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(bookingDate(iso));
}
export function formatBookingRange(
  dates: BookingDemoDates,
  language: SiteLanguage,
) {
  const c = BOOKING_STAY_COPY[language];
  return `${formatBookingDate(dates.arrival, language)} → ${
    dates.departure
      ? formatBookingDate(dates.departure, language)
      : c.chooseDeparture
  }`;
}
export function formatBookingNights(count: number, language: SiteLanguage) {
  const c = BOOKING_STAY_COPY[language];
  return (count === 1 ? c.oneNight : c.nights).replace(
    '{count}',
    new Intl.NumberFormat(language).format(count),
  );
}

export function getBookingDemoProperties(
  templateIndex: number,
  language: SiteLanguage,
) {
  const templates = BAITLY_BOOKING_TEMPLATES;
  const sites = BOOKING_STOREFRONT_COPY[language].templates;
  const c = BOOKING_STAY_COPY[language];
  const patio = {
    id: 'patio',
    name: sites[0].room,
    detail: sites[0].amenities[0],
    feature: sites[0].amenities[2],
    location: c.marrakech,
    photo: templates[0].detail,
    nightly: 120,
  };
  const villa = {
    id: 'villa',
    name: 'Villa Naya',
    detail: sites[1].amenities[0],
    feature: sites[1].amenities[1],
    location: c.marrakech,
    photo: templates[1].photo,
    nightly: 240,
  };
  if (templateIndex === 0)
    return [
      patio,
      {
        id: 'terrace-suite',
        name: c.terraceSuite,
        detail: c.terraceDetail,
        feature: c.privateTerrace,
        location: c.marrakech,
        photo: SITE_PHOTOS.bookingTerraceRoom,
        nightly: 150,
      },
    ];
  if (templateIndex === 1) return [villa];
  return [
    {
      id: 'agafay',
      name: sites[2].room,
      detail: c.agafayDetail,
      feature: c.desertView,
      location: c.agafay,
      photo: templates[2].photo,
      nightly: 180,
    },
    { ...patio, name: 'Maison Zayna', photo: templates[0].photo },
    villa,
  ];
}
export function getBookingDemoAccommodation(
  templateIndex: number,
  selected: string[],
  dates: BookingDemoDates,
) {
  return getBookingDemoProperties(templateIndex, 'fr')
    .filter((property) => selected.includes(property.id))
    .reduce(
      (sum, property) => sum + property.nightly * bookingNights(dates),
      0,
    );
}
