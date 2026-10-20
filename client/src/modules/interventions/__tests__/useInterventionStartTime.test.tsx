import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInterventionStartTime } from '../useInterventionStartTime';

describe('créneau UTC de démarrage Baitly', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['2026-10-19T00:45:00', '2026-10-19T00:45:00Z', '2026-10-19T02:45:00+02:00'])(
    'attend le même instant pour %s et se débloque sans recharger', (date) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-19T00:44:59Z'));
      const { result } = renderHook(() => useInterventionStartTime(date));
      expect(result.current).toBe(true);
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current).toBe(false);
    },
  );

  it('réarme le délai après une replanification', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T00:45:00Z'));
    const { result, rerender } = renderHook(({ date }) => useInterventionStartTime(date), {
      initialProps: { date: '2026-10-19T00:45:00' },
    });
    expect(result.current).toBe(false);
    rerender({ date: '2026-10-19T00:46:00' });
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(false);
  });
});
