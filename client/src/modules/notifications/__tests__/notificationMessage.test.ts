import { describe, it, expect } from 'vitest';
import { guestMessageOf } from '../NotificationMessagePanel';
import type { Notification } from '../../../services/api';

/** Notification minimale : seuls la cle et les faits decident du panneau. */
function notif(
  notificationKey: string | undefined,
  metadata: Record<string, unknown> = {},
): Notification {
  return {
    id: 1,
    title: 'peu importe',
    message: 'peu importe',
    type: 'info',
    category: 'GUEST_MESSAGING',
    read: false,
    createdAt: '2026-09-11T10:00:00Z',
    notificationKey,
    metadata,
  } as Notification;
}

describe('guestMessageOf — quand la fiche parle du MESSAGE et non du sejour', () => {
  it('whenTheEventIsAGuestMessage_thenItsEnvelopeIsRead', () => {
    const subject = guestMessageOf(notif('GUEST_MESSAGE_SENT', {
      reservationId: 439,
      template: 'Information Check-in',
      channel: 'EMAIL',
      guest: 'Clara Benali',
      guestAvatarUrl: '/api/guests/76/photo?ticket=t',
    }));

    expect(subject).toEqual({
      reservationId: 439,
      template: 'Information Check-in',
      channel: 'EMAIL',
      guestName: 'Clara Benali',
      guestAvatarUrl: '/api/guests/76/photo?ticket=t',
      error: null,
      failed: false,
    });
  });

  it('whenTheSendFailed_thenTheReasonTravelsWithIt', () => {
    const subject = guestMessageOf(notif('GUEST_MESSAGE_FAILED', {
      template: 'Information Check-in',
      channel: 'EMAIL',
      error: 'Adresse inconnue',
    }));

    expect(subject?.failed).toBe(true);
    expect(subject?.error).toBe('Adresse inconnue');
    // Sans sejour, le journal d'envoi reste introuvable : le panneau se rabat
    // alors sur les seuls faits, il ne doit pas pretendre le chercher.
    expect(subject?.reservationId).toBeNull();
  });

  it('whenTheEventIsAboutTheStayItself_thenTheMessagePanelStaysOut', () => {
    // Une annulation porte les MEMES faits (sejour, voyageur, logement) : c'est
    // la cle de l'evenement qui distingue « on a ecrit » de « le sejour a bouge ».
    expect(guestMessageOf(notif('RESERVATION_CANCELLED', { reservationId: 439 }))).toBeNull();
    expect(guestMessageOf(notif(undefined, { reservationId: 439 }))).toBeNull();
  });

  it('whenAFactIsBlank_thenItIsAbsentRatherThanEmpty', () => {
    const subject = guestMessageOf(notif('GUEST_MESSAGE_SENT', {
      template: '   ',
      channel: 'EMAIL',
      guest: '',
    }));

    expect(subject?.template).toBeNull();
    expect(subject?.guestName).toBeNull();
  });
});
