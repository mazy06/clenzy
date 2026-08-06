/* ============================================================
   <SupervisionPanel> — vue PAR LOGEMENT (temps réel)

   - chargement → ConstellationSkeleton
   - en direct  → AgentConstellation + file HITL flottante (haut-droite) + comète
   - hors-ligne → constellation ternie + chip de reconnexion

   Concurrence multi-opérateur / expiration → bandeaux (useResolutionToasts).
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { WifiOff, Replay, Radar, GridView, Orbit, ViewList } from '../../../icons';
import { runSupervisionScan } from '../useSupervisionConfig';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useSupervisionReport } from '../core/useSupervisionReport';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { spawnComet } from '../core/spawnComet';
import { AGENT_META } from '../constants';
import { ConstellationSkeleton } from './ConstellationSkeleton';
import { AgentConstellation, normalizeSnapshot } from './AgentConstellation';
import { OrbitConstellation, REPORT_WINDOWS } from '../renderers/OrbitConstellation';
import { OrbitDiagram, busiestAgent } from '../renderers/OrbitDiagram';
import { ConstellationQueue } from './ConstellationQueue';
import { ConstellationAgentCards } from './ConstellationAgentCards';
import { SupervisionTethers } from './SupervisionTethers';
import { ActivityFeed } from './ActivityFeed';
import { TaskDeckQueue } from './TaskDeckQueue';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
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

/**
 * Demande opérateur → orchestrateur, émise par le CHAMP UNIQUE du header
 * (Planning branche « Demandez quelque chose aux agents… » dessus quand la
 * constellation est ouverte — la barre de chat dédiée a disparu, c'était un
 * doublon). detail: { text }. Les réponses arrivent dans le feed (entrées
 * orchestrateur).
 */
export const SUPERVISION_ASK_EVENT = 'supervision:ask';

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
  // Agent stabilisé à l'emplacement de tête (diagramme) → attaches vers ses
  // cartes HITL de la file en colonne.
  const [headAgent, setHeadAgent] = useState<AgentId | null>(null);
  // Sélection du tableau à plat (vue large) : l'agent dont la file est ouverte.
  const [boardAgent, setBoardAgent] = useState<AgentId | null>(null);
  // Vue du tableau : constellation (diagramme + attaches), cartes par agent,
  // ou activité — le feed vit UNIQUEMENT ici, centralisé.
  const [boardView, setBoardView] = useState<'cards' | 'orbit' | 'feed'>('orbit');
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

  // Demande opérateur → run du moteur multi-agent, reçue du CHAMP UNIQUE du
  // header (SUPERVISION_ASK_EVENT) — la barre de chat dédiée était un doublon.
  // Les réponses de l'orchestrateur arrivent dans le feed.
  useEffect(() => {
    if (!canKickoff) return;
    const handler = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text && text.trim()) void actions.kickoff(text);
    };
    window.addEventListener(SUPERVISION_ASK_EVENT, handler);
    return () => window.removeEventListener(SUPERVISION_ASK_EVENT, handler);
  }, [canKickoff, actions]);

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

  // Vue normalisée (agents + compteurs) pour le tableau à plat — même
  // dérivation que la constellation (compteur d'attente par agent inclus).
  const normalized = useMemo(() => (snapshot ? normalizeSnapshot(snapshot) : null), [snapshot]);

  // Le tableau s'ouvre sur l'agent le plus chargé et SUIT les mises à jour du
  // flux (le premier snapshot arrive souvent avant la file — se figer dessus
  // ouvrait la file d'un agent à zéro). Dès que l'opérateur clique, sa
  // sélection devient souveraine.
  const boardAgentPicked = useRef(false);
  useEffect(() => {
    if (boardAgentPicked.current || !normalized || normalized.agents.length === 0) return;
    const busiest = busiestAgent(normalized.agents);
    if (busiest) setBoardAgent((prev) => (prev === busiest ? prev : busiest));
  }, [normalized]);

  const selectBoardAgent = useCallback(
    (id: AgentId) => {
      boardAgentPicked.current = true;
      setBoardAgent(id);
      onSelectAgent?.(id);
    },
    [onSelectAgent],
  );

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
                className="size-[26px] text-primary hover:bg-primary-soft hover:text-primary"
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
  const feedPending = propertySnapshot?.pending;
  const belowHud = useMemo(
    () =>
      feed ? (
        <div className="flex flex-col min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-feed-card>
          {/* data-feed-title : masqué dans le tiroir compact (titre déjà en en-tête). */}
          <div className="px-2.5 pt-2 pb-1 text-xs font-semibold text-foreground" data-feed-title>
            {t('supervision.feed.title')}
          </div>
          {/* data-vertical-scroll : le planning ne détourne PAS la molette
              au-dessus de cette zone (cf. useInfiniteTimeline) ; overscroll
              contain : le scroll ne chaîne pas non plus à la page au bord. */}
          <div data-vertical-scroll className="px-1.5 pb-1.5 overflow-y-auto min-h-0 overscroll-contain">
            {feed.length > 0 ? (
              <ActivityFeed entries={feed} pending={feedPending} />
            ) : (
              <p className="m-0 px-1.5 py-3 text-center text-xs leading-relaxed text-muted-foreground">
                {t(
                  'supervision.feed.emptyOnboarding',
                  'Les agents observent ce logement. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                )}
              </p>
            )}
          </div>
        </div>
      ) : undefined,
    [feed, feedPending, t],
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
      {compact ? (
        /* Étroit : constellation en canvas + rail de pastilles + tiroirs —
           le renderer porte toute la présentation. */
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
          compact
          hitl={hitlContent}
          hitlCount={pendingCount}
        />
      ) : (
        /* Large : la mise en page À PLAT de la projection — en-tête léger,
           diagramme posé sur le fond de page + file en colonne à droite,
           attaches entre les deux. AUCUN défilement global : l'en-tête et le
           diagramme restent fixes, seules la file (cartes HITL) et l'activité
           défilent dans leur propre colonne. */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 min-[900px]:p-4">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Titre, badge et compteurs sur UNE ligne (ils ne se replient
                qu'en cas de manque de place) : deux lignes empilaient de l'air
                au-dessus de la constellation sans rien dire de plus. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-foreground">
                {t('supervision.board.title', "Constellation d'agents")}
                {pendingCount > 0 && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning-ink tabular-nums">
                    {pendingCount} {t('supervision.board.toValidate', 'à valider')}
                  </span>
                )}
              </h2>
              <p className="m-0 text-xs text-muted-foreground">
                {normalized?.hud.agentsCount} {t('supervision.hud.agents')} · {normalized?.hud.actingCount} {t('supervision.hud.acting')} ·{' '}
                {status === 'live' ? t('supervision.hud.active') : t('supervision.states.offline')}
              </p>
            </div>
            {/* Segmenté cartes/constellation sur rail teinté (projection) +
                règles d'autonomie (Paramètres > IA) + scanner. */}
            <ToggleGroup
              type="single"
              size="sm"
              spacing={0}
              value={boardView}
              onValueChange={(next) => next && setBoardView(next as 'cards' | 'orbit' | 'feed')}
              className="rounded-md bg-muted p-0.5"
            >
              <ToggleGroupItem
                value="cards"
                aria-label={t('supervision.board.cardsView', 'Vue cartes')}
                title={t('supervision.board.cardsView', 'Vue cartes')}
                className="data-[state=on]:bg-card"
              >
                <GridView size={15} strokeWidth={1.75} />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="orbit"
                aria-label={t('supervision.board.orbitView', 'Vue constellation')}
                title={t('supervision.board.orbitView', 'Vue constellation')}
                className="data-[state=on]:bg-card"
              >
                <Orbit size={15} strokeWidth={1.75} />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="feed"
                aria-label={t('supervision.board.activity', 'Activité')}
                title={t('supervision.board.activity', 'Activité')}
                className="data-[state=on]:bg-card"
              >
                <ViewList size={15} strokeWidth={1.75} />
              </ToggleGroupItem>
            </ToggleGroup>
            {/* PAS de lien vers Paramètres > IA ici : cette page est réservée
                au pilotage plateforme (budget, clés, comportements premium) et
                tout le monde n'y a pas accès. Ce qui concerne l'exploitant —
                l'autonomie de chaque agent — se règle dans la vue Agents. */}
            {headerAction}
          </div>

          {boardView === 'orbit' ? (
            /* ── Vue constellation : diagramme + file reliés par les attaches,
                  bilan au pied de la SEULE colonne de gauche (la file garde
                  toute la hauteur pour ses cartes). ─────────────────────── */
            /* PAS de `relative` sur cette grille : l'overlay des attaches (SVG
               absolute inset-0) doit s'ancrer à la RACINE du panneau — le
               repère dans lequel ses coordonnées sont mesurées. Une grille
               positionnée l'interceptait et décalait tout le dessin. */
            <div className="mt-4 grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,1fr)] items-stretch gap-x-8 gap-y-6">
              {/* Colonne du diagramme : le carré prend toute la hauteur
                  restante (sans plafond), le bilan se cale sous lui, au ras du
                  bas de l'accordéon. */}
              <div className="flex min-h-0 flex-col">
                <OrbitDiagram
                  agents={normalized?.agents ?? []}
                  selected={boardAgent}
                  onSelect={selectBoardAgent}
                  flowEnabled={status === 'live' && !snapshot.paused}
                  onHeadAgentSettled={setHeadAgent}
                  pendingItems={snapshot.pending}
                  className="min-h-0 flex-1"
                />
                {/* Bilan de valeur — pied de colonne, fenêtre pilotable. */}
                {hudReport && (
                  <div className="mt-3 flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t('supervision.report.titleBase', 'Bilan')}</span>
                    <span className="flex gap-0.5" role="group" aria-label={t('supervision.report.titleBase', 'Bilan')}>
                      {REPORT_WINDOWS.map((option) => {
                        const active = reportWindow === option.days;
                        return (
                          <button
                            key={option.days}
                            type="button"
                            aria-pressed={active}
                            onClick={() => handleReportWindowChange(option.days)}
                            className={
                              active
                                ? 'cursor-pointer rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary'
                                : 'cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted'
                            }
                          >
                            {t(option.key, option.fallback)}
                          </button>
                        );
                      })}
                    </span>
                    <span><b className="font-semibold text-foreground tabular-nums">{hudReport.estimatedTimeSaved}</b> {t('supervision.report.timeSaved', 'Temps gagné').toLowerCase()}</span>
                    <span><b className="font-semibold text-foreground tabular-nums">{hudReport.autoActions}</b> {t('supervision.report.autoActions', 'Actions auto').toLowerCase()}</span>
                    <span><b className="font-semibold text-foreground tabular-nums">{Math.round(hudReport.acceptanceRate * 100)} %</b> {t('supervision.report.acceptance', 'Acceptation').toLowerCase()}</span>
                  </div>
                )}
              </div>

                {/* File — la SEULE colonne qui défile : les cartes HITL
                    montent dans leur cadre, l'en-tête et le diagramme restent
                    fixes. data-tethers-viewport : une carte défilée hors du
                    cadre perd son attache. */}
                <div
                  data-vertical-scroll
                  data-tethers-viewport
                  className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pe-1"
                >
                  {/* Approbation inline (interrupt) au-dessus de la file. */}
                  {propertySnapshot?.pendingAction && (
                    <SupervisionPendingAction action={propertySnapshot.pendingAction} onResolve={handleResolvePending} />
                  )}
                  <ConstellationQueue
                    agent={boardAgent}
                    actions={snapshot.pending}
                    onValidate={handleValidate}
                    onEdit={handleEdit}
                    onAdjustPrice={handleAdjustPrice}
                  />
                </div>

                {/* Attaches agent de tête → cartes de la file. */}
                <SupervisionTethers rootRef={rootRef} headAgent={headAgent} revision={snapshot.pending} />
            </div>
          ) : boardView === 'cards' ? (
            /* ── Vue cartes : une carte par agent (autonomie) FIXE, puis la
                  file en pleine largeur, défilant dans son cadre. Le feed vit
                  dans sa propre vue (toggle Activité). ─────────────────── */
            /* Deux colonnes, même grammaire que la vue constellation : les
               agents à gauche, ce qui attend une décision à droite — la file
               est visible d'emblée, sans défiler. Chaque colonne défile pour
               elle-même (avant, la liste était `shrink-0` dans un parent
               `overflow-hidden` : passé cinq agents elle débordait sans
               ascenseur et poussait la file hors du cadre). */
            <div className="mt-4 grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,1fr)] items-stretch gap-x-8 gap-y-6">
              <div
                data-vertical-scroll
                className="min-h-0 overflow-y-auto overscroll-contain pe-1"
              >
                <ConstellationAgentCards
                  agents={normalized?.agents ?? []}
                  feed={snapshot.feed}
                  selected={boardAgent}
                  onSelect={selectBoardAgent}
                  onAutonomyChange={(id, level) => void actions.setAgentAutonomy(id, level)}
                />
              </div>

              <div
                data-vertical-scroll
                className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pe-1"
              >
                {propertySnapshot?.pendingAction && (
                  <SupervisionPendingAction action={propertySnapshot.pendingAction} onResolve={handleResolvePending} />
                )}
                <ConstellationQueue
                  agent={boardAgent}
                  actions={snapshot.pending}
                  onValidate={handleValidate}
                  onEdit={handleEdit}
                  onAdjustPrice={handleAdjustPrice}
                />
              </div>
            </div>
          ) : (
            /* ── Vue activité : LE feed, centralisé — il n'apparaît plus dans
                  les autres vues. Liste au dessin projection en PLEINE
                  largeur, défilant dans son cadre. ─────────────────────── */
            <section className="mt-4 flex w-full flex-1 min-h-0 flex-col gap-2">
              <h2 className="m-0 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {t('supervision.board.activity', 'Activité')}
              </h2>
              {snapshot.feed.length > 0 ? (
                <div data-vertical-scroll className="min-h-0 overflow-y-auto overscroll-contain">
                  <ActivityFeed entries={snapshot.feed} pending={snapshot.pending} />
                </div>
              ) : (
                <p className="m-0 px-1 py-2 text-xs text-muted-foreground">
                  {t(
                    'supervision.feed.emptyOnboarding',
                    'Les agents observent ce logement. Leurs actions et suggestions à valider apparaîtront ici — rien n’est exécuté sans votre accord.',
                  )}
                </p>
              )}
            </section>
          )}

        </div>
      )}

      {/* bandeaux : hors-ligne + concurrence/expiration */}
      {(toasts.length > 0 || status === 'offline') && (
        <div className="absolute top-[16px] start-[50%] z-[8] flex flex-col items-center gap-1.5" style={{ transform: 'translateX(-50%)' }}>
          {status === 'offline' && (
            <div className="flex items-center gap-1.5 ps-2.5 pe-1 py-1 rounded-full bg-[rgba(20,24,58,.85)] text-[#E7E9FB] border border-[rgba(255,255,255,.12)] text-xs font-semibold" style={{ backdropFilter: 'blur(8px)', boxShadow: '0 10px 28px -14px rgba(0,0,0,.6)' }} role="status">
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

      {/* En etroit, la colonne de droite (file HITL) n'est pas rendue : le
          tiroir de l'agent devient le seul endroit ou ses cartes peuvent
          vivre. On y branche la MEME file que la colonne large, filtree sur
          l'agent ouvert. */}
      <AgentDrawer
        open={Boolean(selected)}
        detail={detail}
        onClose={() => setSelected(null)}
        propertyId={propertyId}
        queue={
          selected ? (
            <ConstellationQueue
              agent={selected}
              actions={snapshot.pending}
              onValidate={handleValidate}
              onEdit={handleEdit}
              onAdjustPrice={handleAdjustPrice}
            />
          ) : undefined
        }
      />

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
