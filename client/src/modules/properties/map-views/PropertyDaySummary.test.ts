import { describe, expect, it } from 'vitest';
import type { Reservation } from '../../../services/api/reservationsApi';
import { currentOrNextStay } from './PropertyDaySummary';

const stay = (id: number, checkIn: string, checkOut: string) => ({ id, checkIn, checkOut }) as Reservation;

describe('currentOrNextStay', () => {
  it('préfère le séjour en cours', () => {
    expect(currentOrNextStay([stay(1, '2026-10-12', '2026-10-16'), stay(2, '2026-10-18', '2026-10-20')], '2026-10-15')?.id).toBe(1);
  });

  it('sinon le prochain, un départ du jour ne comptant plus', () => {
    expect(currentOrNextStay([stay(1, '2026-10-12', '2026-10-15'), stay(2, '2026-10-18', '2026-10-20')], '2026-10-15')?.id).toBe(2);
    expect(currentOrNextStay([], '2026-10-15')).toBeUndefined();
  });
});
