/* ============================================================
   <SupervisionPanel> — vue PAR LOGEMENT (temps réel)

   - chargement → ConstellationSkeleton
   - en direct  → AgentConstellation + file HITL flottante (haut-droite) + comète
   - hors-ligne → constellation ternie + chip de reconnexion

   Concurrence multi-opérateur / expiration → bandeaux (useResolutionToasts).
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import { WifiOff, Replay } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { spawnComet } from '../core/spawnComet';
import { AGENT_META } from '../constants';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation } from './AgentConstellation';
import { PendingQueue } from './PendingQueue';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
import { SupervisionChatBar } from './SupervisionChatBar';
import { SupervisionPendingAction } from './SupervisionPendingAction';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId } from '../types';

export interface SupervisionPanelProps {
  /** Fabrique du provider (mock ou CopilotKit). Recréé quand `deps` change. */
  createProvider: () => SupervisionProvider;
  /** Identité du provider (ex. [propertyId]). */
  deps: unknown[];
  onSelectAgent?: (id: AgentId) => void;
  /** Agent qui agit sur une réservation → comète (en plus du rendu interne). */
  onActing?: (agentId: AgentId, reservationId: string) => void;
  /** Ouvre l'éditeur métier concerné (ex. grille tarifaire) sur « Modifier ». */
  onEditAction?: (actionId: string) => void;
}

export function SupervisionPanel({ createProvider, deps, onSelectAgent, onActing, onEditAction }: SupervisionPanelProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<AgentId | null>(null);
  const { toasts, markInFlight, onResolved } = useResolutionToasts();

  // « moment comète » : du nœud agent vers la cellule du planning (data-reservation-id).
  const handleActing = useCallback(
    (agentId: AgentId, reservationId: string) => {
      const source = rootRef.current?.querySelector(`[data-agent="${agentId}"]`) ?? null;
      const target = document.querySelector(`[data-reservation-id="${reservationId}"]`);
      spawnComet({ sourceEl: source, targetEl: target, color: AGENT_META[agentId].color });
      onActing?.(agentId, reservationId);
    },
    [onActing],
  );

  const { status, snapshot, retry, actions, canKickoff } = useSupervision(createProvider, deps, {
    onActing: handleActing,
    onResolved,
  });

  const handleSend = useCallback((message: string) => void actions.kickoff(message), [actions]);

  // Approbation inline (interrupt) : la décision opérateur reprend le run.
  const handleResolvePending = useCallback(
    (confirmed: boolean) => void actions.resolvePendingAction(confirmed),
    [actions],
  );

  const handleValidate = useCallback(
    (id: string) => {
      markInFlight(id);
      void actions.validatePending(id);
    },
    [actions, markInFlight],
  );
  const handleEdit = useCallback(
    (id: string) => {
      markInFlight(id);
      void actions.editPending(id);
      onEditAction?.(id);
    },
    [actions, markInFlight, onEditAction],
  );

  const handleSelect = useCallback(
    (id: AgentId) => {
      setSelected(id);
      onSelectAgent?.(id);
    },
    [onSelectAgent],
  );

  // détail agent (drawer) — par logement : tâche + métriques
  const detail: AgentDetail | null = useMemo(() => {
    if (!selected || !snapshot || snapshot.scope !== 'property') return null;
    const agent = snapshot.agents.find((a) => a.id === selected);
    return agent ? { id: agent.id, status: agent.status, task: agent.task ?? '', items: [], metrics: agent.metrics } : null;
  }, [selected, snapshot]);

  if (status === 'loading' || !snapshot) {
    return <ConstellationSkeleton />;
  }

  // Narrow explicite : les champs conversation/pendingAction n'existent que sur
  // le snapshot par logement (OrchestratorSnapshot).
  const propertySnapshot = snapshot.scope === 'property' ? snapshot : null;

  return (
    <Box ref={rootRef} sx={{ position: 'relative' }}>
      <AgentConstellation snapshot={snapshot} online={status === 'live'} onSelectAgent={handleSelect} />

      {/* Entrée de chat opérateur (chemin live) : un message déclenche un run du
          moteur multi-agent → la constellation réagit + réponse texte ci-dessous.
          Masquée en mock (le provider mock n'expose pas kickoff). */}
      {canKickoff && propertySnapshot && (
        <SupervisionChatBar
          conversation={propertySnapshot.conversation ?? []}
          busy={Boolean(propertySnapshot.conversationBusy)}
          onSend={handleSend}
        />
      )}

      {/* Zone flottante haut-droite (par logement) : carte d'approbation inline
          (interrupt) au-dessus de la file persistante « Attend ta validation ». */}
      {propertySnapshot && (propertySnapshot.pendingAction || propertySnapshot.pending.length > 0) && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 7,
            maxWidth: 'calc(100% - 32px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
          }}
        >
          {propertySnapshot.pendingAction && (
            <SupervisionPendingAction action={propertySnapshot.pendingAction} onResolve={handleResolvePending} />
          )}
          {propertySnapshot.pending.length > 0 && (
            <PendingQueue
              actions={propertySnapshot.pending}
              onValidate={handleValidate}
              onEdit={handleEdit}
              variant="floating"
            />
          )}
        </Box>
      )}

      {/* file HITL flottante (vue portefeuille / autres scopes) */}
      {!propertySnapshot && snapshot.pending.length > 0 && (
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 7, maxWidth: 'calc(100% - 32px)' }}>
          <PendingQueue actions={snapshot.pending} onValidate={handleValidate} onEdit={handleEdit} variant="floating" />
        </Box>
      )}

      {/* bandeaux : hors-ligne + concurrence/expiration */}
      {(toasts.length > 0 || status === 'offline') && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {status === 'offline' && (
            <Box
              role="status"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                pl: 1.5,
                pr: 0.5,
                py: 0.5,
                borderRadius: 999,
                bgcolor: 'rgba(20,24,58,.85)',
                color: '#E7E9FB',
                border: '1px solid rgba(255,255,255,.12)',
                backdropFilter: 'blur(8px)',
                fontSize: 12.5,
                fontWeight: 700,
                boxShadow: '0 10px 28px -14px rgba(0,0,0,.6)',
              }}
            >
              <WifiOff size={15} />
              {t('supervision.states.offline')} · {t('supervision.states.reconnecting')}
              <Button
                size="small"
                variant="text"
                onClick={retry}
                startIcon={<Replay size={14} />}
                sx={{ minWidth: 0, color: '#9B9BF6', fontWeight: 700, textTransform: 'none', ml: 0.5 }}
              >
                {t('supervision.states.retry')}
              </Button>
            </Box>
          )}
          <ResolutionToasts toasts={toasts} />
        </Box>
      )}

      <AgentDrawer open={Boolean(selected)} detail={detail} onClose={() => setSelected(null)} />
    </Box>
  );
}
