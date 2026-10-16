import { useEffect, useState } from 'react';

/**
 * Vrai une fois `ready` atteint ET le navigateur au repos (ou au plus tard `timeoutMs` après).
 * Sert à différer les requêtes secondaires d'un écran (indicateurs, calques) : elles ne
 * disputent plus au premier rendu ni le fil principal ni le backend.
 */
export function useIdleReady(ready: boolean, timeoutMs = 800): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!ready || idle) return;
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setIdle(true), { timeout: timeoutMs });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(() => setIdle(true), Math.min(timeoutMs, 300));
    return () => window.clearTimeout(timer);
  }, [ready, idle, timeoutMs]);
  return idle;
}
