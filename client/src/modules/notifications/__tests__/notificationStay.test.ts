import { describe, it, expect } from 'vitest';
import { reservationIdOf, stayActionsApply } from '../NotificationStayPanel';
import type { Notification } from '../../../services/api';

/** Notification minimale : seuls les faits et le lien decident du panneau. */
function notif(
  metadata: Record<string, unknown>,
  extra: { notificationKey?: string; actionUrl?: string } = {},
): Notification {
  return {
    id: 1,
    title: 'peu importe',
    message: 'peu importe',
    type: 'warning',
    category: 'system',
    read: false,
    createdAt: '2026-09-10T10:00:00Z',
    metadata,
    ...extra,
  } as Notification;
}

describe('reservationIdOf — quand la fiche ouvre le dossier du sejour', () => {
  it('whenTheFactsCarryAStay_thenItIsResolvedWhateverTheEvent', () => {
    // Le DOSSIER s'ouvre des qu'un sejour est designe : un message envoye, une
    // arrivee, un no-show parlent tous du meme objet. Ce sont les GESTES qui
    // restent reserves.
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK', reservationId: 498 }))).toBe(498);
    expect(reservationIdOf(notif({ reservationId: 498 }))).toBe(498);
    expect(reservationIdOf(notif({ actionType: 'INVOICE_ISSUE', reservationId: 498 }))).toBe(498);
  });

  it('whenTheIdentifierArrivesAsAString_thenItIsStillResolved', () => {
    expect(reservationIdOf(notif({ reservationId: '498' }))).toBe(498);
  });

  it('whenOnlyTheDeepLinkCarriesIt_thenReservationEventsStillResolve', () => {
    // Les notifications emises avant les faits structures : leur lien surligne
    // le sejour depuis toujours.
    expect(reservationIdOf(notif({}, {
      notificationKey: 'RESERVATION_CANCELLED',
      actionUrl: '/reservations?highlight=25',
    }))).toBe(25);
  });

  it('whenTheDeepLinkBelongsToAnotherFamily_thenItIsNotBorrowed', () => {
    // `highlight` designe une facture ici, pas un sejour.
    expect(reservationIdOf(notif({}, {
      notificationKey: 'PAYMENT_DEFERRED_OVERDUE',
      actionUrl: '/billing?highlight=25',
    }))).toBeNull();
  });

  it('whenNothingCarriesAStay_thenNothingIsInvented', () => {
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK' }))).toBeNull();
    expect(reservationIdOf(notif({ reservationId: 'abc' }))).toBeNull();
    expect(reservationIdOf(notif({}))).toBeNull();
  });
});

describe('stayActionsApply — quels gestes la fiche propose', () => {
  it('whenTheCardIsANoShow_thenItsGesturesApply', () => {
    expect(stayActionsApply(notif({ actionType: 'NOSHOW_MARK', reservationId: 498 }))).toBe(true);
  });

  it('whenTheEventOnlyMentionsAStay_thenNoGestureIsOffered', () => {
    // « Marquer no-show », « Annuler la reservation » n'ont de sens que tant
    // qu'un agent attend une decision.
    expect(stayActionsApply(notif({ reservationId: 498 }))).toBe(false);
    expect(stayActionsApply(notif({ actionType: 'INVOICE_ISSUE', reservationId: 498 }))).toBe(false);
  });
});
