import { useState, useEffect, useRef } from 'react';

/**
 * Coordinates dashboard readiness across multiple independent widget data sources.
 *
 * Instead of each widget showing its own skeleton independently (causing sequential pop-in),
 * this hook tracks when ALL critical above-the-fold widgets have finished their initial load.
 * The dashboard skeleton stays visible until everything is ready, then switches instantly.
 *
 * Usage:
 *   const { isReady, markReady } = useDashboardReady(['kpis', 'services', 'sidebar']);
 *   // Pass markReady('services') callback to ServicesStatusWidget
 *   // Show skeleton until isReady === true
 */

type ReadyKey = string;

export function useDashboardReady(requiredKeys: ReadyKey[]) {
  const [readySet, setReadySet] = useState<Set<ReadyKey>>(new Set());
  const requiredRef = useRef(requiredKeys);

  // Stable callback that widgets call when their data is loaded
  const markReady = (key: ReadyKey) => {
    setReadySet((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const isReady = requiredRef.current.every((k) => readySet.has(k));

  return { isReady, markReady };
}
