import { describe, expect, it } from 'vitest';
import type { Reservation } from '../../../services/api';
import type { PlanningEvent } from '../types';
import { selectBaitlyHydratedEvents } from '../utils/baitlyHydratedEvents';

const reservation = {
  id: 1, propertyId: 1, checkIn: '2026-10-10', checkOut: '2026-10-12', status: 'confirmed',
} as Reservation;
const stay = {
  id: 'res-1', type: 'reservation', propertyId: 1, startDate: reservation.checkIn,
  endDate: reservation.checkOut, reservation,
} as PlanningEvent;
const linked = {
  id: 'int-1', type: 'cleaning', propertyId: 1, startDate: '2026-10-12', endDate: '2026-10-12',
  intervention: { linkedReservationId: 1 },
} as PlanningEvent;
const independent = {
  id: 'int-2', type: 'maintenance', propertyId: 2, startDate: '2026-10-11', endDate: '2026-10-11',
} as PlanningEvent;
const window = { propertyIds: [1, 2], from: '2026-09-26', to: '2026-11-24' };
const events = [stay, linked, independent];

describe('publication synchronisée des briques Baitly', () => {
  it('ne publie aucune intervention pendant le chargement des fiches', () => {
    expect(selectBaitlyHydratedEvents(events, events, [reservation], [], [])).toEqual([]);
  });

  it('publie le séjour et les interventions liées et libres ensemble', () => {
    expect(selectBaitlyHydratedEvents(events, events, [reservation], [reservation], [window])).toEqual(events);
  });

  it('attend la fiche hôte aussi pour les rattachements heuristiques et les demandes à payer', () => {
    const heuristic = { ...linked, intervention: undefined };
    const request = { ...linked, id: 'sr-1', intervention: undefined, serviceRequest: { reservationId: 1 } } as PlanningEvent;
    expect(selectBaitlyHydratedEvents([heuristic, request], [heuristic, request], [reservation], [], [window])).toEqual([]);
    expect(selectBaitlyHydratedEvents([heuristic, request], [heuristic, request], [reservation], [reservation], [window])).toEqual([heuristic, request]);
  });

  it('autorise les prestations libres après une réponse sans réservation', () => {
    expect(selectBaitlyHydratedEvents([independent], [independent], [], [], [window])).toEqual([independent]);
  });

  it('ne confond pas les périodes voisines ou les logements des autres pages', () => {
    const next = { ...independent, id: 'int-3', startDate: '2026-12-01', endDate: '2026-12-01' };
    expect(selectBaitlyHydratedEvents([independent, next], [independent, next], [], [], [window])).toEqual([independent]);
    expect(selectBaitlyHydratedEvents([independent], [independent], [], [], [{ ...window, propertyIds: [1] }])).toEqual([]);
  });

  it('respecte les filtres et conserve les plages bloquées pendant le chargement', () => {
    const blocked = { ...independent, id: 'block-1', type: 'blocked' } as PlanningEvent;
    expect(selectBaitlyHydratedEvents([...events, blocked], [linked, blocked], [reservation], [], [])).toEqual([blocked]);
    expect(selectBaitlyHydratedEvents(events, [linked], [reservation], [reservation], [window])).toEqual([linked]);
  });
});
