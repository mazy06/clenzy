import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BAITLY_PLANNING_PAINTED, scheduleBaitlyDeferredStartup } from '../baitlyDeferredStartup';

beforeEach(() => { vi.useFakeTimers(); history.replaceState(null, '', '/planning'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); history.replaceState(null, '', '/'); });

it('attend la peinture planning et une période idle, sans répéter le démarrage', () => {
  let idle: IdleRequestCallback | undefined;
  vi.stubGlobal('requestIdleCallback', vi.fn((callback: IdleRequestCallback) => { idle = callback; return 1; }));
  const task = vi.fn(); const cancel = scheduleBaitlyDeferredStartup(task);
  vi.advanceTimersByTime(9000); expect(task).not.toHaveBeenCalled();
  window.dispatchEvent(new Event(BAITLY_PLANNING_PAINTED)); expect(task).not.toHaveBeenCalled();
  idle!({ didTimeout: false, timeRemaining: () => 10 });
  window.dispatchEvent(new Event(BAITLY_PLANNING_PAINTED)); vi.advanceTimersByTime(10000);
  expect(task).toHaveBeenCalledOnce(); cancel();
});

it('démarre finalement si le planning ne publie pas de succès', () => {
  vi.stubGlobal('requestIdleCallback', undefined);
  const task = vi.fn(); const cancel = scheduleBaitlyDeferredStartup(task);
  vi.advanceTimersByTime(10000); expect(task).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000); expect(task).toHaveBeenCalledOnce(); cancel();
});

it('annule les callbacks déjà planifiés', () => {
  vi.stubGlobal('requestIdleCallback', undefined);
  const task = vi.fn(); const cancel = scheduleBaitlyDeferredStartup(task);
  window.dispatchEvent(new Event(BAITLY_PLANNING_PAINTED)); cancel(); vi.advanceTimersByTime(20000);
  expect(task).not.toHaveBeenCalled();
});

it('attend deux frames sur une autre route', () => {
  history.replaceState(null, '', '/dashboard'); vi.stubGlobal('requestIdleCallback', undefined);
  const task = vi.fn(); const cancel = scheduleBaitlyDeferredStartup(task);
  vi.advanceTimersByTime(16); expect(task).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1032); expect(task).toHaveBeenCalledOnce(); cancel();
});
