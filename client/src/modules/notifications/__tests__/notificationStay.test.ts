import { describe, it, expect } from 'vitest';
import { reservationIdOf } from '../NotificationStayPanel';
import type { Notification } from '../../../services/api';

/** Notification minimale : seules les metadonnees decident du panneau. */
function notif(metadata: Record<string, unknown>): Notification {
  return {
    id: 1,
    title: 'peu importe',
    message: 'peu importe',
    type: 'warning',
    category: 'system',
    read: false,
    createdAt: '2026-09-10T10:00:00Z',
    metadata,
  } as Notification;
}

describe('reservationIdOf — quelle carte ouvre le dossier du sejour', () => {
  it('whenTheCardIsANoShow_thenTheStayIsResolved', () => {
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK', reservationId: 498 }))).toBe(498);
  });

  it('whenTheIdentifierArrivesAsAString_thenItIsStillResolved', () => {
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK', reservationId: '498' }))).toBe(498);
  });

  it('whenAnotherGestureCarriesAReservation_thenNoStayPanelIsOffered', () => {
    // Le panneau propose « Annuler la reservation » : une carte de facturation
    // portant le meme fait ne doit pas se voir offrir ce geste.
    expect(reservationIdOf(notif({ actionType: 'INVOICE_ISSUE', reservationId: 498 }))).toBeNull();
  });

  it('whenTheCardCarriesNoReservation_thenNothingIsInvented', () => {
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK' }))).toBeNull();
    expect(reservationIdOf(notif({ actionType: 'NOSHOW_MARK', reservationId: 'abc' }))).toBeNull();
    expect(reservationIdOf(notif({}))).toBeNull();
  });
});
