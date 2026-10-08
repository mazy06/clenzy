import type { ReservationStatus } from '../../services/api/reservationsApi';

/**
 * Illustrations générées (public/images) de l'écran Réservations et de sa
 * modale. Elles viennent des séries déjà affichées par le tableau de bord, les
 * finances et les notifications : un même objet désigne la même chose d'un
 * écran à l'autre (le calendrier pour le séjour, la porte pour l'arrivée…).
 */
export const RESERVATION_ART = {
  reservation: '/images/notifications/reservation.webp',
  stay: '/images/hitl/calendar.webp',
  arrival: '/images/notifications/door-access.webp',
  departure: '/images/dashboard-operations/departures.webp',
  guest: '/images/hitl/traveler-form.webp',
  property: '/images/notifications/property.webp',
  payment: '/images/finance-kpis/received.png',
  pricing: '/images/dashboard-kpis/revenue.webp',
  extras: '/images/dashboard-operations/cleanings.webp',
  notes: '/images/hitl/conversation.webp',
  summary: '/images/finance-kpis/documents.png',
} as const;

const STATUS_ART: Record<ReservationStatus, string> = {
  pending: '/images/finance-kpis/pending.png',
  confirmed: RESERVATION_ART.reservation,
  checked_in: RESERVATION_ART.arrival,
  checked_out: RESERVATION_ART.departure,
  cancelled: '/images/notifications/reservation-cancelled.webp',
};

/** L'illustration dit où en est le séjour : sablier, valise, porte ouverte, départ, annulation. */
export function reservationStatusArt(status: ReservationStatus): string {
  return STATUS_ART[status] ?? RESERVATION_ART.reservation;
}
