export const BAITLY_PLANNING_PAINTED = 'baitly:planning-painted';
export const BAITLY_PROSPECTION_READY = 'baitly:prospection-ready';
let prospectionReady = false;

/** Release optional startup work after the first usable prospection surface. */
export function signalBaitlyProspectionReady(): void {
  if (prospectionReady) return;
  prospectionReady = true;
  window.dispatchEvent(new Event(BAITLY_PROSPECTION_READY));
}

export function needsBaitlyDeferredStartup(): boolean {
  if(location.pathname==='/planning'){
    try{return !performance.getEntriesByName('baitly.planning.ready','mark').length;}
    catch{return true;}
  }
  return location.pathname === '/prospection' && !prospectionReady;
}

/** Prioritize the current surface; a deadline also releases work on empty/error screens. */
export function scheduleBaitlyDeferredStartup(task: () => void): () => void {
  let first = 0;
  let second = 0;
  let idle: number | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let scheduled = false;
  let cancelled = false;
  const readyEvent = location.pathname === '/prospection' ? BAITLY_PROSPECTION_READY : BAITLY_PLANNING_PAINTED;
  const run = () => { if (!cancelled) task(); };
  const schedule = () => {
    if (scheduled || cancelled) return;
    scheduled = true;
    clearTimeout(deadline);
    window.removeEventListener(readyEvent, schedule);
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run, { timeout: 5000 });
    else fallback = setTimeout(run, 1000);
  };
  // Errors/empty routes must not leave optional startup waiting forever.
  const deadline = setTimeout(schedule, 10000);
  if (needsBaitlyDeferredStartup()) {
    window.addEventListener(readyEvent, schedule, { once: true });
  } else {
    first = requestAnimationFrame(() => { second = requestAnimationFrame(schedule); });
  }
  return () => {
    cancelled = true;
    clearTimeout(deadline); clearTimeout(fallback);
    cancelAnimationFrame(first); cancelAnimationFrame(second);
    if (idle !== undefined) window.cancelIdleCallback?.(idle);
    window.removeEventListener(readyEvent, schedule);
  };
}
