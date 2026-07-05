/* ============================================================
   <SupervisionPanel> — vue PAR LOGEMENT (temps réel)

   - chargement → ConstellationSkeleton
   - en direct  → AgentConstellation + file HITL flottante (haut-droite) + comète
   - hors-ligne → constellation ternie + chip de reconnexion

   Concurrence multi-opérateur / expiration → bandeaux (useResolutionToasts).
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { WifiOff, Replay, Radar } from '../../../icons';
import { runSupervisionScan } from '../useSupervisionConfig';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { spawnComet } from '../core/spawnComet';
import { AGENT_META } from '../constants';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation } from './AgentConstellation';
import { ActivityFeed } from './ActivityFeed';
import { TaskDeckQueue } from './TaskDeckQueue';
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
  /** Propriété pilotée — active le bouton « Scanner » (mode live). */
  propertyId?: number | string;
  onSelectAgent?: (id: AgentId) => void;
  /** Agent qui agit sur une réservation → comète (en plus du rendu interne). */
  onActing?: (agentId: AgentId, reservationId: string) => void;
  /** Ouvre l'éditeur métier concerné (ex. grille tarifaire) sur « Modifier ». */
  onEditAction?: (actionId: string) => void;
}

export function SupervisionPanel({ createProvider, deps, propertyId, onSelectAgent, onActing, onEditAction }: SupervisionPanelProps) {
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

  // Scan manuel (Phase 3-B.2) : revue proactive → recharge le snapshot (feed/suggestions réels).
  const [scanning, setScanning] = useState(false);
  const handleScan = useCallback(async () => {
    if (propertyId == null || scanning) return;
    setScanning(true);
    try {
      await runSupervisionScan(propertyId);
      retry(); // re-getSnapshot → reflète l'activité + suggestions produites
    } catch {
      /* échec réseau/LLM → l'opérateur peut relancer */
    } finally {
      setScanning(false);
    }
  }, [propertyId, scanning, retry]);

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
    <Box
      ref={rootRef}
      sx={{
        position: 'relative',
        // Colonne flex pleine hauteur : la constellation (flex:1) remplit
        // l'espace responsive de l'accordéon Planning et la barre de chat se
        // pose dessous. height:100% résout via la chaîne accordéon→sticky→ici
        // (hauteurs définies). Plancher pour les hôtes sans hauteur définie.
        height: '100%',
        minHeight: 380,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Scan manuel (mode live) : posé EN ICÔNE dans le HUD (haut-gauche), à
          droite du titre « Orchestrateur · actif » — plus de pastille texte
          séparée qui recouvrait la carte d'activité. */}
      <AgentConstellation
        snapshot={snapshot}
        online={status === 'live'}
        onSelectAgent={handleSelect}
        headerAction={
          canKickoff && propertyId != null ? (
            <Tooltip
              title={scanning ? t('supervision.scan.running', 'Scan en cours…') : t('supervision.scan.button', 'Scanner')}
              arrow
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handleScan}
                  disabled={scanning}
                  aria-label={t('supervision.scan.button', 'Scanner')}
                  sx={{
                    width: 26,
                    height: 26,
                    color: 'var(--accent)',
                    '&:hover': { bgcolor: 'var(--accent-soft)' },
                  }}
                >
                  {scanning ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <Radar size={16} />}
                </IconButton>
              </span>
            </Tooltip>
          ) : undefined
        }
        belowHud={
          propertySnapshot ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                bgcolor: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '13px',
                boxShadow: '0 10px 28px -18px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75, fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>
                {t('supervision.feed.title')}
              </Box>
              {/* data-vertical-scroll : le planning ne détourne PAS la molette
                  au-dessus de cette zone (cf. useInfiniteTimeline) ; overscroll
                  contain : le scroll ne chaîne pas non plus à la page au bord. */}
              <Box
                data-vertical-scroll
                sx={{ px: 1, pb: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}
              >
                {propertySnapshot.feed.length > 0 ? (
                  <ActivityFeed entries={propertySnapshot.feed} />
                ) : (
                  <Box sx={{ px: 1, py: 2, textAlign: 'center', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {t('supervision.feed.empty', 'Aucune action récente des agents')}
                  </Box>
                )}
              </Box>
            </Box>
          ) : undefined
        }
      />

      {/* Entrée de chat opérateur (chemin live) : un message déclenche un run du
          moteur multi-agent → la constellation réagit + réponse texte ci-dessous.
          Masquée en mock (le provider mock n'expose pas kickoff). */}
      {canKickoff && propertySnapshot && (
        // Barre FLOTTANTE centrée sur le canvas (registre deep-space natif) :
        // hors du flux vertical → la constellation garde toute la hauteur du
        // panneau (sinon la barre lui volait ~56px et l'écrasait). Largeur
        // bornée (plus de pleine largeur) ; posée dans le creux bas-centre
        // (aucun agent à 90° : ils sont à ±64°/±136°).
        <Box
          sx={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(440px, calc(100% - 32px))',
            zIndex: 7,
          }}
        >
          <SupervisionChatBar
            conversation={propertySnapshot.conversation ?? []}
            busy={Boolean(propertySnapshot.conversationBusy)}
            onSend={handleSend}
          />
        </Box>
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
            <TaskDeckQueue
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
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 7, maxWidth: 'calc(100% - 32px)', display: 'flex', flexDirection: 'column' }}>
          <TaskDeckQueue actions={snapshot.pending} onValidate={handleValidate} onEdit={handleEdit} variant="floating" />
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
