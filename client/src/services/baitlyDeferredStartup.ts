export const BAITLY_PLANNING_PAINTED = 'baitly:planning-painted';

/** Delay optional work until planning paint, or an initial paint on other routes. */
export function scheduleBaitlyDeferredStartup(task: () => void): () => void {
  let first = 0;
  let second = 0;
  let idle: number | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;
  let cancelled = false;
  const run = () => { if (!cancelled) task(); };
  const schedule = () => {
    if (scheduled || cancelled) return;
    scheduled = true;
    clearTimeout(deadline);
    window.removeEventListener(BAITLY_PLANNING_PAINTED, schedule);
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run, { timeout: 5000 });
    else fallback = setTimeout(run, 1000);
  };
  // Errors/empty routes must not leave optional startup waiting forever.
  const deadline = setTimeout(schedule, 10000);
  if (location.pathname === '/planning') {
    window.addEventListener(BAITLY_PLANNING_PAINTED, schedule, { once: true });
  } else {
    first = requestAnimationFrame(() => { second = requestAnimationFrame(schedule); });
  }
  return () => {
    cancelled = true;
    clearTimeout(deadline); clearTimeout(fallback);
    cancelAnimationFrame(first); cancelAnimationFrame(second);
    if (idle !== undefined) window.cancelIdleCallback?.(idle);
    window.removeEventListener(BAITLY_PLANNING_PAINTED, schedule);
  };
}
