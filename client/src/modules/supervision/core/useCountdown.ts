/* ============================================================
   useCountdown — compte à rebours d'expiration (live)

   Pour la file HITL : une action peut expirer pendant qu'on la
   regarde. Tic chaque seconde jusqu'à expiration, puis s'arrête.
   ============================================================ */

import { useEffect, useState } from 'react';

export interface Countdown {
  totalMs: number; // restant, borné à 0
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function compute(expiresAt: string): Countdown {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  const clamped = Math.max(0, remaining);
  return {
    totalMs: clamped,
    hours: Math.floor(clamped / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
    seconds: Math.floor((clamped % 60_000) / 1000),
    expired: remaining <= 0,
  };
}

export function useCountdown(expiresAt: string, tickMs = 1000): Countdown {
  const [countdown, setCountdown] = useState<Countdown>(() => compute(expiresAt));

  useEffect(() => {
    setCountdown(compute(expiresAt));
    if (new Date(expiresAt).getTime() - Date.now() <= 0) return; // déjà expiré → pas de tic
    const id = setInterval(() => {
      const next = compute(expiresAt);
      setCountdown(next);
      if (next.expired) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [expiresAt, tickMs]);

  return countdown;
}
