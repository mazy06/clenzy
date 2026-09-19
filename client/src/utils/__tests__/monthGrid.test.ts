import { describe, it, expect } from 'vitest';
import { buildMonthGrid, toLocalISODate } from '../monthGrid';

/**
 * Le socle des trois grilles mensuelles (tarifs, mini selecteur, calendrier de
 * reservation), qui avaient chacune leur copie calee sur LUNDI en dur.
 */

/** Octobre 2024 : le 1er tombe un mardi. */
const OCTOBER_2024 = new Date(2024, 9, 1, 12);

describe('buildMonthGrid', () => {
  it('pose un seul jour de debordement quand la semaine ouvre au lundi', () => {
    const cells = buildMonthGrid(OCTOBER_2024, 1);
    // Mardi 1er : seul lundi 30 septembre precede.
    expect(cells[0].dateStr).toBe('2024-09-30');
    expect(cells[0].inMonth).toBe(false);
    expect(cells[1].dateStr).toBe('2024-10-01');
  });

  it('en pose deux quand elle ouvre au dimanche', () => {
    const cells = buildMonthGrid(OCTOBER_2024, 0);
    expect(cells[0].dateStr).toBe('2024-09-29');
    expect(cells[1].dateStr).toBe('2024-09-30');
    expect(cells[2].dateStr).toBe('2024-10-01');
  });

  it('remplit des semaines entieres, quel que soit le debut', () => {
    for (const weekStartsOn of [0, 1] as const) {
      const cells = buildMonthGrid(OCTOBER_2024, weekStartsOn);
      expect(cells.length % 7).toBe(0);
      expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
    }
  });

  it('date en heure locale — toISOString reculerait d un jour a l est de Greenwich', () => {
    expect(toLocalISODate(new Date(2024, 9, 1, 0, 30))).toBe('2024-10-01');
  });
});
