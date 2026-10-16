import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';

export interface ConflictPair { eventA: PlanningEvent; eventB: PlanningEvent }
export interface BaitlyPlanningValidation {
  valid: boolean;
  error: string | null;
  reason?: 'reservation' | 'blocked' | 'intervention' | 'turnaround' | 'invalidRange';
}
interface PlanningRange { startDate: string; endDate: string; startTime?: string; endTime?: string }

/** Intervalles civils semi-ouverts : la fin exacte libère le créneau suivant. */
function bounds(range: PlanningRange, fullDay = false): [string, string] {
  const time = (value: string) => value.length === 5 ? `${value}:00` : value;
  return [
    `${range.startDate} ${time(range.startTime || '00:00')}`,
    `${range.endDate} ${time(range.endTime || (fullDay && range.startDate === range.endDate ? '23:59:59' : '00:00'))}`,
  ];
}
export function baitlyRangesOverlap(a: PlanningRange, b: PlanningRange, aFullDay = false, bFullDay = false): boolean {
  const [aStart, aEnd] = bounds(a, aFullDay);
  const [bStart, bEnd] = bounds(b, bFullDay);
  return aStart < bEnd && bStart < aEnd;
}

/** Regroupement puis balayage par début : seuls les séjours encore actifs sont comparés. */
export function detectConflicts(events: PlanningEvent[]): ConflictPair[] {
  type IndexedStay = { event: PlanningEvent; start: string; end: string };
  const properties = new Map<number, IndexedStay[]>();
  for (const event of events) {
    if (event.type !== 'reservation' || event.status === 'cancelled') continue;
    const group = properties.get(event.propertyId) ?? [];
    const [start, end] = bounds(event);
    if (start >= end) continue;
    group.push({ event, start, end });
    properties.set(event.propertyId, group);
  }
  const conflicts: ConflictPair[] = [];
  for (const group of properties.values()) {
    group.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    let active: IndexedStay[] = [];
    for (const stay of group) {
      active = active.filter((other) => other.end > stay.start);
      for (const other of active) {
        conflicts.push({ eventA: other.event, eventB: stay.event });
      }
      active.push(stay);
    }
  }
  return conflicts;
}
export function isEventInConflict(eventId: string, conflicts: ConflictPair[]): boolean {
  return conflicts.some(({ eventA, eventB }) => eventA.id === eventId || eventB.id === eventId);
}

/** IDs seuls en O(n log n), même si toutes les réservations se superposent. */
export function detectBaitlyConflictEventIds(events: PlanningEvent[]): Set<string> {
  const properties = new Map<number, { id: string; start: string; end: string }[]>();
  for (const event of events) {
    if (event.type !== 'reservation' || event.status === 'cancelled') continue;
    const [start, end] = bounds(event);
    if (start >= end) continue;
    const stays = properties.get(event.propertyId) ?? [];
    stays.push({ id: event.id, start, end });
    properties.set(event.propertyId, stays);
  }
  const ids = new Set<string>();
  for (const stays of properties.values()) {
    stays.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    let furthest: (typeof stays)[number] | undefined;
    for (const stay of stays) {
      if (furthest && furthest.end > stay.start) {
        ids.add(furthest.id);
        ids.add(stay.id);
      }
      if (!furthest || stay.end > furthest.end) furthest = stay;
    }
  }
  return ids;
}

/** Même décision pour création, déplacement et édition dans le panneau Baitly. */
export function validatePlanningEvent(
  event: PlanningEvent, allEvents: PlanningEvent[], interventions: PlanningIntervention[] = [],
): BaitlyPlanningValidation {
  const [start, end] = bounds(event, event.type !== 'reservation');
  if (start >= end) return { valid: false, reason: 'invalidRange', error: 'La fin doit être postérieure au début.' };
  const isReservation = event.type === 'reservation';
  for (const other of allEvents) {
    if (other.id === event.id || other.propertyId !== event.propertyId || other.status === 'cancelled') continue;
    // Une réservation peut contenir une prestation planifiée pendant le séjour.
    if (isReservation && other.type !== 'reservation' && other.type !== 'blocked') continue;
    if (!baitlyRangesOverlap(event, other, !isReservation, other.type !== 'reservation')) continue;
    const reason = other.type === 'blocked' ? 'blocked' : other.type === 'reservation' ? 'reservation' : 'intervention';
    return { valid: false, reason, error: `Conflit avec ${reason === 'blocked' ? 'la période bloquée' : reason === 'reservation' ? 'la reservation' : 'l’intervention'} de ${other.label} (${other.startDate} - ${other.endDate})` };
  }
  if (!isReservation) {
    for (const other of interventions) {
      if (`int-${other.id}` === event.id || other.propertyId !== event.propertyId || other.status === 'cancelled') continue;
      if (baitlyRangesOverlap(event, other, true, true)) {
        return { valid: false, reason: 'intervention', error: `Conflit avec l’intervention "${other.title}" (${other.startDate} - ${other.endDate})` };
      }
    }
  } else {
    const reservationId = event.reservation?.id ?? Number(event.id.replace('res-', ''));
    const nextReservation = allEvents.filter((other) => other.id !== event.id && other.propertyId === event.propertyId
      && other.type === 'reservation' && other.status !== 'cancelled' && bounds(other)[0] >= end)
      .sort((a, b) => bounds(a)[0].localeCompare(bounds(b)[0]))[0];
    if (nextReservation) {
      for (const linked of interventions) {
        if (linked.linkedReservationId !== reservationId || linked.status === 'cancelled') continue;
        // Durée civile : pas d'erreur d'une heure lors des changements de fuseau.
        const duration = Math.max(linked.estimatedDurationHours || 0,
          (Date.parse(`${linked.endDate}T${linked.endTime || '00:00'}Z`) - Date.parse(`${linked.startDate}T${linked.startTime || '00:00'}Z`)) / 3_600_000);
        const checkout = Date.parse(`${event.endDate}T${event.endTime || '00:00'}Z`);
        const interventionEnd = checkout + duration * 3_600_000;
        const nextStart = Date.parse(`${nextReservation.startDate}T${nextReservation.startTime || '00:00'}Z`);
        if (interventionEnd > nextStart) {
          return { valid: false, reason: 'turnaround', error: `L'intervention "${linked.title}" ne tiendra pas avant le check-in de ${nextReservation.label} (${nextReservation.startDate}). Temps insuffisant pour l'intervention.` };
        }
      }
    }
  }
  return { valid: true, error: null };
}
export function wouldConflict(event: PlanningEvent, allEvents: PlanningEvent[], interventions: PlanningIntervention[] = []): boolean {
  return !validatePlanningEvent(event, allEvents, interventions).valid;
}
export function validateReservationUpdate(
  reservationId: number, propertyId: number, startDate: string, endDate: string,
  startTime: string | undefined, endTime: string | undefined,
  allEvents: PlanningEvent[], interventions: PlanningIntervention[],
): BaitlyPlanningValidation {
  return validatePlanningEvent({ id: `res-${reservationId}`, propertyId, type: 'reservation', startDate, endDate,
    startTime, endTime, label: '', status: 'confirmed', color: '' }, allEvents, interventions);
}
export function validateInterventionUpdate(
  interventionId: number, propertyId: number, startDate: string, endDate: string,
  startTime: string | undefined, endTime: string | undefined,
  allEvents: PlanningEvent[], interventions: PlanningIntervention[],
): BaitlyPlanningValidation {
  return validatePlanningEvent({ id: `int-${interventionId}`, propertyId, type: 'cleaning', startDate, endDate,
    startTime, endTime, label: '', status: 'scheduled', color: '' }, allEvents, interventions);
}
