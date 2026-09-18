import { describe, it, expect, vi, afterEach } from 'vitest';
import { beginLayoutShift, isLayoutShifting, createSettledScheduler } from './layoutShift';

function withReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduce })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  beginLayoutShift(0);
});

describe('beginLayoutShift', () => {
  it('whenWindowIsOpen_thenLayoutIsShifting', () => {
    withReducedMotion(false);

    beginLayoutShift(220);

    expect(isLayoutShifting()).toBe(true);
  });

  it('whenWindowHasElapsed_thenLayoutIsNoLongerShifting', () => {
    withReducedMotion(false);
    vi.useFakeTimers();

    beginLayoutShift(220);
    vi.advanceTimersByTime(221);

    expect(isLayoutShifting()).toBe(false);
  });

  it('whenMotionIsReduced_thenNoWindowOpens', () => {
    withReducedMotion(true);

    beginLayoutShift(220);

    // La transition CSS est neutralisee en mouvement reduit : la mise en page
    // arrive d'un coup, differer la mesure ne ferait que retarder l'affichage.
    expect(isLayoutShifting()).toBe(false);
  });
});

describe('createSettledScheduler', () => {
  it('whenNoShiftIsUnderway_thenMeasuresOnNextFrame', async () => {
    withReducedMotion(false);
    const measure = vi.fn();

    createSettledScheduler(measure).schedule();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('whenScheduledRepeatedly_thenMeasuresOnce', async () => {
    withReducedMotion(false);
    const measure = vi.fn();
    const scheduler = createSettledScheduler(measure);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('whenCancelled_thenNeverMeasures', async () => {
    withReducedMotion(false);
    const measure = vi.fn();
    const scheduler = createSettledScheduler(measure);

    scheduler.schedule();
    scheduler.cancel();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    expect(measure).not.toHaveBeenCalled();
  });
});
