import { describe, expect, it } from 'vitest';
import { nightsBetween } from './ReservationMapRow';

describe('nightsBetween', () => {
  it('compte les nuits d’un séjour, changement d’heure compris', () => {
    expect(nightsBetween('2026-10-15', '2026-10-18')).toBe(3);
    expect(nightsBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(nightsBetween('2026-10-15', '2026-10-15')).toBe(0);
  });
});
