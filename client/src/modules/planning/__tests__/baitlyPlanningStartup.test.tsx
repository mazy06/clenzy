import { useRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBaitlyPlanningViewport } from '../hooks/useBaitlyPlanningViewport';
import { usePlanningNavigation } from '../hooks/usePlanningNavigation';
import { useSettledRange } from '../hooks/useSettledRange';

const preference = vi.hoisted(() => ({
  value: { zoom: 'fortnight', density: 'normal' }, isLoading: true,
}));
vi.mock('../../../hooks/useUserPreference', () => ({
  useUserPreference: () => [preference.value, vi.fn(), { isLoading: preference.isLoading }],
}));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('initialisation du planning Baitly', () => {
  it('attend le zoom enregistré puis utilise les défauts si les préférences échouent', () => {
    preference.isLoading = true;
    const hook = renderHook(usePlanningNavigation);
    expect(hook.result.current.preferencesReady).toBe(false);
    preference.value = { zoom: 'month', density: 'compact' };
    preference.isLoading = false;
    hook.rerender();
    expect(hook.result.current.preferencesReady).toBe(true);
    expect(hook.result.current.zoom).toBe('month');
    preference.value = { zoom: 'fortnight', density: 'normal' };
    hook.rerender();
    expect(hook.result.current.preferencesReady).toBe(true);
    expect(hook.result.current.zoom).toBe('fortnight');
  });

  it('adopte immédiatement la première plage utilisable, puis temporise les défilements', () => {
    vi.useFakeTimers();
    const initial = new Date(2026, 8, 1);
    const saved = new Date(2026, 9, 1);
    const next = new Date(2026, 10, 1);
    const hook = renderHook(({ start, ready }) => useSettledRange(start, start, ready),
      { initialProps: { start: initial, ready: false } });
    hook.rerender({ start: saved, ready: true });
    expect(hook.result.current.start).toBe(saved);
    hook.rerender({ start: next, ready: true });
    expect(hook.result.current.start).toBe(saved);
    act(() => vi.advanceTimersByTime(250));
    expect(hook.result.current.start).toBe(next);
    hook.unmount();
    vi.useRealTimers();
  });

  it('mesure uniquement une géométrie prête, sans republier une hauteur inchangée', () => {
    let resize!: ResizeObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now()); return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const element = document.createElement('div');
    Object.defineProperties(element, {
      clientHeight: { configurable: true, value: 500 },
      clientWidth: { configurable: true, value: 1200 },
    });
    const publish = vi.fn();
    const hook = renderHook(({ ready }) => {
      const ref = useRef(element);
      return useBaitlyPlanningViewport(ref, publish, ready);
    }, { initialProps: { ready: false } });
    expect(publish).not.toHaveBeenCalled();
    hook.rerender({ ready: true });
    expect(publish).toHaveBeenCalledExactlyOnceWith(500);
    act(() => resize([], {} as ResizeObserver));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(hook.result.current).toEqual({ width: 1200, height: 500 });
    hook.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
