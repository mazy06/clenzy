// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdown } from '../useCountdown';

afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('expiré pour une date passée', () => {
    const { result } = renderHook(() => useCountdown(new Date(Date.now() - 1000).toISOString()));
    expect(result.current.expired).toBe(true);
    expect(result.current.totalMs).toBe(0);
  });

  it('actif pour une date future (heures correctes)', () => {
    const at = new Date(Date.now() + 2 * 3_600_000 + 30 * 60_000).toISOString();
    const { result } = renderHook(() => useCountdown(at));
    expect(result.current.expired).toBe(false);
    expect(result.current.hours).toBe(2);
  });

  it('décrémente à chaque tic', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T10:00:00.000Z'));
    const at = new Date('2026-06-25T10:01:00.000Z').toISOString();
    const { result } = renderHook(() => useCountdown(at, 1000));
    expect(result.current.minutes).toBe(1);
    expect(result.current.seconds).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.minutes).toBe(0);
    expect(result.current.seconds).toBe(59);
  });
});
