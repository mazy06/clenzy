import { describe, it, expect } from 'vitest';
import {
  detectConflicts,
  isEventInConflict,
  wouldConflict,
  validateReservationUpdate,
  validateInterventionUpdate,
} from '../utils/conflictUtils';
import type { PlanningEvent } from '../types';
import type { PlanningIntervention } from '../../../services/api';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeReservation(overrides: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    id: 'res-1',
    type: 'reservation',
    propertyId: 1,
    startDate: '2026-03-01',
    endDate: '2026-03-05',
    label: 'Guest A',
    status: 'confirmed',
    color: '#4A9B8E',
    ...overrides,
  };
}

function makeIntervention(overrides: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    id: 'int-10',
    type: 'cleaning',
    propertyId: 1,
    startDate: '2026-03-05',
    endDate: '2026-03-05',
    startTime: '11:00',
    endTime: '14:00',
    label: 'Ménage',
    status: 'scheduled',
    color: '#8B5CF6',
    ...overrides,
  };
}

function makePlanningIntervention(overrides: Partial<PlanningIntervention> = {}): PlanningIntervention {
  return {
    id: 10,
    propertyId: 1,
    propertyName: 'Apt A',
    type: 'cleaning',
    title: 'Ménage',
    assigneeName: 'Cleaner',
    startDate: '2026-03-05',
    endDate: '2026-03-05',
    startTime: '11:00',
    endTime: '14:00',
    status: 'scheduled',
    estimatedDurationHours: 3,
    ...overrides,
  };
}

// ─── detectConflicts ─────────────────────────────────────────────────────────

describe('detectConflicts', () => {
  it('returns empty for non-overlapping reservations', () => {
    const events = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-05', endDate: '2026-03-10' }),
    ];
    expect(detectConflicts(events)).toHaveLength(0);
  });

  it('detects overlapping reservations on the same property', () => {
    const events = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-06' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-04', endDate: '2026-03-10' }),
    ];
    const conflicts = detectConflicts(events);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].eventA.id).toBe('res-1');
    expect(conflicts[0].eventB.id).toBe('res-2');
  });

  it('ignores overlapping reservations on different properties', () => {
    const events = [
      makeReservation({ id: 'res-1', propertyId: 1, startDate: '2026-03-01', endDate: '2026-03-06' }),
      makeReservation({ id: 'res-2', propertyId: 2, startDate: '2026-03-04', endDate: '2026-03-10' }),
    ];
    expect(detectConflicts(events)).toHaveLength(0);
  });

  it('ignores interventions (only checks reservations)', () => {
    const events = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeIntervention({ id: 'int-1', startDate: '2026-03-03', endDate: '2026-03-03' }),
    ];
    expect(detectConflicts(events)).toHaveLength(0);
  });

  it('detects multiple conflicts', () => {
    const events = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-03', endDate: '2026-03-07' }),
      makeReservation({ id: 'res-3', startDate: '2026-03-06', endDate: '2026-03-10' }),
    ];
    const conflicts = detectConflicts(events);
    // res-1 overlaps res-2, res-2 overlaps res-3
    expect(conflicts).toHaveLength(2);
  });

  it('returns empty for empty events', () => {
    expect(detectConflicts([])).toHaveLength(0);
  });

  it('returns empty for a single reservation', () => {
    expect(detectConflicts([makeReservation()])).toHaveLength(0);
  });
});

// ─── isEventInConflict ───────────────────────────────────────────────────────

describe('isEventInConflict', () => {
  it('returns true when event is eventA in a conflict', () => {
    const conflicts = [{ eventA: makeReservation({ id: 'res-1' }), eventB: makeReservation({ id: 'res-2' }) }];
    expect(isEventInConflict('res-1', conflicts)).toBe(true);
  });

  it('returns true when event is eventB in a conflict', () => {
    const conflicts = [{ eventA: makeReservation({ id: 'res-1' }), eventB: makeReservation({ id: 'res-2' }) }];
    expect(isEventInConflict('res-2', conflicts)).toBe(true);
  });

  it('returns false when event is not involved', () => {
    const conflicts = [{ eventA: makeReservation({ id: 'res-1' }), eventB: makeReservation({ id: 'res-2' }) }];
    expect(isEventInConflict('res-3', conflicts)).toBe(false);
  });

  it('returns false for empty conflicts', () => {
    expect(isEventInConflict('res-1', [])).toBe(false);
  });
});

// ─── wouldConflict ───────────────────────────────────────────────────────────

describe('wouldConflict', () => {
  describe('reservation conflicts', () => {
    it('returns false when no overlap', () => {
      const modified = makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' });
      const allEvents = [
        modified,
        makeReservation({ id: 'res-2', startDate: '2026-03-06', endDate: '2026-03-10' }),
      ];
      expect(wouldConflict(modified, allEvents)).toBe(false);
    });

    it('returns true when overlapping with another reservation', () => {
      const modified = makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-07' });
      const allEvents = [
        modified,
        makeReservation({ id: 'res-2', startDate: '2026-03-05', endDate: '2026-03-10' }),
      ];
      expect(wouldConflict(modified, allEvents)).toBe(true);
    });

    it('returns false when touching but not overlapping (same-day checkout/checkin)', () => {
      const modified = makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' });
      const allEvents = [
        modified,
        makeReservation({ id: 'res-2', startDate: '2026-03-05', endDate: '2026-03-10' }),
      ];
      expect(wouldConflict(modified, allEvents)).toBe(false);
    });

    it('ignores self in comparison', () => {
      const modified = makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' });
      expect(wouldConflict(modified, [modified])).toBe(false);
    });

    it('ignores reservations on different properties', () => {
      const modified = makeReservation({ id: 'res-1', propertyId: 1, startDate: '2026-03-01', endDate: '2026-03-07' });
      const allEvents = [
        modified,
        makeReservation({ id: 'res-2', propertyId: 2, startDate: '2026-03-05', endDate: '2026-03-10' }),
      ];
      expect(wouldConflict(modified, allEvents)).toBe(false);
    });
  });

  describe('reservation with linked intervention', () => {
    it('returns true when intervention overflows into next reservation', () => {
      const modified = makeReservation({
        id: 'res-1',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        endTime: '11:00',
      });
      const nextRes = makeReservation({
        id: 'res-2',
        startDate: '2026-03-05',
        endDate: '2026-03-10',
        startTime: '15:00',
      });
      const allEvents = [modified, nextRes];
      // Intervention lasts 1 day (03-05 to 03-06) but next res starts 03-05 → overflow
      const interventions = [
        makePlanningIntervention({
          linkedReservationId: 1,
          startDate: '2026-03-05',
          endDate: '2026-03-06',
          estimatedDurationHours: 3,
        }),
      ];
      expect(wouldConflict(modified, allEvents, interventions)).toBe(true);
    });

    it('returns false when intervention fits before next reservation', () => {
      const modified = makeReservation({
        id: 'res-1',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        endTime: '11:00',
      });
      const nextRes = makeReservation({
        id: 'res-2',
        startDate: '2026-03-07',
        endDate: '2026-03-12',
      });
      const allEvents = [modified, nextRes];
      const interventions = [
        makePlanningIntervention({
          linkedReservationId: 1,
          startDate: '2026-03-05',
          endDate: '2026-03-05',
          estimatedDurationHours: 3,
        }),
      ];
      expect(wouldConflict(modified, allEvents, interventions)).toBe(false);
    });
  });

  describe('intervention conflicts', () => {
    it('returns true when intervention overlaps a reservation', () => {
      const modified = makeIntervention({
        id: 'int-10',
        propertyId: 1,
        startDate: '2026-03-03',
        endDate: '2026-03-04',
      });
      const allEvents = [
        makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
        modified,
      ];
      expect(wouldConflict(modified, allEvents)).toBe(true);
    });

    it('returns false when intervention is outside reservation dates', () => {
      const modified = makeIntervention({
        id: 'int-10',
        propertyId: 1,
        startDate: '2026-03-06',
        endDate: '2026-03-06',
      });
      const allEvents = [
        makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
        modified,
      ];
      expect(wouldConflict(modified, allEvents)).toBe(false);
    });

    it('returns true when intervention overlaps another intervention', () => {
      const modified = makeIntervention({
        id: 'int-10',
        propertyId: 1,
        startDate: '2026-03-05',
        endDate: '2026-03-06',
      });
      const allEvents = [modified];
      const interventions = [
        makePlanningIntervention({
          id: 20,
          propertyId: 1,
          startDate: '2026-03-05',
          endDate: '2026-03-06',
        }),
      ];
      expect(wouldConflict(modified, allEvents, interventions)).toBe(true);
    });

    it('ignores self when checking intervention overlap', () => {
      const modified = makeIntervention({
        id: 'int-10',
        propertyId: 1,
        startDate: '2026-03-05',
        endDate: '2026-03-05',
      });
      const allEvents = [modified];
      const interventions = [
        makePlanningIntervention({ id: 10, propertyId: 1, startDate: '2026-03-05', endDate: '2026-03-05' }),
      ];
      expect(wouldConflict(modified, allEvents, interventions)).toBe(false);
    });
  });
});

// ─── validateReservationUpdate ───────────────────────────────────────────────

describe('validateReservationUpdate', () => {
  it('returns valid when no overlap', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-10', endDate: '2026-03-15' }),
    ];
    const result = validateReservationUpdate(1, 1, '2026-03-01', '2026-03-05', undefined, undefined, allEvents, []);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns invalid when overlapping another reservation', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-04', endDate: '2026-03-10' }),
    ];
    const result = validateReservationUpdate(1, 1, '2026-03-01', '2026-03-07', undefined, undefined, allEvents, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conflit');
  });

  it('returns invalid when linked intervention does not fit before next reservation', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-05', endDate: '2026-03-10' }),
    ];
    const interventions = [
      makePlanningIntervention({
        linkedReservationId: 1,
        startDate: '2026-03-05',
        endDate: '2026-03-06',
        estimatedDurationHours: 3,
      }),
    ];
    const result = validateReservationUpdate(1, 1, '2026-03-01', '2026-03-05', undefined, undefined, allEvents, interventions);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('intervention');
  });

  it('returns valid when no linked intervention', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-06', endDate: '2026-03-10' }),
    ];
    const result = validateReservationUpdate(1, 1, '2026-03-01', '2026-03-05', undefined, undefined, allEvents, []);
    expect(result.valid).toBe(true);
  });

  it('detects same-day hour-level conflict with intervention', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeReservation({ id: 'res-2', startDate: '2026-03-05', endDate: '2026-03-10', startTime: '13:00' }),
    ];
    const interventions = [
      makePlanningIntervention({
        linkedReservationId: 1,
        startDate: '2026-03-05',
        endDate: '2026-03-05',
        estimatedDurationHours: 4,
      }),
    ];
    // Checkout at 11:00, intervention 4h → ends 15:00, next check-in 13:00 → conflict
    const result = validateReservationUpdate(1, 1, '2026-03-01', '2026-03-05', undefined, '11:00', allEvents, interventions);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ne tiendra pas');
  });
});

// ─── validateInterventionUpdate ──────────────────────────────────────────────

describe('validateInterventionUpdate', () => {
  it('returns valid when no overlap', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
    ];
    const result = validateInterventionUpdate(10, 1, '2026-03-06', '2026-03-06', '11:00', '14:00', allEvents, []);
    expect(result.valid).toBe(true);
  });

  it('returns invalid when overlapping a reservation', () => {
    const allEvents = [
      makeReservation({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
    ];
    const result = validateInterventionUpdate(10, 1, '2026-03-03', '2026-03-04', '11:00', '14:00', allEvents, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conflit');
  });

  it('returns invalid when overlapping another intervention', () => {
    const interventions = [
      makePlanningIntervention({ id: 20, propertyId: 1, startDate: '2026-03-05', endDate: '2026-03-05' }),
    ];
    const result = validateInterventionUpdate(10, 1, '2026-03-05', '2026-03-05', '11:00', '14:00', [], interventions);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Conflit');
  });

  it('ignores self in overlap check', () => {
    const interventions = [
      makePlanningIntervention({ id: 10, propertyId: 1, startDate: '2026-03-05', endDate: '2026-03-05' }),
    ];
    const result = validateInterventionUpdate(10, 1, '2026-03-05', '2026-03-05', '11:00', '14:00', [], interventions);
    expect(result.valid).toBe(true);
  });

  it('ignores interventions on different properties', () => {
    const interventions = [
      makePlanningIntervention({ id: 20, propertyId: 2, startDate: '2026-03-05', endDate: '2026-03-05' }),
    ];
    const result = validateInterventionUpdate(10, 1, '2026-03-05', '2026-03-05', '11:00', '14:00', [], interventions);
    expect(result.valid).toBe(true);
  });
});
