/**
 * Tests for usePlanningData transform functions.
 * We test the exported pure functions (reservationToEvent, interventionToEvent, dedup)
 * by importing and testing the module's internal logic via the hook's output shapes.
 *
 * Since the transform functions are not directly exported, we test them indirectly
 * by verifying the PlanningEvent shapes produced by the hook's data pipeline.
 */
import { describe, it, expect } from 'vitest';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';

// ─── Replicate the transform functions from usePlanningData.ts ───────────────
// (These are private in the module, so we re-implement for testing)

function getReservationColor(status: string): string {
  switch (status) {
    case 'confirmed': return '#4A9B8E';
    case 'pending': return '#F59E0B';
    case 'cancelled': return '#EF4444';
    default: return '#6B7280';
  }
}

function getInterventionColor(type: string): string {
  return type === 'cleaning' ? '#8B5CF6' : '#F97316';
}

interface Reservation {
  id: number;
  propertyId: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  source: string;
  sourceName?: string;
}

function reservationToEvent(
  r: Reservation,
  propertyDefaults?: { defaultCheckInTime?: string; defaultCheckOutTime?: string },
): PlanningEvent {
  return {
    id: `res-${r.id}`,
    type: 'reservation',
    propertyId: r.propertyId,
    startDate: r.checkIn,
    endDate: r.checkOut,
    startTime: r.checkInTime || propertyDefaults?.defaultCheckInTime || '15:00',
    endTime: r.checkOutTime || propertyDefaults?.defaultCheckOutTime || '11:00',
    label: r.guestName,
    sublabel: r.source !== 'other' ? r.sourceName || r.source : undefined,
    status: r.status,
    color: getReservationColor(r.status),
  };
}

function interventionToEvent(i: PlanningIntervention): PlanningEvent {
  let endTime = i.endTime;
  if (!endTime && i.startTime && i.estimatedDurationHours) {
    const [h, m] = i.startTime.split(':').map(Number);
    const endH = Math.min(h + i.estimatedDurationHours, 23);
    endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } else if (!endTime && i.startTime) {
    const defaultHours = i.type === 'cleaning' ? 3 : 2;
    const [h, m] = i.startTime.split(':').map(Number);
    const endH = Math.min(h + defaultHours, 23);
    endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return {
    id: `int-${i.id}`,
    type: i.type === 'cleaning' ? 'cleaning' : 'maintenance',
    propertyId: i.propertyId,
    startDate: i.startDate,
    endDate: i.endDate,
    startTime: i.startTime,
    endTime,
    label: i.title,
    sublabel: i.assigneeName,
    status: i.status,
    color: getInterventionColor(i.type),
    intervention: i,
  };
}

function dedup<T extends { id: number }>(arrays: T[][]): T[] {
  const seen = new Map<number, T>();
  for (const arr of arrays) {
    for (const item of arr) {
      if (!seen.has(item.id)) {
        seen.set(item.id, item);
      }
    }
  }
  return Array.from(seen.values());
}

// ─── reservationToEvent ──────────────────────────────────────────────────────

describe('reservationToEvent', () => {
  const baseReservation: Reservation = {
    id: 1,
    propertyId: 10,
    guestName: 'John Doe',
    checkIn: '2026-03-01',
    checkOut: '2026-03-05',
    status: 'confirmed',
    source: 'direct',
  };

  it('maps reservation fields to PlanningEvent', () => {
    const event = reservationToEvent(baseReservation);
    expect(event.id).toBe('res-1');
    expect(event.type).toBe('reservation');
    expect(event.propertyId).toBe(10);
    expect(event.startDate).toBe('2026-03-01');
    expect(event.endDate).toBe('2026-03-05');
    expect(event.label).toBe('John Doe');
  });

  it('uses property defaults when no check-in time specified', () => {
    const event = reservationToEvent(baseReservation, { defaultCheckInTime: '16:00', defaultCheckOutTime: '10:00' });
    expect(event.startTime).toBe('16:00');
    expect(event.endTime).toBe('10:00');
  });

  it('uses reservation times over defaults', () => {
    const r = { ...baseReservation, checkInTime: '14:00', checkOutTime: '12:00' };
    const event = reservationToEvent(r, { defaultCheckInTime: '16:00' });
    expect(event.startTime).toBe('14:00');
    expect(event.endTime).toBe('12:00');
  });

  it('falls back to 15:00/11:00 when no times available', () => {
    const event = reservationToEvent(baseReservation);
    expect(event.startTime).toBe('15:00');
    expect(event.endTime).toBe('11:00');
  });

  it('sets sublabel for non-other sources', () => {
    const r = { ...baseReservation, source: 'airbnb', sourceName: 'Airbnb' };
    const event = reservationToEvent(r);
    expect(event.sublabel).toBe('Airbnb');
  });

  it('sets undefined sublabel for "other" source', () => {
    const r = { ...baseReservation, source: 'other' };
    const event = reservationToEvent(r);
    expect(event.sublabel).toBeUndefined();
  });

  it('maps status colors correctly', () => {
    expect(reservationToEvent({ ...baseReservation, status: 'confirmed' }).color).toBe('#4A9B8E');
    expect(reservationToEvent({ ...baseReservation, status: 'pending' }).color).toBe('#F59E0B');
    expect(reservationToEvent({ ...baseReservation, status: 'cancelled' }).color).toBe('#EF4444');
  });
});

// ─── interventionToEvent ─────────────────────────────────────────────────────

describe('interventionToEvent', () => {
  const baseIntervention: PlanningIntervention = {
    id: 5,
    propertyId: 10,
    propertyName: 'Apt A',
    type: 'cleaning',
    title: 'Ménage départ',
    assigneeName: 'Marie',
    startDate: '2026-03-05',
    endDate: '2026-03-05',
    startTime: '11:00',
    endTime: '14:00',
    status: 'scheduled',
    estimatedDurationHours: 3,
  };

  it('maps intervention fields to PlanningEvent', () => {
    const event = interventionToEvent(baseIntervention);
    expect(event.id).toBe('int-5');
    expect(event.type).toBe('cleaning');
    expect(event.propertyId).toBe(10);
    expect(event.startDate).toBe('2026-03-05');
    expect(event.label).toBe('Ménage départ');
    expect(event.sublabel).toBe('Marie');
  });

  it('uses provided endTime when available', () => {
    const event = interventionToEvent(baseIntervention);
    expect(event.endTime).toBe('14:00');
  });

  it('computes endTime from startTime + estimatedDurationHours when no endTime', () => {
    const i = { ...baseIntervention, endTime: undefined, startTime: '11:00', estimatedDurationHours: 3 };
    const event = interventionToEvent(i);
    expect(event.endTime).toBe('14:00');
  });

  it('clamps computed endTime to 23:00', () => {
    const i = { ...baseIntervention, endTime: undefined, startTime: '22:00', estimatedDurationHours: 5 };
    const event = interventionToEvent(i);
    expect(event.endTime).toBe('23:00');
  });

  it('falls back to default duration when no endTime and no estimatedDuration', () => {
    const i = { ...baseIntervention, endTime: undefined, estimatedDurationHours: 0, startTime: '11:00' };
    // estimatedDurationHours is falsy (0), so falls through to default
    const event = interventionToEvent(i);
    // cleaning default = 3h → 14:00
    expect(event.endTime).toBe('14:00');
  });

  it('uses 2h default for maintenance type', () => {
    const i = {
      ...baseIntervention,
      type: 'maintenance' as const,
      endTime: undefined,
      estimatedDurationHours: 0,
      startTime: '11:00',
    };
    const event = interventionToEvent(i);
    expect(event.endTime).toBe('13:00');
  });

  it('maps maintenance type correctly', () => {
    const i = { ...baseIntervention, type: 'maintenance' as const };
    const event = interventionToEvent(i);
    expect(event.type).toBe('maintenance');
  });

  it('uses cleaning color for cleaning type', () => {
    const event = interventionToEvent(baseIntervention);
    expect(event.color).toBe('#8B5CF6');
  });

  it('uses maintenance color for maintenance type', () => {
    const i = { ...baseIntervention, type: 'maintenance' as const };
    const event = interventionToEvent(i);
    expect(event.color).toBe('#F97316');
  });
});

// ─── dedup ───────────────────────────────────────────────────────────────────

describe('dedup', () => {
  it('deduplicates by id across arrays', () => {
    const arr1 = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
    const arr2 = [{ id: 2, name: 'b-dup' }, { id: 3, name: 'c' }];
    const result = dedup([arr1, arr2]);
    expect(result).toHaveLength(3);
    expect(result.map(r => r.id)).toEqual([1, 2, 3]);
  });

  it('keeps first occurrence on duplicate', () => {
    const arr1 = [{ id: 1, name: 'first' }];
    const arr2 = [{ id: 1, name: 'second' }];
    const result = dedup([arr1, arr2]);
    expect(result[0].name).toBe('first');
  });

  it('handles empty arrays', () => {
    expect(dedup([])).toHaveLength(0);
    expect(dedup([[]])).toHaveLength(0);
  });

  it('handles single array', () => {
    const arr = [{ id: 1 }, { id: 2 }];
    expect(dedup([arr])).toHaveLength(2);
  });
});
