import { describe, expect, it } from 'vitest';
import { guestServiceSlot } from './baitlyGuestServiceSlot';

describe('Créneau Baitly dans le fuseau du logement', () => {
  it('conserve l’heure locale fournie par le serveur et calcule la fin prévue', () => {
    expect(guestServiceSlot('2026-10-19T03:48:00', 1.5, 'fr')).toEqual({
      date: 'lundi 19 octobre 2026', time: '03:48', end: '05:18', duration: '1,5 h',
    });
  });
  it('affiche la nouvelle date quand un créneau dépasse minuit', () => {
    expect(guestServiceSlot('2026-10-19T23:30', 2, 'en')).toMatchObject({
      end: 'Tuesday, 20 October 2026 · 01:30',
    });
  });
  it('ne fabrique pas une heure de fin quand la durée est inconnue', () => {
    expect(guestServiceSlot('2026-10-19T03:48', null, 'fr')).toMatchObject({ end: null, duration: null });
  });
  it.each([null, '2026-02-30T12:00', '2026-10-19T25:00', '2026-10-19T12:60', 'invalid'])('ignore une date invalide %s', start => {
    expect(guestServiceSlot(start, 1, 'fr')).toBeNull();
  });
});
