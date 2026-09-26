import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBaitlyPlanningTimeline } from './useBaitlyPlanningTimeline';

beforeEach(() =>
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }),
);
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('planning demonstration playback', () => {
  it('starts only when visible and resumes the remaining delay without replaying steps', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ active }) =>
        useBaitlyPlanningTimeline(active, (at) => {
          at(1000, first);
          at(2000, second);
        }),
      { initialProps: { active: false } },
    );
    tick(8000);
    expect(first).not.toHaveBeenCalled();
    rerender({ active: true });
    tick(1500);
    expect(first).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    tick(8000);
    expect(second).not.toHaveBeenCalled();
    rerender({ active: true });
    tick(499);
    expect(second).not.toHaveBeenCalled();
    tick(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('runs simultaneous events once in Strict Mode and cancels work on unmount', () => {
    const step = vi.fn();
    const afterUnmount = vi.fn();
    const wrapper = ({ children }: PropsWithChildren) => (
      <StrictMode>{children}</StrictMode>
    );
    const { unmount } = renderHook(
      () =>
        useBaitlyPlanningTimeline(true, (at) => {
          at(500, step);
          at(500, step);
          at(1000, afterUnmount);
        }),
      { wrapper },
    );
    tick(500);
    expect(step).toHaveBeenCalledTimes(2);
    unmount();
    tick(5000);
    expect(afterUnmount).not.toHaveBeenCalled();
  });
});
