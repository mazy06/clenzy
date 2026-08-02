/* ============================================================
   <SupervisionPanel> — vue PAR LOGEMENT (temps réel)

   - chargement → ConstellationSkeleton
   - en direct  → AgentConstellation + file HITL flottante (haut-droite) + comète
   - hors-ligne → constellation ternie + chip de reconnexion

   Concurrence multi-opérateur / expiration → bandeaux (useResolutionToasts).
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { WifiOff, Replay, Radar } from '../../../icons';
import { runSupervisionScan } from '../useSupervisionConfig';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useSupervisionReport } from '../core/useSupervisionReport';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { spawnComet } from '../core/spawnComet';
import { AGENT_META } from '../constants';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation } from './AgentConstellation';
import { OrbitConstellation } from '../renderers/OrbitConstellation';
import { ActivityFeed } from './ActivityFeed';
import { TaskDeckQueue } from './TaskDeckQueue';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
import { SupervisionChatBar } from './SupervisionChatBar';
import { SupervisionPendingAction } from './SupervisionPendingAction';
import { PriceAdjustmentModal } from './PriceAdjustmentModal';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PendingAction, PortfolioPendingAction } from '../types';

export interface SupervisionPanelProps {
  /** Fabrique du provider (mock ou CopilotKit). Recréé quand `deps` change. */
  createProvider: () => SupervisionProvider;
  /** Identité du provider (ex. [propertyId]). */
  deps: unknown[];
  /** Propriété pilotée — active le bouton « Scanner » (mode live). */
  propertyId?: number | string;
  /** Fenêtre du bilan affiché dans le HUD (jours) — alignée sur le zoom planning. */
  reportWindowDays?: number;
  onSelectAgent?: (id: AgentId) => void;
  /** Agent qui agit sur une réservation → comète (en plus du rendu interne). */
  onActing?: (agentId: AgentId, reservationId: string) => void;
  /** Ouvre l'éditeur métier concerné (ex. grille tarifaire) sur « Modifier ». */
  onEditAction?: (actionId: string) => void;
  /** Rendu pleine-cellule (accordéon Planning) : canvas sans arrondi ni ombre. */
  flush?: boolean;
}

/** Sous cette largeur de CONTENEUR (px), les surcouches passent en mode compact
 *  (rail de pastilles + tiroir bas) pour dégager la constellation. Largeur du
 *  panneau, pas de la fenêtre : l'accordéon Planning peut être étroit sur desktop. */
const COMPACT_MAX_WIDTH = 840;

export function SupervisionPanel({ createProvider, deps, propertyId, reportWindowDays = 30, onSelectAgent, onActing, onEditAction, flush }: SupervisionPanelProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Largeur mesurée du panneau → mode compact. Callback ref (et non un effect
  // au mount) : le root n'existe pas pendant le skeleton (early return), le
  // ResizeObserver s'attache quand la vue live monte réellement.
  const [panelWidth, setPanelWidth] = useState(0);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const attachRoot = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el;
    resizeObsRef.current?.disconnect();
    resizeObsRef.current = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => setPanelWidth(el.clientWidth));
      observer.observe(el);
      resizeObsRef.current = observer;
      setPanelWidth(el.clientWidth);
    }
  }, []);
  const compact = panelWidth > 0 && panelWidth < COMPACT_MAX_WIDTH;
  // Bilan de valeur (org-scopé) affiché dans le HUD. La fenêtre suit le zoom du
  // planning par défaut, avec un sélecteur HUD (dont « Jour ») qui l'affine ; un
  // changement de zoom re-synchronise (le zoom reste le maître). L'affinage HUD
  // est stocké AVEC la fenêtre zoom pour laquelle il a été choisi : il s'évince
  // de lui-même quand le zoom change (dérivation — pas d'effet de resync).
  const [hudWindow, setHudWindow] = useState<{ forZoom: number; value: number } | null>(null);
  const reportWindow = hudWindow?.forZoom === reportWindowDays ? hudWindow.value : reportWindowDays;
  const handleReportWindowChange = useCallback(
    (value: number) => setHudWindow({ forZoom: reportWindowDays, value }),
    [reportWindowDays],
  );
  const { report } = useSupervisionReport(reportWindow);
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
  // Modale d'ajustement tarifaire (cartes PRICE_DROP multi-segment).
  const [priceAction, setPriceAction] = useState<PendingAction | PortfolioPendingAction | null>(null);
  const handleAdjustPrice = useCallback((a: PendingAction | PortfolioPendingAction) => setPriceAction(a), []);

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

  // Narrow explicite : les champs conversation/pendingAction n'existent que sur
  // le snapshot par logement (OrchestratorSnapshot). Calculé AVANT l'early
  // return : les useMemo ci-dessous en dépendent (Rules of Hooks).
  const propertySnapshot = snapshot && snapshot.scope === 'property' ? snapshot : null;

  // Props STABILISÉES (audit perf) : ces objets/éléments étaient recréés inline à
  // chaque render du panneau et cassaient le memo de tout le sous-arbre
  // constellation (FramerConstellation, ActivityFeed).
  const hudReport = useMemo(
    () =>
      report
        ? {
            windowDays: report.windowDays,
            autoActions: report.autoActions,
            acceptanceRate: report.acceptanceRate,
            estimatedTimeSaved: report.estimatedTimeSaved,
          }
        : undefined,
    [report],
  );

  const headerAction = useMemo(
    () =>
      canKickoff && propertyId != null ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Le span porte la ref que Radix pose sur son enfant (Button est une
                fonction) et reste la cible de survol quand le bouton est desactive. */}
            <span className="inline-flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleScan}
                disabled={scanning}
                aria-label={t('supervision.scan.button', 'Scanner')}
                className="size-[26px] text-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                {scanning ? <Spinner className="size-3.5" /> : <Radar size={16} />}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {scanning ? t('supervision.scan.running', 'Scan en cours…') : t('supervision.scan.button', 'Scanner')}
          </TooltipContent>
        </Tooltip>
      ) : undefined,
    [canKickoff, propertyId, scanning, handleScan, t],
  );

  const feed = propertySnapshot?.feed;
  const belowHud = useMemo(
    () =>
      feed ? (
        <div className="flex flex-col min-h-0 bg-[var(--card)] border border-solid border-[var(--line)] rounded-[13px] overflow-hidden" style={{ boxShadow: '0 10px 28px -18px rgba(0, 0, 0, 0.35)' }} data-feed-card>
          {/* data-feed-title : masqué dans le tiroir compact (titre déjà en en-tête). */}
          <div className="px-[9px] pt-[7.5px] pb-[4.5px] font-extrabold text-[12.5px] text-[var(--ink)]" data-feed-title>
            {t('supervision.feed.title')}
          </div>
          {/* data-vertical-scroll : le planning ne détourne PAS la molette
              au-dessus de cette zone (cf. useInfiniteTimeline) ; overscroll
              contain : le scroll ne chaîne pas non plus à la page au bord. */}
          <div data-vertical-scroll className="px-1.5 pb-1.5 overflow-y-auto min-h-0 overscroll-contain">
            {feed.length > 0 ? (
              <ActivityFeed entries={feed} />
            ) : (
              <div className="px-1.5 py-3 text-center text-[12px] text-[var(--muted)] leading-[1.5]">
                {t(
                  'supervision.feed.emptyOnboarding',
                  'Les agents observent ce logement. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                )}
              </div>
            )}
          </div>
        </div>
      ) : undefined,
    [feed, t],
  );

  // File HITL du mode compact : même contenu que les piles flottantes haut-droite,
  // rendu DANS le tiroir bas de la constellation (variant "panel" = pleine largeur,
  // le corps du tiroir scrolle). Un seul des deux rendus est monté à la fois.
  const pendingCount =
    (propertySnapshot ? propertySnapshot.pending.length + (propertySnapshot.pendingAction ? 1 : 0) : snapshot?.pending.length) ?? 0;
  const hitlContent = useMemo(() => {
    if (!compact) return undefined;
    if (propertySnapshot) {
      if (!propertySnapshot.pendingAction && propertySnapshot.pending.length === 0) return undefined;
      return (
        <div className="flex flex-col gap-2">
          {propertySnapshot.pendingAction && (
            <SupervisionPendingAction action={propertySnapshot.pendingAction} onResolve={handleResolvePending} />
          )}
          {propertySnapshot.pending.length > 0 && (
            <TaskDeckQueue
              actions={propertySnapshot.pending}
              onValidate={handleValidate}
              onEdit={handleEdit}
              onAdjustPrice={handleAdjustPrice}
              variant="panel"
            />
          )}
        </div>
      );
    }
    if (snapshot && snapshot.pending.length > 0) {
      return (
        <TaskDeckQueue
          actions={snapshot.pending}
          onValidate={handleValidate}
          onEdit={handleEdit}
          onAdjustPrice={handleAdjustPrice}
          variant="panel"
        />
      );
    }
    return undefined;
  }, [compact, propertySnapshot, snapshot, handleResolvePending, handleValidate, handleEdit, handleAdjustPrice]);

  if (status === 'loading' || !snapshot) {
    return <ConstellationSkeleton flush={flush} />;
  }

  return (
    <div className="relative h-full min-h-[380px] flex flex-col" ref={attachRoot}>
      {/* Scan manuel (mode live) : posé EN ICÔNE dans le HUD (haut-gauche), à
          droite du titre « Orchestrateur · actif » — plus de pastille texte
          séparée qui recouvrait la carte d'activité. */}
      <AgentConstellation
        snapshot={snapshot}
        renderer={OrbitConstellation}
        online={status === 'live'}
        flush={flush}
        onSelectAgent={handleSelect}
        report={hudReport}
        reportWindow={reportWindow}
        onReportWindowChange={handleReportWindowChange}
        headerAction={headerAction}
        belowHud={belowHud}
        compact={compact}
        hitl={hitlContent}
        hitlCount={pendingCount}
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
        <div className="absolute bottom-[14px] start-[50%] w-[min(440px,_calc(100%_-_32px))] z-[7]" style={{ transform: 'translateX(-50%)' }}>
          <SupervisionChatBar
            conversation={propertySnapshot.conversation ?? []}
            busy={Boolean(propertySnapshot.conversationBusy)}
            onSend={handleSend}
          />
        </div>
      )}

      {/* Zone flottante haut-droite (par logement) : carte d'approbation inline
          (interrupt) au-dessus de la file persistante « Attend ta validation ».
          En compact, ce contenu vit dans le tiroir « À traiter » (hitlContent). */}
      {!compact && propertySnapshot && (propertySnapshot.pendingAction || propertySnapshot.pending.length > 0) && (
        <div className="absolute top-[16px] end-[16px] z-[7] max-w-[calc(100%_-_32px)] flex flex-col gap-[7.5px]">
          {propertySnapshot.pendingAction && (
            <SupervisionPendingAction action={propertySnapshot.pendingAction} onResolve={handleResolvePending} />
          )}
          {propertySnapshot.pending.length > 0 && (
            <TaskDeckQueue
              actions={propertySnapshot.pending}
              onValidate={handleValidate}
              onEdit={handleEdit}
              onAdjustPrice={handleAdjustPrice}
              variant="floating"
            />
          )}
        </div>
      )}

      {/* file HITL flottante (vue portefeuille / autres scopes) */}
      {!compact && !propertySnapshot && snapshot.pending.length > 0 && (
        <div className="absolute top-[16px] end-[16px] z-[7] max-w-[calc(100%_-_32px)] flex flex-col">
          <TaskDeckQueue actions={snapshot.pending} onValidate={handleValidate} onEdit={handleEdit} onAdjustPrice={handleAdjustPrice} variant="floating" />
        </div>
      )}

      {/* bandeaux : hors-ligne + concurrence/expiration */}
      {(toasts.length > 0 || status === 'offline') && (
        <div className="absolute top-[16px] start-[50%] z-[8] flex flex-col items-center gap-1.5" style={{ transform: 'translateX(-50%)' }}>
          {status === 'offline' && (
            <div className="flex items-center gap-1.5 ps-[9px] pe-[3px] py-[3px] rounded-[7992px] bg-[rgba(20,24,58,.85)] text-[#E7E9FB] border border-solid border-[rgba(255,255,255,.12)] text-[12.5px] font-bold" style={{ backdropFilter: 'blur(8px)', boxShadow: '0 10px 28px -14px rgba(0,0,0,.6)' }} role="status">
              <WifiOff size={15} />
              {t('supervision.states.offline')} · {t('supervision.states.reconnecting')}
              {/* Bandeau a fond nuit : on conserve la teinte claire d'origine,
                  l'encre du ghost s'y perdrait. */}
              <Button
                variant="ghost"
                size="sm"
                onClick={retry}
                className="ms-[3px] text-[#9B9BF6] hover:text-[#9B9BF6] hover:bg-[rgba(255,255,255,.1)]"
              >
                <Replay size={14} />
                {t('supervision.states.retry')}
              </Button>
            </div>
          )}
          <ResolutionToasts toasts={toasts} />
        </div>
      )}

      <AgentDrawer open={Boolean(selected)} detail={detail} onClose={() => setSelected(null)} propertyId={propertyId} />

      {priceAction && (
        <PriceAdjustmentModal
          suggestionId={priceAction.id}
          propertyId={Number(
            (priceAction as PortfolioPendingAction).propertyId ?? propertyId ?? 0,
          )}
          actionParams={priceAction.actionParams}
          onClose={() => setPriceAction(null)}
          onApplied={() => {
            markInFlight(priceAction.id);
            setPriceAction(null);
          }}
        />
      )}
    </div>
  );
}
