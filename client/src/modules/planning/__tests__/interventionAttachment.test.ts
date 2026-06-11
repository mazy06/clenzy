import { describe, it, expect } from 'vitest';
import {
  resolveAttachedReservationId,
  type AttachmentCandidate,
} from '../utils/interventionAttachment';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const gerard: AttachmentCandidate = {
  id: 42,
  propertyId: 1,
  checkIn: '2026-03-11',
  checkOut: '2026-03-15', // checkout 11h — 4 nuits
  status: 'confirmed',
};

const nextGuest: AttachmentCandidate = {
  id: 43,
  propertyId: 1,
  checkIn: '2026-03-15', // back-to-back : arrive le jour du checkout de Gérard
  checkOut: '2026-03-20',
  status: 'confirmed',
};

describe('resolveAttachedReservationId', () => {
  describe('lien explicite (linkedReservationId)', () => {
    it('rattache via linkedReservationId quand la réservation est chargée', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-15', linkedReservationId: 42 },
        [gerard, nextGuest],
      );
      expect(id).toBe(42);
    });

    it('linkedReservationId inconnu → repli sur l’heuristique', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-15', linkedReservationId: 999 },
        [gerard],
      );
      expect(id).toBe(42);
    });
  });

  describe('heuristique jour de checkout (bug ménage post-départ)', () => {
    it('ménage SANS linkedReservationId le jour du checkout → réservation qui se termine ce jour-là', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-15' },
        [gerard],
      );
      expect(id).toBe(42);
    });

    it('plusieurs candidates (back-to-back) → priorité au checkout == jour de l’intervention', () => {
      // Le 15 : Gérard part (checkout) ET le suivant arrive (check-in).
      // Le ménage « après départ » appartient à la réservation qui SE TERMINE.
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-15' },
        [nextGuest, gerard],
      );
      expect(id).toBe(42);
    });

    it('date en cours de séjour (pas un checkout) → réservation qui couvre la date', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-17' },
        [gerard, nextGuest],
      );
      expect(id).toBe(43);
    });

    it('réservation annulée exclue des candidates', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-15' },
        [{ ...gerard, status: 'cancelled' }],
      );
      expect(id).toBeNull();
    });

    it('autre propriété → pas de rattachement', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 2, startDate: '2026-03-15' },
        [gerard],
      );
      expect(id).toBeNull();
    });

    it('date hors de tout séjour → orpheline (null)', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-25' },
        [gerard, nextGuest],
      );
      expect(id).toBeNull();
    });
  });
});
