import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBaitlyPlanningReady } from '../hooks/useBaitlyPlanningReady';

let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let now: number;
let hidden: boolean;
let navigation: string;
const mark = vi.fn();
const measure = vi.fn();
function paintFrame() {
  act(() => {
    const current = [...frames.values()]; frames.clear(); now += 16;
    current.forEach((callback) => callback(now));
  });
}

beforeEach(() => {
  frames = new Map(); frameId = 0; now = 100; hidden = false;
  navigation = 'https://app.clenzy.fr/planning'; mark.mockClear(); measure.mockClear();
  vi.stubGlobal('performance', { now: () => now, mark, measure,
    getEntriesByType: () => [{ name: navigation, startTime: 0 }],
    getEntriesByName: (name: string) => mark.mock.calls.filter(([entry]) => entry === name) });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId; frames.set(id, callback); return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('planning Baitly prêt à afficher', () => {
  it('attend les données et deux frames avant de mesurer et précharger une seule fois', () => {
    const warm = vi.fn();
    const hook = renderHook(({ ready }) => useBaitlyPlanningReady(ready, warm), { initialProps: { ready: false } });
    expect(warm).not.toHaveBeenCalled();
    hook.rerender({ ready: true });
    paintFrame(); expect(warm).not.toHaveBeenCalled();
    paintFrame(); expect(warm).toHaveBeenCalledOnce();
    expect(measure).toHaveBeenCalledWith('baitly.planning.mount-to-ready', { start: 100, end: 132 });
    expect(measure).toHaveBeenCalledWith('baitly.planning.navigation-to-ready', { start: 0, end: 132 });
    hook.rerender({ ready: false }); hook.rerender({ ready: true }); paintFrame(); paintFrame();
    expect(warm).toHaveBeenCalledOnce();
  });

  it('annule une publication obsolète et les callbacks au démontage', () => {
    const warm = vi.fn();
    const hook = renderHook(({ ready }) => useBaitlyPlanningReady(ready, warm), { initialProps: { ready: true } });
    paintFrame(); hook.rerender({ ready: false }); paintFrame();
    expect(warm).not.toHaveBeenCalled();
    hook.rerender({ ready: true }); paintFrame(); hook.unmount(); paintFrame();
    expect(warm).not.toHaveBeenCalled(); expect(frames.size).toBe(0);
  });

  it('attend que le document redevienne visible', () => {
    hidden = true;
    const warm = vi.fn(); renderHook(() => useBaitlyPlanningReady(true, warm));
    paintFrame(); paintFrame(); expect(warm).not.toHaveBeenCalled();
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    paintFrame(); paintFrame(); expect(warm).toHaveBeenCalledOnce();
  });

  it('ne compte pas le boot du document précédent pendant une navigation interne', () => {
    navigation = 'https://app.clenzy.fr/dashboard';
    renderHook(() => useBaitlyPlanningReady(true, vi.fn())); paintFrame(); paintFrame();
    expect(measure.mock.calls.map(([name]) => name)).toEqual(['baitly.planning.mount-to-ready']);
  });

  it('ne recompte pas la navigation après un retour sur le planning', () => {
    const first = renderHook(() => useBaitlyPlanningReady(true, vi.fn()));
    paintFrame(); paintFrame(); first.unmount();
    renderHook(() => useBaitlyPlanningReady(true, vi.fn())); paintFrame(); paintFrame();
    expect(measure.mock.calls.filter(([name]) => name === 'baitly.planning.navigation-to-ready')).toHaveLength(1);
    expect(measure.mock.calls.filter(([name]) => name === 'baitly.planning.mount-to-ready')).toHaveLength(2);
  });
});
