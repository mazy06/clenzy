import { describe, expect, it } from 'vitest';
import type { PlanningData } from '../../../services/api/planningDataApi';
import { updateBaitlyPlanningStay } from '../utils/baitlyPlanningCache';

const data = {
  reservations: [{ id: 1, checkIn: '2026-10-10', checkOut: '2026-10-12' }, { id: 2 }],
  interventions: [{ id: 3, linkedReservationId: 1, startDate: '2026-10-12', endDate: '2026-10-13' }],
  awaitingPayment: [], blocked: [],
} as unknown as PlanningData;

describe('cache agrégé du planning Baitly', () => {
  it('déplace le séjour et sa prestation sans modifier les objets sources', () => {
    const result = updateBaitlyPlanningStay(data, 1, { checkIn: '2026-10-11', checkOut: '2026-10-13' }, { type: 'move', daysDelta: 1 })!;
    expect(result.reservations[0].checkIn).toBe('2026-10-11');
    expect(result.interventions[0].startDate).toBe('2026-10-13');
    expect(result.reservations[1]).toBe(data.reservations[1]);
    expect(data.interventions[0].startDate).toBe('2026-10-12');
  });

  it('replace la prestation au nouveau départ en conservant sa durée', () => {
    const result = updateBaitlyPlanningStay(data, 1, { checkOut: '2026-10-15' }, { type: 'resize', daysDelta: 3 })!;
    expect(result.interventions[0]).toMatchObject({ startDate: '2026-10-15', endDate: '2026-10-16' });
    expect(result.awaitingPayment).toBe(data.awaitingPayment);
  });
});
