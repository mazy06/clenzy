import { describe, it, expect } from 'vitest';
import { formatDuration, formatDurationFull } from '../durationUtils';

describe('formatDuration', () => {
  describe('edge cases', () => {
    it.each([null, undefined])('returns em dash for %s', (v) => {
      expect(formatDuration(v as null | undefined)).toBe('—');
    });

    it('returns em dash for NaN / Infinity', () => {
      expect(formatDuration(NaN)).toBe('—');
      expect(formatDuration(Infinity)).toBe('—');
    });

    it('clamps negative values to 0', () => {
      expect(formatDuration(-10)).toBe('0 min');
    });
  });

  describe('< 60 minutes', () => {
    it.each([
      [0, '0 min'],
      [1, '1 min'],
      [10, '10 min'],
      [59, '59 min'],
    ])('formatDuration(%i) === %s', (input, expected) => {
      expect(formatDuration(input)).toBe(expected);
    });

    it('rounds sub-minute precision noise (4.040000000000873 → 4 min)', () => {
      expect(formatDuration(4.040000000000873)).toBe('4 min');
    });
  });

  describe('< 24 hours', () => {
    it.each([
      [60, '1h'],
      [61, '1h 1min'],
      [120, '2h'],
      [190, '3h 10min'],
      [1439, '23h 59min'],
    ])('formatDuration(%i) === %s', (input, expected) => {
      expect(formatDuration(input)).toBe(expected);
    });
  });

  describe('>= 24 hours', () => {
    it.each([
      [1440, '1j'],
      [1500, '1j 1h'],
      [2880, '2j'],
      [5075, '3j 12h'],
      [14944, '10j 9h'],
    ])('formatDuration(%i) === %s', (input, expected) => {
      expect(formatDuration(input)).toBe(expected);
    });
  });
});

describe('formatDurationFull', () => {
  it.each([
    [0, '0min'],
    [10, '10min'],
    [60, '1h'],
    [65, '1h 5min'],
    [1500, '1j 1h'],
    [1505, '1j 1h 5min'],
    [14944, '10j 9h 4min'],
  ])('formatDurationFull(%i) === %s', (input, expected) => {
    expect(formatDurationFull(input)).toBe(expected);
  });
});
