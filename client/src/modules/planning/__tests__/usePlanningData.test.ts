import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPlanningSettled,
  computeEffectiveStatus,
  reservationToEvent,
  interventionToEvent,
  serviceRequestToEvent,
  groupBlockedDays,
  dedup,
  isPriorityWaveLoading,
} from '../hooks/usePlanningData';
import type { Reservation, PlanningIntervention, PlanningServiceRequest } from '../../../services/api';
import type { CalendarBlockedDay } from '../../../services/api/calendarPricingApi';

/**
 * Transformations donnee -> evenement du planning.
 *
 * <p>Ces fonctions sont importees du module. La version precedente de ce
 * fichier les REIMPLEMENTAIT localement — elle validait donc une copie, libre
 * de deriver de l'original sans que rien ne le signale. Un statut effectif
 * calcule autrement, une pastille de paiement dont la regle change : le test
 * restait vert. Il ne prouvait rien.</p>
 */

const TODAY = new Date(2026, 8, 15); // 15 septembre 2026

function reservation(over: Partial<Reservation> = {}): Reservation {
  return {
    id: 1,
    propertyId: 10,
    propertyName: 'Villa Test',
    guestName: 'Gérard Mazy',
    guestCount: 2,
    checkIn: '2026-09-20',
    checkOut: '2026-09-25',
    status: 'confirmed',
    source: 'airbnb',
    totalPrice: 500,
    ...over,
  } as Reservation;
}

function intervention(over: Partial<PlanningIntervention> = {}): PlanningIntervention {
  return {
    id: 100,
    propertyId: 10,
    propertyName: 'Villa Test',
    type: 'cleaning',
    title: 'Ménage',
    startDate: '2026-09-25',
    endDate: '2026-09-25',
    status: 'scheduled',
    ...over,
  } as PlanningIntervention;
}

describe('transformations du planning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });
  afterEach(() => vi.useRealTimers());

  // ── Statut effectif ───────────────────────────────────────────────────────
  //
  // Le statut AFFICHE n'est pas le statut stocke : il se deduit des dates et du
  // paiement. C'est exactement la logique que l'ancien test ne voyait pas.

  describe('computeEffectiveStatus', () => {
    it('une reservation annulee le reste, quelles que soient les dates', () => {
      expect(computeEffectiveStatus(reservation({ status: 'cancelled' }))).toBe('cancelled');
    });

    it('un sejour termine passe en checked_out', () => {
      expect(computeEffectiveStatus(
        reservation({ checkIn: '2026-09-01', checkOut: '2026-09-10' }),
      )).toBe('checked_out');
    });

    it('un sejour en cours passe en checked_in', () => {
      expect(computeEffectiveStatus(
        reservation({ checkIn: '2026-09-10', checkOut: '2026-09-20' }),
      )).toBe('checked_in');
    });

    it('le jour du checkout compte encore comme sejour en cours', () => {
      expect(computeEffectiveStatus(
        reservation({ checkIn: '2026-09-10', checkOut: '2026-09-15' }),
      )).toBe('checked_in');
    });

    it('un sejour a venir paye est confirme', () => {
      expect(computeEffectiveStatus(reservation({ paymentStatus: 'PAID' }))).toBe('confirmed');
    });

    it('un sejour a venir non paye reste en attente', () => {
      expect(computeEffectiveStatus(reservation({ paymentStatus: 'PENDING' }))).toBe('pending');
    });
  });

  // ── Reservation -> evenement ──────────────────────────────────────────────

  describe('reservationToEvent', () => {
    it('porte l\'identifiant prefixe et les dates du sejour', () => {
      const e = reservationToEvent(reservation());
      expect(e.id).toBe('res-1');
      expect(e.type).toBe('reservation');
      expect(e.startDate).toBe('2026-09-20');
      expect(e.endDate).toBe('2026-09-25');
      expect(e.label).toBe('Gérard Mazy');
    });

    it('les heures de la reservation priment sur celles du logement', () => {
      const e = reservationToEvent(
        reservation({ checkInTime: '18:00', checkOutTime: '09:00' }),
        { defaultCheckInTime: '15:00', defaultCheckOutTime: '11:00' },
      );
      expect(e.startTime).toBe('18:00');
      expect(e.endTime).toBe('09:00');
    });

    it('a defaut, les heures du logement', () => {
      const e = reservationToEvent(reservation(), {
        defaultCheckInTime: '16:00', defaultCheckOutTime: '10:00',
      });
      expect(e.startTime).toBe('16:00');
      expect(e.endTime).toBe('10:00');
    });

    it('a defaut de tout, 15h / 11h', () => {
      const e = reservationToEvent(reservation());
      expect(e.startTime).toBe('15:00');
      expect(e.endTime).toBe('11:00');
    });

    it('le canal est affiche en sous-titre, sauf « other »', () => {
      expect(reservationToEvent(reservation({ source: 'airbnb' })).sublabel).toBeTruthy();
      expect(reservationToEvent(reservation({ source: 'other' })).sublabel).toBeUndefined();
    });

    // ── Pastille de paiement : la regle metier la plus fragile ──────────────

    it('un sejour a venir impaye porte la pastille de paiement', () => {
      const e = reservationToEvent(reservation({ paymentStatus: 'PENDING', totalPrice: 500 }));
      expect(e.needsPaymentBadge).toBe(true);
      expect(e.paymentBadgeStatus).toBe('PENDING');
    });

    it('un sejour paye n\'en porte pas', () => {
      expect(reservationToEvent(reservation({ paymentStatus: 'PAID' })).needsPaymentBadge).toBe(false);
    });

    it('un sejour annule n\'en porte pas, meme impaye', () => {
      const e = reservationToEvent(reservation({ status: 'cancelled', paymentStatus: 'PENDING' }));
      expect(e.needsPaymentBadge).toBe(false);
    });

    it('un sejour termine n\'en porte pas', () => {
      const e = reservationToEvent(reservation({
        checkIn: '2026-09-01', checkOut: '2026-09-10', paymentStatus: 'PENDING',
      }));
      expect(e.needsPaymentBadge).toBe(false);
    });

    it('un sejour sans montant n\'en porte pas', () => {
      const e = reservationToEvent(reservation({ paymentStatus: 'PENDING', totalPrice: 0 }));
      expect(e.needsPaymentBadge).toBe(false);
    });
  });

  // ── Intervention -> evenement ─────────────────────────────────────────────

  describe('interventionToEvent', () => {
    it('un menage devient un evenement de type cleaning', () => {
      const e = interventionToEvent(intervention());
      expect(e.id).toBe('int-100');
      expect(e.type).toBe('cleaning');
    });

    it('une maintenance devient un evenement de type maintenance', () => {
      expect(interventionToEvent(intervention({ type: 'maintenance' })).type).toBe('maintenance');
    });

    it('l\'heure de fin fournie est respectee', () => {
      const e = interventionToEvent(intervention({ startTime: '09:00', endTime: '10:30' }));
      expect(e.endTime).toBe('10:30');
    });

    it('sinon elle se deduit de la duree estimee', () => {
      const e = interventionToEvent(intervention({ startTime: '09:00', estimatedDurationHours: 3 }));
      expect(e.endTime).toBe('12:00');
    });

    it('elle ne depasse jamais 23h', () => {
      const e = interventionToEvent(intervention({ startTime: '22:00', estimatedDurationHours: 5 }));
      expect(e.endTime).toBe('23:00');
    });

    it('sans duree, un menage dure 3h et une maintenance 2h', () => {
      expect(interventionToEvent(intervention({ startTime: '09:00' })).endTime).toBe('12:00');
      expect(interventionToEvent(
        intervention({ type: 'maintenance', startTime: '09:00' }),
      ).endTime).toBe('11:00');
    });

    it('une intervention avec un cout impaye porte la pastille de paiement', () => {
      const e = interventionToEvent(intervention({ estimatedCost: 60, paymentStatus: 'PENDING' }));
      expect(e.needsPaymentBadge).toBe(true);
    });

    it('payee ou sans cout, aucune pastille', () => {
      expect(interventionToEvent(
        intervention({ estimatedCost: 60, paymentStatus: 'PAID' }),
      ).needsPaymentBadge).toBe(false);
      expect(interventionToEvent(intervention({ estimatedCost: 0 })).needsPaymentBadge).toBe(false);
    });
  });

  // ── Demande de service en attente de paiement ─────────────────────────────

  describe('serviceRequestToEvent', () => {
    const sr = (over: Partial<PlanningServiceRequest> = {}): PlanningServiceRequest => ({
      id: 200,
      propertyId: 10,
      propertyName: 'Villa Test',
      serviceType: 'CLEANING',
      title: 'Ménage à payer',
      startDate: '2026-09-26',
      status: 'AWAITING_PAYMENT',
      ...over,
    } as PlanningServiceRequest);

    it('un service de nettoyage devient un evenement cleaning, toujours a payer', () => {
      const e = serviceRequestToEvent(sr());
      expect(e.id).toBe('sr-200');
      expect(e.type).toBe('cleaning');
      expect(e.isAwaitingPayment).toBe(true);
      expect(e.needsPaymentBadge).toBe(true);
    });

    it('un service hors nettoyage devient une maintenance', () => {
      expect(serviceRequestToEvent(sr({ serviceType: 'PLUMBING' })).type).toBe('maintenance');
    });

    it('la demande tient sur un seul jour', () => {
      const e = serviceRequestToEvent(sr());
      expect(e.startDate).toBe(e.endDate);
    });
  });

  // ── Jours bloques -> plages ───────────────────────────────────────────────

  describe('groupBlockedDays', () => {
    const day = (date: string, over: Partial<CalendarBlockedDay> = {}): CalendarBlockedDay => ({
      propertyId: 10, date, status: 'BLOCKED', source: 'MANUAL', notes: null, ...over,
    });

    it('regroupe des jours contigus en une seule plage', () => {
      const r = groupBlockedDays([day('2026-09-01'), day('2026-09-02'), day('2026-09-03')]);
      expect(r).toHaveLength(1);
      expect(r[0].startDate).toBe('2026-09-01');
      expect(r[0].endDate).toBe('2026-09-03');
    });

    it('coupe la plage sur un trou de dates', () => {
      const r = groupBlockedDays([day('2026-09-01'), day('2026-09-03')]);
      expect(r).toHaveLength(2);
    });

    it('ne melange pas deux logements ni deux statuts', () => {
      expect(groupBlockedDays([
        day('2026-09-01'), day('2026-09-02', { propertyId: 11 }),
      ])).toHaveLength(2);
      expect(groupBlockedDays([
        day('2026-09-01'), day('2026-09-02', { status: 'MAINTENANCE' }),
      ])).toHaveLength(2);
    });

    it('aucun jour, aucune plage', () => {
      expect(groupBlockedDays([])).toHaveLength(0);
    });
  });

  // ── Dedup ─────────────────────────────────────────────────────────────────

  describe('dedup', () => {
    it('elimine les doublons d\'identifiant entre les tranches', () => {
      const r = dedup([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]]);
      expect(r.map((x) => x.id)).toEqual([1, 2, 3]);
    });

    it('le premier arrive gagne — les tranches se recouvrent sur leurs bords', () => {
      const r = dedup([[{ id: 1, v: 'a' }], [{ id: 1, v: 'b' }]]);
      expect(r).toHaveLength(1);
      expect((r[0] as { v: string }).v).toBe('a');
    });

    it('supporte les tableaux vides', () => {
      expect(dedup([])).toEqual([]);
      expect(dedup([[], []])).toEqual([]);
    });
  });
});

describe('isPlanningSettled — quand ce qui se DEDUIT des sejours est complet', () => {
  const settled = {
    propertiesLoading: false,
    chunksLoading: false,
    propertyCount: 4,
    hasAnyData: true,
  };

  it('whenEveryChunkHasLanded_thenItIsSettled', () => {
    expect(isPlanningSettled(settled)).toBe(true);
  });

  it('whenAChunkIsStillInFlight_thenItIsNot', () => {
    // C'est le coeur du symptome : la grille est deja peinte (loading est
    // retombe des la premiere tranche) mais les canaux presents grandissent
    // encore a chaque tranche qui arrive.
    expect(isPlanningSettled({ ...settled, chunksLoading: true })).toBe(false);
  });

  it('whenThePropertiesAreStillLoading_thenItIsNot', () => {
    expect(isPlanningSettled({ ...settled, propertiesLoading: true })).toBe(false);
  });

  it('whenNoStayHasComeBackYet_thenItIsNot', () => {
    // Logements deja en cache (preches au boot) et aucune tranche encore
    // demandee : rien n'est « en vol », et sans cette clause la regle serait
    // vraie avant le premier sejour.
    expect(isPlanningSettled({ ...settled, hasAnyData: false })).toBe(false);
  });

  it('whenThePortfolioIsEmpty_thenItIsSettledWithoutAnyStay', () => {
    // Personne a interroger : attendre des donnees qui ne viendront jamais
    // garderait la rangee de filtres cachee a vie.
    expect(isPlanningSettled({ ...settled, propertyCount: 0, hasAnyData: false })).toBe(true);
  });
});

describe('isPriorityWaveLoading', () => {
  const chunks = [{ from: 'A' }, { from: 'B' }, { from: 'C' }];
  const priority = new Set(['A', 'B']);

  it('est vraie tant qu une tranche PRIORITAIRE charge', () => {
    const results = [{ isLoading: true }, { isLoading: false }, { isLoading: false }];
    expect(isPriorityWaveLoading(results, chunks, priority)).toBe(true);
  });

  it('ignore les tranches de BUFFER encore en vol', () => {
    // Le coeur du correctif : le buffer s active APRES les prioritaires. Le
    // compter faisait attendre la rangee de filtres jusqu au bout du buffer,
    // alors que la fenetre visible etait deja lisible.
    const results = [{ isLoading: false }, { isLoading: false }, { isLoading: true }];
    expect(isPriorityWaveLoading(results, chunks, priority)).toBe(false);
  });

  it('est fausse quand la premiere vague est retombee', () => {
    const results = [{ isLoading: false }, { isLoading: false }, { isLoading: false }];
    expect(isPriorityWaveLoading(results, chunks, priority)).toBe(false);
  });

  it('ne se laisse pas depasser par un resultat sans tranche', () => {
    const results = [{ isLoading: true }, { isLoading: true }, { isLoading: true }, { isLoading: true }];
    expect(isPriorityWaveLoading(results, [], priority)).toBe(false);
  });
});
