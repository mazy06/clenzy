import { describe, it, expect } from 'vitest';
import {
  toDateStr,
  toDate,
  generateDays,
  daysBetween,
  addDaysToStr,
  getHourOffsetPx,
  computeDateRange,
  computeFetchRange,
  getOverlappingChunks,
  computeBufferRange,
} from '../utils/dateUtils';

// ─── toDateStr ───────────────────────────────────────────────────────────────

describe('toDateStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateStr(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('pads single-digit months and days', () => {
    expect(toDateStr(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

// ─── toDate ──────────────────────────────────────────────────────────────────

describe('toDate', () => {
  it('parses ISO date string to Date object', () => {
    const date = toDate('2026-03-05');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2); // 0-indexed
    expect(date.getDate()).toBe(5);
  });
});

// ─── generateDays ────────────────────────────────────────────────────────────

describe('generateDays', () => {
  it('generates days in range inclusive', () => {
    const days = generateDays(new Date(2026, 2, 1), new Date(2026, 2, 5));
    expect(days).toHaveLength(5);
  });

  it('returns single day for same start and end', () => {
    const days = generateDays(new Date(2026, 2, 1), new Date(2026, 2, 1));
    expect(days).toHaveLength(1);
  });

  it('returns empty array when start > end', () => {
    const days = generateDays(new Date(2026, 2, 5), new Date(2026, 2, 1));
    expect(days).toHaveLength(0);
  });
});

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns positive difference for later date', () => {
    expect(daysBetween(new Date(2026, 2, 1), new Date(2026, 2, 5))).toBe(4);
  });

  it('returns 0 for same date', () => {
    expect(daysBetween(new Date(2026, 2, 1), new Date(2026, 2, 1))).toBe(0);
  });

  it('returns negative for earlier date', () => {
    expect(daysBetween(new Date(2026, 2, 5), new Date(2026, 2, 1))).toBe(-4);
  });
});

// ─── addDaysToStr ────────────────────────────────────────────────────────────

describe('addDaysToStr', () => {
  it('adds positive days', () => {
    expect(addDaysToStr('2026-03-01', 5)).toBe('2026-03-06');
  });

  it('handles negative days', () => {
    expect(addDaysToStr('2026-03-10', -3)).toBe('2026-03-07');
  });

  it('handles month boundary', () => {
    expect(addDaysToStr('2026-03-30', 5)).toBe('2026-04-04');
  });

  it('adds zero days returns same date', () => {
    expect(addDaysToStr('2026-03-05', 0)).toBe('2026-03-05');
  });
});

// ─── getHourOffsetPx ─────────────────────────────────────────────────────────

describe('getHourOffsetPx', () => {
  it('returns 0 for undefined time', () => {
    expect(getHourOffsetPx(undefined, 100)).toBe(0);
  });

  it('returns 0 for narrow day width (<= 40px)', () => {
    expect(getHourOffsetPx('12:00', 40)).toBe(0);
  });

  it('returns half day width for 12:00', () => {
    expect(getHourOffsetPx('12:00', 200)).toBeCloseTo(100, 0);
  });

  it('returns 0 for midnight', () => {
    expect(getHourOffsetPx('00:00', 200)).toBe(0);
  });

  it('returns correct offset for 15:00', () => {
    // 15/24 * 200 = 125
    expect(getHourOffsetPx('15:00', 200)).toBeCloseTo(125, 0);
  });

  it('handles minutes correctly', () => {
    // (11 + 30/60) / 24 * 200 = 95.83
    expect(getHourOffsetPx('11:30', 200)).toBeCloseTo(95.83, 0);
  });
});

// ─── computeDateRange ────────────────────────────────────────────────────────

describe('computeDateRange', () => {
  it('week zoom starts at week start', () => {
    const date = new Date(2026, 2, 5); // Thursday
    const range = computeDateRange(date, 'week');
    // Week starts on Monday (fr locale)
    expect(range.start.getDay()).toBe(1); // Monday
  });

  it('month zoom starts at month start', () => {
    const date = new Date(2026, 2, 15);
    const range = computeDateRange(date, 'month');
    expect(range.start.getDate()).toBe(1);
  });
});

// ─── computeFetchRange ───────────────────────────────────────────────────────

describe('computeFetchRange', () => {
  it('adds buffer days around the visible range', () => {
    const start = new Date(2026, 2, 1);
    const end = new Date(2026, 2, 14);
    const result = computeFetchRange(start, end, 7);
    expect(result.from).toBe('2026-02-22');
    expect(result.to).toBe('2026-03-21');
  });
});

// ─── getOverlappingChunks ────────────────────────────────────────────────────

describe('getOverlappingChunks', () => {
  it('returns at least one chunk for any date range', () => {
    const chunks = getOverlappingChunks(new Date(2026, 2, 1), new Date(2026, 2, 5));
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('returns multiple chunks for wide date range', () => {
    const chunks = getOverlappingChunks(new Date(2026, 2, 1), new Date(2026, 4, 1));
    // 2 months ≈ 60 days, chunk size 30 → at least 2 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('each chunk has from and to as ISO date strings', () => {
    const chunks = getOverlappingChunks(new Date(2026, 2, 1), new Date(2026, 2, 5));
    for (const chunk of chunks) {
      expect(chunk.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(chunk.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('chunks are contiguous (no gaps)', () => {
    const chunks = getOverlappingChunks(new Date(2026, 0, 1), new Date(2026, 5, 30));
    for (let i = 1; i < chunks.length; i++) {
      // Next chunk from should be day after previous chunk to
      const prevTo = new Date(chunks[i - 1].to);
      const nextFrom = new Date(chunks[i].from);
      const diffDays = (nextFrom.getTime() - prevTo.getTime()) / 86400000;
      expect(diffDays).toBe(1);
    }
  });
});

// ─── computeBufferRange ──────────────────────────────────────────────────────

describe('computeBufferRange', () => {
  it('extends range by multiplier * visible days on each side', () => {
    const anchor = new Date(2026, 2, 15);
    const range = computeBufferRange(anchor, 'week', 3);
    // week has 14 visible days * 3 = 42 buffer days on each side
    const totalDays = daysBetween(range.start, range.end);
    expect(totalDays).toBe(84); // 42 + 42
  });
});
