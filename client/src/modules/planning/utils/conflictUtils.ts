import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';
import { toDate } from './dateUtils';

export interface ConflictPair {
  eventA: PlanningEvent;
  eventB: PlanningEvent;
}

/**
 * Detect overlapping reservations on the same property.
 * Only compares reservation-type events (not interventions).
 */
export function detectConflicts(events: PlanningEvent[]): ConflictPair[] {
  const reservations = events.filter((e) => e.type === 'reservation');
  const conflicts: ConflictPair[] = [];

  for (let i = 0; i < reservations.length; i++) {
    for (let j = i + 1; j < reservations.length; j++) {
      const a = reservations[i];
      const b = reservations[j];

      if (a.propertyId !== b.propertyId) continue;

      const aStart = toDate(a.startDate);
      const aEnd = toDate(a.endDate);
      const bStart = toDate(b.startDate);
      const bEnd = toDate(b.endDate);

      // Overlap: aStart < bEnd AND bStart < aEnd
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ eventA: a, eventB: b });
      }
    }
  }

  return conflicts;
}

/**
 * Check if a specific event is involved in any conflict.
 */
export function isEventInConflict(eventId: string, conflicts: ConflictPair[]): boolean {
  return conflicts.some((c) => c.eventA.id === eventId || c.eventB.id === eventId);
}

/**
 * Check if a modified event would conflict with other reservations
 * on the same property (used during drag to provide real-time feedback).
 *
 * Checks TWO things:
 * 1. Direct reservation-to-reservation overlap
 * 2. If there's a linked intervention (e.g. cleaning), whether it would
 *    overflow into the next reservation's dates/times
 */
export function wouldConflict(
  modifiedEvent: PlanningEvent,
  allEvents: PlanningEvent[],
  interventions?: PlanningIntervention[],
): boolean {
  const others = allEvents.filter(
    (e) =>
      e.id !== modifiedEvent.id &&
      e.propertyId === modifiedEvent.propertyId &&
      e.type === 'reservation',
  );

  // 1. Direct reservation overlap
  const hasDirectOverlap = others.some(
    (e) => modifiedEvent.startDate < e.endDate && modifiedEvent.endDate > e.startDate,
  );
  if (hasDirectOverlap) return true;

  // 2. Check linked intervention fits before next reservation
  if (interventions && interventions.length > 0) {
    const numericId = parseInt(modifiedEvent.id.replace('res-', ''), 10);
    const linkedIntervention = interventions.find(
      (i) => i.linkedReservationId === numericId,
    );

    if (linkedIntervention) {
      // Find the next reservation on this property after the new checkout
      const nextReservation = others
        .filter((e) => e.startDate >= modifiedEvent.endDate)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

      if (nextReservation) {
        // Calculate intervention duration in days
        const interventionDurationDays = Math.ceil(
          (new Date(linkedIntervention.endDate).getTime() -
            new Date(linkedIntervention.startDate).getTime()) /
            86400000,
        );

        // Intervention starts at checkout and lasts N days
        const interventionEndDate = new Date(modifiedEvent.endDate);
        interventionEndDate.setDate(interventionEndDate.getDate() + interventionDurationDays);
        const interventionEndStr = interventionEndDate.toISOString().split('T')[0];

        // Intervention end goes beyond next check-in → conflict
        if (interventionEndStr > nextReservation.startDate) return true;

        // Same-day: check hour-level overlap
        if (interventionEndStr === nextReservation.startDate) {
          const checkOutMinutes = timeToMinutes(modifiedEvent.endTime);
          const interventionMinutes = (linkedIntervention.estimatedDurationHours || 0) * 60;
          const interventionEndMinutes = checkOutMinutes + interventionMinutes;
          const nextCheckInMinutes = timeToMinutes(nextReservation.startTime);

          if (nextCheckInMinutes > 0 && interventionEndMinutes > nextCheckInMinutes) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

// ─── Validation for reservation updates (panel edits) ─────────────────────

interface UpdateValidation {
  valid: boolean;
  error: string | null;
}

/**
 * Combine date + time into a comparable timestamp string.
 * Format: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD" if no time.
 */
function toTimestamp(date: string, time?: string): string {
  return time ? `${date} ${time}` : date;
}

/**
 * Get total minutes from an HH:mm string.
 */
function timeToMinutes(time: string | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Validate that a reservation update doesn't:
 * 1. Overlap with another reservation on the same property
 * 2. Leave insufficient time for linked interventions between reservations
 */
export function validateReservationUpdate(
  reservationId: number,
  propertyId: number,
  newCheckIn: string,
  newCheckOut: string,
  newCheckInTime: string | undefined,
  newCheckOutTime: string | undefined,
  allEvents: PlanningEvent[],
  interventions: PlanningIntervention[],
): UpdateValidation {
  const eventId = `res-${reservationId}`;

  // 1. Check overlap with other reservations on the same property
  const otherReservations = allEvents.filter(
    (e) => e.id !== eventId && e.propertyId === propertyId && e.type === 'reservation',
  );

  const newStart = toTimestamp(newCheckIn, newCheckInTime);
  const newEnd = toTimestamp(newCheckOut, newCheckOutTime);

  for (const other of otherReservations) {
    const otherStart = toTimestamp(other.startDate, other.startTime);
    const otherEnd = toTimestamp(other.endDate, other.endTime);

    // Overlap: newStart < otherEnd AND otherStart < newEnd
    if (newStart < otherEnd && otherStart < newEnd) {
      return {
        valid: false,
        error: `Conflit avec la reservation de ${other.label} (${other.startDate} - ${other.endDate})`,
      };
    }
  }

  // 2. Check that linked intervention fits between this checkout and next check-in
  const linkedIntervention = interventions.find(
    (i) => i.linkedReservationId === reservationId,
  );

  if (linkedIntervention) {
    // Find the next reservation on this property after the new checkout
    const nextReservation = otherReservations
      .filter((e) => e.startDate >= newCheckOut)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

    if (nextReservation) {
      // Compute intervention end: startDate = newCheckOut, duration = estimatedDurationHours
      const interventionDurationDays = Math.ceil(
        (new Date(linkedIntervention.endDate).getTime() - new Date(linkedIntervention.startDate).getTime()) /
        (1000 * 60 * 60 * 24),
      );

      // Intervention would start at checkout and last N days
      const interventionEndDate = new Date(newCheckOut);
      interventionEndDate.setDate(interventionEndDate.getDate() + interventionDurationDays);
      const interventionEndStr = interventionEndDate.toISOString().split('T')[0];

      // If intervention end goes beyond next check-in → not enough time
      if (interventionEndStr > nextReservation.startDate) {
        return {
          valid: false,
          error: `Temps insuffisant pour l'intervention "${linkedIntervention.title}" avant la reservation de ${nextReservation.label} (${nextReservation.startDate})`,
        };
      }

      // Also check times if same-day
      if (interventionEndStr === nextReservation.startDate) {
        const checkOutMinutes = timeToMinutes(newCheckOutTime);
        const interventionMinutes = (linkedIntervention.estimatedDurationHours || 0) * 60;
        const interventionEndMinutes = checkOutMinutes + interventionMinutes;
        const nextCheckInMinutes = timeToMinutes(nextReservation.startTime);

        if (nextCheckInMinutes > 0 && interventionEndMinutes > nextCheckInMinutes) {
          return {
            valid: false,
            error: `L'intervention "${linkedIntervention.title}" (${linkedIntervention.estimatedDurationHours}h) ne tiendra pas avant le check-in de ${nextReservation.label} a ${nextReservation.startTime}`,
          };
        }
      }
    }
  }

  return { valid: true, error: null };
}
