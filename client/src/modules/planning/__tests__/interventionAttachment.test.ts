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

    it('date avant tout séjour → orpheline (null)', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-05' },
        [gerard, nextGuest],
      );
      expect(id).toBeNull();
    });
  });

  describe('fenêtre de vacance post-checkout (ménage à checkout+N)', () => {
    it('checkout+2 sans séjour suivant → réservation qui vient de se terminer', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-17' },
        [gerard],
      );
      expect(id).toBe(42);
    });

    it('checkout+5 sans séjour suivant → réservation qui vient de se terminer', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-20' },
        [gerard],
      );
      expect(id).toBe(42);
    });

    it('borne : la veille du check-in suivant → encore rattachée à la sortante', () => {
      // Gérard part le 15, le séjour suivant commence le 19 → le 18 est
      // encore dans la vacance de Gérard.
      const later: AttachmentCandidate = {
        id: 44,
        propertyId: 1,
        checkIn: '2026-03-19',
        checkOut: '2026-03-24',
        status: 'confirmed',
      };
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-18' },
        [gerard, later],
      );
      expect(id).toBe(42);
    });

    it('borne : le jour du check-in suivant → rattachée au séjour suivant (cas 2), pas à la sortante', () => {
      const later: AttachmentCandidate = {
        id: 44,
        propertyId: 1,
        checkIn: '2026-03-19',
        checkOut: '2026-03-24',
        status: 'confirmed',
      };
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-19' },
        [gerard, later],
      );
      expect(id).toBe(44);
    });

    it('plusieurs séjours terminés → la plus récemment terminée gagne', () => {
      // Gérard (checkout 15) puis nextGuest (checkout 20) → le 22 appartient
      // à la vacance de nextGuest.
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-22' },
        [gerard, nextGuest],
      );
      expect(id).toBe(43);
    });

    it('réservation annulée exclue de la fenêtre de vacance', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 1, startDate: '2026-03-17' },
        [{ ...gerard, status: 'cancelled' }],
      );
      expect(id).toBeNull();
    });

    it('propriété sans aucun séjour chargé → orpheline (null)', () => {
      const id = resolveAttachedReservationId(
        { propertyId: 7, startDate: '2026-03-17' },
        [gerard, nextGuest],
      );
      expect(id).toBeNull();
    });
  });
});
