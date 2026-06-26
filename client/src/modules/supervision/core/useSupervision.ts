/* ============================================================
   useSupervision — pilote temps réel de la constellation

   Cycle de vie (data-contract §2) :
   - chargement : getSnapshot (le ciel « s'allume »)
   - en direct  : abonnement au flux, application des events
   - hors-ligne : connection=false OU échec du snapshot → ciel terni,
                  tentative de reconnexion (re-getSnapshot + flux conservé)

   Le provider est créé/détruit par le hook (lifecycle owné), recréé
   quand `deps` change (changement de logement / portée).
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { applyStreamEvent } from './applyStreamEvent';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, AutonomyLevel, PendingOutcome, StreamEvent, SupervisionSnapshot } from '../types';

export type SupervisionStatus = 'loading' | 'live' | 'offline';

export interface SupervisionActions {
  validatePending: (actionId: string) => Promise<void>;
  editPending: (actionId: string) => Promise<void>;
  setGlobalAutonomy: (level: AutonomyLevel) => Promise<void>;
  setAgentAutonomy: (agentId: AgentId, level: AutonomyLevel) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  /** Déclenche un run depuis un message opérateur (chemin live). No-op si non supporté. */
  kickoff: (message: string) => Promise<void>;
  /** Tranche l'action sensible en attente (carte inline) : valider (true) / refuser (false). */
  resolvePendingAction: (confirmed: boolean) => Promise<void>;
}

export interface SupervisionController {
  status: SupervisionStatus;
  snapshot: SupervisionSnapshot | null;
  retry: () => void;
  actions: SupervisionActions;
  /** true si le provider courant sait déclencher un run (barre de chat live). */
  canKickoff: boolean;
}

export interface UseSupervisionOptions {
  /** Délai entre deux tentatives de reconnexion (ms). */
  reconnectDelayMs?: number;
  /** Notifié quand un agent agit sur une réservation (→ comète, Phase 5). */
  onActing?: (agentId: AgentId, reservationId: string) => void;
  /** Notifié à chaque résolution d'action (concurrence multi-opérateur / expiration). */
  onResolved?: (actionId: string, outcome: PendingOutcome, by?: string) => void;
}

const noopAsync = () => Promise.resolve();

export function useSupervision(
  factory: () => SupervisionProvider,
  deps: unknown[],
  options: UseSupervisionOptions = {},
): SupervisionController {
  const [status, setStatus] = useState<SupervisionStatus>('loading');
  const [snapshot, setSnapshot] = useState<SupervisionSnapshot | null>(null);
  const [canKickoff, setCanKickoff] = useState(false);

  const providerRef = useRef<SupervisionProvider | null>(null);
  const reloadRef = useRef<() => void>(() => {});
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const onActingRef = useRef(options.onActing);
  onActingRef.current = options.onActing;
  const onResolvedRef = useRef(options.onResolved);
  onResolvedRef.current = options.onResolved;
  const reconnectDelay = options.reconnectDelayMs ?? 3000;

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const provider = factoryRef.current();
    providerRef.current = provider;
    setStatus('loading');
    setSnapshot(null);
    setCanKickoff(typeof provider.kickoff === 'function');

    const scheduleRetry = () => {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(load, reconnectDelay);
    };

    function load() {
      provider
        .getSnapshot()
        .then((snap) => {
          if (cancelled) return;
          setSnapshot(snap);
          if (snap.online) {
            setStatus('live');
          } else {
            setStatus('offline');
            scheduleRetry();
          }
        })
        .catch(() => {
          if (cancelled) return;
          setStatus('offline');
          scheduleRetry();
        });
    }
    reloadRef.current = load;

    const unsubscribe = provider.subscribe((event: StreamEvent) => {
      if (cancelled) return;
      if (event.type === 'connection') {
        if (event.online) {
          load(); // reprise → re-snapshot puis on reste abonné
        } else {
          setStatus('offline');
          setSnapshot((prev) => (prev ? applyStreamEvent(prev, event) : prev));
        }
        return;
      }
      if (event.type === 'agent.acting') {
        onActingRef.current?.(event.agentId, event.reservationId);
      }
      if (event.type === 'pending.resolved') {
        onResolvedRef.current?.(event.actionId, event.outcome, event.by);
      }
      setSnapshot((prev) => (prev ? applyStreamEvent(prev, event) : prev));
    });

    load();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      unsubscribe();
      provider.dispose();
      providerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    status,
    snapshot,
    canKickoff,
    retry: () => reloadRef.current(),
    actions: {
      validatePending: (id) => providerRef.current?.validatePending(id) ?? noopAsync(),
      editPending: (id) => providerRef.current?.editPending(id) ?? noopAsync(),
      setGlobalAutonomy: (level) => providerRef.current?.setGlobalAutonomy(level) ?? noopAsync(),
      setAgentAutonomy: (agentId, level) => providerRef.current?.setAgentAutonomy(agentId, level) ?? noopAsync(),
      setPaused: (paused) => providerRef.current?.setPaused(paused) ?? noopAsync(),
      kickoff: (message) => providerRef.current?.kickoff?.(message) ?? noopAsync(),
      resolvePendingAction: (confirmed) =>
        providerRef.current?.resolvePendingAction?.(confirmed) ?? noopAsync(),
    },
  };
}
