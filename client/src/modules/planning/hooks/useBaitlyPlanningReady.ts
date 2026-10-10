import { useEffect, useRef } from 'react';

/** Initial committed planning, after two animation frames allow its first paint. */
export function useBaitlyPlanningReady(ready: boolean, onPainted: () => void) {
  const mountedAt = useRef<number | null>(null);
  if (mountedAt.current === null) mountedAt.current = performance.now();
  const completed = useRef(false);
  const started = useRef(false);
  const callback = useRef(onPainted);
  callback.current = onPainted;

  useEffect(() => {
    if (!started.current && typeof performance.mark === 'function') {
      started.current = true;
      performance.mark('baitly.planning.mount', { startTime: mountedAt.current! });
    }
  }, []);

  useEffect(() => {
    if (!ready || completed.current) return;
    let first = 0;
    let second = 0;
    let disposed = false;
    const cancel = () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    const record = () => {
      if (disposed || completed.current || document.visibilityState === 'hidden') return;
      completed.current = true;
      const now = performance.now();
      if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
        performance.mark('baitly.planning.ready');
        performance.measure('baitly.planning.mount-to-ready', { start: mountedAt.current!, end: now });
        // Navigation-to-ready includes boot/SSO only for a direct planning document load.
        const navigation = performance.getEntriesByType('navigation')[0];
        const firstMount = performance.getEntriesByName('baitly.planning.mount', 'mark').length === 1;
        if (firstMount && navigation && new URL(navigation.name, location.href).pathname === '/planning') {
          performance.measure('baitly.planning.navigation-to-ready', { start: navigation.startTime, end: now });
        }
      }
      callback.current();
    };
    const schedule = () => {
      cancel();
      if (disposed || document.visibilityState === 'hidden') return;
      first = requestAnimationFrame(() => { second = requestAnimationFrame(record); });
    };
    if (typeof performance.mark === 'function') performance.mark('baitly.planning.data-ready');
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      disposed = true;
      cancel();
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [ready]);
}
