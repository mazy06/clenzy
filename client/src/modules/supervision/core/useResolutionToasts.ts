/* ============================================================
   useResolutionToasts — concurrence multi-opérateur / expiration

   Distingue les résolutions que J'AI initiées (pas de bandeau) de celles
   venues d'ailleurs (autre opérateur / expiration) → bandeau transitoire.
   Mutualisé entre la vue par logement et la vue d'ensemble.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingOutcome } from '../types';

export interface ResolutionToast {
  key: number;
  kind: 'conflict' | 'expired';
  by?: string;
}

export interface ResolutionToastsController {
  toasts: ResolutionToast[];
  /** À appeler juste avant une action locale (validate/edit) pour ne pas s'auto-notifier. */
  markInFlight: (actionId: string) => void;
  /** À passer en `onResolved` de useSupervision. */
  onResolved: (actionId: string, outcome: PendingOutcome, by?: string) => void;
}

const DISMISS_MS = 4500;

export function useResolutionToasts(): ResolutionToastsController {
  const inFlight = useRef<Set<string>>(new Set());
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [toasts, setToasts] = useState<ResolutionToast[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const markInFlight = useCallback((actionId: string) => {
    inFlight.current.add(actionId);
  }, []);

  const onResolved = useCallback((actionId: string, outcome: PendingOutcome, by?: string) => {
    if (inFlight.current.has(actionId)) {
      inFlight.current.delete(actionId); // résolution initiée par moi → pas de bandeau
      return;
    }
    const toast: ResolutionToast = { key: ++seq.current, kind: outcome === 'expired' ? 'expired' : 'conflict', by };
    setToasts((prev) => [...prev, toast]);
    const id = setTimeout(() => setToasts((prev) => prev.filter((x) => x.key !== toast.key)), DISMISS_MS);
    timers.current.push(id);
  }, []);

  return { toasts, markInFlight, onResolved };
}
