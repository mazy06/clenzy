import { describe, expect, it } from 'vitest';
import {
  demoCalendarMonth,
  demoDate,
  demoDateLabel,
  demoDigits,
  demoNumber,
  demoWeekend,
} from './planningDemoLocale';

describe('Baitly demo calendar and digits', () => {
  it('shows the same booking date in Umm al-Qura with Arabic digits', () => {
    expect(demoDate(3).toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expect(
      demoDateLabel(demoDate(3), 'ar', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    ).toBe('١٥ ربيع الآخر ١٤٤٨ هـ');
    expect(demoDateLabel(demoDate(3), 'fr', { day: 'numeric' })).toBe('26');
  });

  it('uses actual Hijri month boundaries and starts the week on Sunday', () => {
    const { cells, weekdays } = demoCalendarMonth('ar');
    expect(weekdays[0].title).toBe('الأحد');
    const days = cells.filter((date): date is Date => date !== null);
    expect(demoDateLabel(days[0], 'ar', { day: 'numeric' })).toBe('١');
    expect(cells.indexOf(days[0])).toBe(days[0].getUTCDay());
    expect(days).toHaveLength(30);
    expect(
      days.find((d) => d.toISOString().startsWith('2026-09-28')),
    ).toBeDefined();
  });

  it('also supports short lunar months instead of forcing 30 Gregorian days', () => {
    const month = demoCalendarMonth('ar', '2026-06-20');
    expect(month.cells.filter(Boolean)).toHaveLength(29);
  });

  it('preserves the Gregorian calendar in French and English', () => {
    for (const language of ['fr', 'en'] as const) {
      const { cells } = demoCalendarMonth(language);
      expect(cells[0]).toBeNull();
      expect(cells[1]?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(cells.filter(Boolean)).toHaveLength(30);
    }
  });

  it('formats amounts, percentages, times and folded counts consistently', () => {
    expect(demoNumber(1250, 'ar', { useGrouping: true })).toBe('١٬٢٥٠');
    expect(demoDigits('+2 · 15:00', 'ar')).toBe('+٢ · ١٥:٠٠');
    expect(demoNumber(0.83, 'ar', { style: 'percent' })).toContain('٨٣');
    expect(demoDigits('+2 · 15:00', 'fr')).toBe('+2 · 15:00');
  });

  it('uses Friday/Saturday in Arabic and Saturday/Sunday in French', () => {
    expect(demoWeekend(new Date('2026-09-25'), 'ar')).toBe(true);
    expect(demoWeekend(new Date('2026-09-27'), 'ar')).toBe(false);
    expect(demoWeekend(new Date('2026-09-27'), 'fr')).toBe(true);
  });
});
