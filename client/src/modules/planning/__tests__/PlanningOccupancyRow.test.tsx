import { describe, it, expect } from 'vitest';

import { computeDayOccupancy } from '../PlanningOccupancyRow';
import type { PlanningEvent } from '../types';

const makeEvent = (overrides: Partial<PlanningEvent>): PlanningEvent => ({
  id: 'res-1',
  type: 'reservation',
  propertyId: 1,
  startDate: '2025-06-02',
  endDate: '2025-06-04',
  label: 'Jean Dupont',
  status: 'confirmed',
  color: '#4CAF50',
  ...overrides,
});

/** 1ᵉʳ → 4 juin (dates locales, comme les jours du timeline). */
const days = [
  new Date(2025, 5, 1),
  new Date(2025, 5, 2),
  new Date(2025, 5, 3),
  new Date(2025, 5, 4),
];

describe('computeDayOccupancy', () => {
  it('whenReservationCoversDay_thenDayCountsOccupied_andCheckoutDayIsFree', () => {
    const events = [makeEvent({ startDate: '2025-06-02', endDate: '2025-06-04' })];

    const occupancy = computeDayOccupancy(days, events, 2);

    // 1ᵉʳ libre, 2-3 occupés (1/2 = 50 %), 4 = jour du départ → libre.
    expect(occupancy).toEqual([0, 50, 50, 0]);
  });

  it('whenTwoReservationsSameProperty_thenPropertyCountedOnce', () => {
    const events = [
      makeEvent({ id: 'a', startDate: '2025-06-02', endDate: '2025-06-03' }),
      makeEvent({ id: 'b', startDate: '2025-06-02', endDate: '2025-06-04', propertyId: 1 }),
    ];

    const occupancy = computeDayOccupancy(days, events, 1);

    expect(occupancy[1]).toBe(100);
  });

  it('whenEventCancelledOrNotReservation_thenIgnored', () => {
    const events = [
      makeEvent({ status: 'cancelled' }),
      makeEvent({ id: 'block', type: 'blocked', propertyId: 2 }),
      makeEvent({ id: 'clean', type: 'cleaning', propertyId: 3 }),
    ];

    const occupancy = computeDayOccupancy(days, events, 3);

    expect(occupancy).toEqual([0, 0, 0, 0]);
  });

  it('whenNoProperties_thenAllZero', () => {
    const occupancy = computeDayOccupancy(days, [makeEvent({})], 0);

    expect(occupancy).toEqual([0, 0, 0, 0]);
  });
});
