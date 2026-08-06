/* ============================================================
   <PortfolioPanel> — vue d'ensemble (portefeuille)

   Le sujet de cet écran est le PARC, pas les agents. Il répond à une
   question : « où dois-je agir ? ». La colonne de gauche est donc la liste
   des logements, triée par ce qui presse ; la colonne de droite ouvre le
   logement choisi.

   La constellation a été retirée d'ici. En agrégat elle ne portait qu'un
   compte de logements par agent, pour 1133 px de large et un bas qui passait
   sous la ligne de flottaison ; les agents restent présents en rangée de
   filtres, où ils servent enfin à quelque chose.
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';

import { Badge, Skeleton, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import StatTile from '../../../components/baitly/StatTile';
import StatTileRow from '../../../components/baitly/StatTileRow';
import EmptyState from '../../../components/baitly/EmptyState';
import { Bolt, CheckCircle, HomeWork, Schedule } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useSupervisionReport } from '../core/useSupervisionReport';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { PendingQueue } from './PendingQueue';
import { ActivityFeed } from './ActivityFeed';
import { SupervisionReportStrip } from './SupervisionReportStrip';
import { ResolutionToasts } from './ResolutionToasts';
import { AgentDrawer, type AgentDetail } from './AgentDrawer';
import { PriceAdjustmentModal } from './PriceAdjustmentModal';
import { AGENT_META } from '../constants';
import { AgentIcon } from '../renderers/agentIcon';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PendingAction, PortfolioPendingAction, PortfolioSnapshot } from '../types';

export interface PortfolioPanelProps {
  createProvider: () => SupervisionProvider;
  deps: unknown[];
  onEditAction?: (actionId: string) => void;
}

/** Un logement du parc, tel que cet écran le regarde. */
interface PropertyRow {
  id: string;
  name: string;
  /** Ce qui attend une décision ici. */
  actions: PortfolioPendingAction[];
  /** Agents qui ont quelque chose en cours ou en attente sur ce logement. */
  agents: AgentId[];
  /** Échéance la plus proche parmi les actions (ms), null si rien n'expire. */
  nextDeadline: number | null;
  /** Ce qu'un agent y fait en ce moment, s'il se passe quelque chose. */
  activity: string | null;
}

/** « dans 4 h », « dans 12 min », « expiré » — l'échéance en un coup d'œil. */
function formatDeadline(
  at: number | null,
  now: number,
  labels: { expired: string; in: string; min: string; hour: string; day: string },
): string | null {
  if (at == null) return null;
  const minutes = Math.round((at - now) / 60000);
  if (minutes <= 0) return labels.expired;
  if (minutes < 60) return `${labels.in} ${minutes} ${labels.min}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${labels.in} ${hours} ${labels.hour}`;
  return `${labels.in} ${Math.round(hours / 24)} ${labels.day}`;
}

/**
 * Attente : la FORME de l'écran, pas un logo qui tourne. Les tuiles, la rangée
 * de filtres et les deux colonnes sont déjà à leur place — rien ne saute quand
 * les données arrivent.
 */
function PortfolioSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      aria-label={t('supervision.states.loading')}
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div className="grid shrink-0 grid-cols-2 gap-3 min-[900px]:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
      <div className="flex shrink-0 gap-1.5 overflow-hidden">
        {[96, 128, 104, 112, 88, 120].map((w, i) => (
          <Skeleton key={i} className="h-7 shrink-0 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 min-[900px]:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-2 rounded-xl border border-solid border-border bg-card p-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-3 rounded-xl border border-solid border-border bg-card p-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PortfolioPanel({ createProvider, deps, onEditAction }: PortfolioPanelProps) {
  const { t } = useTranslation();
  const { toasts, markInFlight, onResolved } = useResolutionToasts();
  const { status, snapshot, actions } = useSupervision(createProvider, deps, { onResolved });
  const { report } = useSupervisionReport();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [selected, setSelected] = useState<AgentId | null>(null);
  /** Filtre par agent — null = tout le parc. */
  const [agentFilter, setAgentFilter] = useState<AgentId | null>(null);
  /** Logement ouvert à droite. */
  const [openProperty, setOpenProperty] = useState<string | null>(null);
  const [rightView, setRightView] = useState<'queue' | 'activity' | 'report'>('queue');

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
  const [priceAction, setPriceAction] = useState<PortfolioPendingAction | null>(null);
  const handleAdjustPrice = useCallback(
    (a: PendingAction | PortfolioPendingAction) => setPriceAction(a as PortfolioPendingAction),
    [],
  );

  const detail: AgentDetail | null = useMemo(() => {
    if (!selected || !snapshot || snapshot.scope !== 'portfolio') return null;
    const rollup = snapshot.agents.find((a) => a.id === selected);
    return rollup ? { id: rollup.id, status: rollup.status, task: rollup.task, items: rollup.items } : null;
  }, [selected, snapshot]);

  const portfolio = snapshot && snapshot.scope === 'portfolio' ? snapshot : null;

  /**
   * Le parc, reconstruit logement par logement à partir des deux sources qui
   * le mentionnent : la file d'actions et la ventilation de chaque agent.
   * Trié par ce qui presse — nb de décisions, puis échéance la plus proche.
   */
  const rows = useMemo<PropertyRow[]>(() => {
    if (!portfolio) return [];
    const byId = new Map<string, PropertyRow>();
    const touch = (id: string, name: string) => {
      let row = byId.get(id);
      if (!row) {
        row = { id, name, actions: [], agents: [], nextDeadline: null, activity: null };
        byId.set(id, row);
      }
      return row;
    };

    for (const action of portfolio.pending) {
      const row = touch(action.propertyId, action.propertyName);
      row.actions.push(action);
      if (!row.agents.includes(action.agentId)) row.agents.push(action.agentId);
    }
    for (const agent of portfolio.agents) {
      for (const item of agent.items) {
        const row = touch(item.propertyId, item.propertyName);
        if (!row.agents.includes(agent.id)) row.agents.push(agent.id);
        if (!row.activity && item.status !== 'veille') row.activity = item.task;
      }
    }
    for (const row of byId.values()) {
      const times = row.actions
        .map((a) => new Date(a.expiresAt).getTime())
        .filter((n) => Number.isFinite(n));
      row.nextDeadline = times.length > 0 ? Math.min(...times) : null;
    }

    return [...byId.values()].sort(
      (a, b) =>
        b.actions.length - a.actions.length
        || (a.nextDeadline ?? Number.POSITIVE_INFINITY) - (b.nextDeadline ?? Number.POSITIVE_INFINITY)
        || a.name.localeCompare(b.name),
    );
  }, [portfolio]);

  /** Nombre d'actions par agent — alimente les compteurs de la rangée de filtres. */
  const countByAgent = useMemo(() => {
    const counts = new Map<AgentId, number>();
    for (const action of portfolio?.pending ?? []) {
      counts.set(action.agentId, (counts.get(action.agentId) ?? 0) + 1);
    }
    return counts;
  }, [portfolio]);

  const visibleRows = useMemo(
    () => (agentFilter ? rows.filter((r) => r.agents.includes(agentFilter)) : rows),
    [rows, agentFilter],
  );

  // Sélection DÉRIVÉE, pas un effet : quand le filtre change, le logement ouvert
  // peut sortir de la liste — on retombe alors sur le premier, sans re-rendu en
  // deux temps ni état à resynchroniser.
  const activeRow =
    visibleRows.find((r) => r.id === openProperty) ?? visibleRows[0] ?? null;

  const activeActions = useMemo(() => {
    if (!activeRow) return [];
    return agentFilter ? activeRow.actions.filter((a) => a.agentId === agentFilter) : activeRow.actions;
  }, [activeRow, agentFilter]);

  const activeFeed = useMemo(
    () => (portfolio && activeRow ? portfolio.feed.filter((e) => e.propertyName === activeRow.name) : []),
    [portfolio, activeRow],
  );

  if (status === 'loading' || !portfolio) {
    return <PortfolioSkeleton />;
  }

  const now = Date.now();
  const pendingTotal = portfolio.pending.length;
  const deadlineLabels = {
    expired: t('supervision.hitl.expired', 'expiré'),
    in: t('supervision.portfolio.in', 'dans'),
    min: t('supervision.hitl.unitMin', 'min'),
    hour: t('supervision.hitl.unitHour', 'h'),
    day: t('supervision.portfolio.dayUnit', 'j'),
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" ref={rootRef}>
      {/* ── Ce que les agents ont fait gagner, en quatre nombres ────────────── */}
      <StatTileRow columns={4} className="shrink-0">
        <StatTile
          icon={<HomeWork />}
          label={t('supervision.portfolio.properties', 'Logements pilotés')}
          value={portfolio.propertyCount}
        />
        <StatTile
          icon={<CheckCircle />}
          label={t('supervision.portfolio.pendingLabel', 'À valider')}
          value={pendingTotal}
          iconClassName={pendingTotal > 0 ? 'text-warning' : 'text-success'}
        />
        <StatTile
          icon={<Schedule />}
          label={t('supervision.report.timeSaved', 'Temps gagné')}
          value={report?.estimatedTimeSaved ?? '—'}
        />
        <StatTile
          icon={<Bolt />}
          label={t('supervision.report.autoActions', 'Actions auto')}
          value={report?.autoActions ?? '—'}
        />
      </StatTileRow>

      {/* ── Alertes de niveau parc : elles ne visent aucun logement, elles
             restent donc en bandeau, au-dessus de la liste. ───────────────── */}
      {(portfolio.orgAlerts?.length ?? 0) > 0 && (
        <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-solid border-border bg-card px-3 py-2.5">
          {portfolio.orgAlerts!.map((alert, i) => (
            <div className="flex items-start gap-1.5" key={`${alert.title}-${i}`}>
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-2 shrink-0 rounded-full',
                  alert.severity === 'critical'
                    ? 'bg-destructive'
                    : alert.severity === 'warning'
                      ? 'bg-warning'
                      : 'bg-info',
                )}
              />
              <div className="min-w-0">
                <p className="m-0 text-xs leading-snug font-medium text-foreground">{alert.title}</p>
                <p className="m-0 text-2xs leading-snug text-muted-foreground">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Les agents en rangée de filtres. Ils ne dessinent plus un anneau :
             ils découpent le parc. ─────────────────────────────────────────── */}
      {/* Onze pastilles : en étroit elles occupaient CINQ lignes, 280 px sur un
          écran de 812. Une seule rangée qui défile, comme la rangée de tuiles. */}
      <div
        className="flex shrink-0 snap-x items-center gap-1.5 overflow-x-auto pb-1 [&>button]:shrink-0 [&>button]:snap-start min-[900px]:flex-wrap min-[900px]:overflow-visible min-[900px]:pb-0"
        role="group"
        aria-label={t('supervision.hud.agents', 'agents')}
      >
        <button
          type="button"
          aria-pressed={agentFilter === null}
          onClick={() => setAgentFilter(null)}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
            agentFilter === null
              ? 'border-primary/35 bg-primary-soft text-primary'
              : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {t('supervision.portfolio.allAgents', 'Tous les agents')}
          <span className="tabular-nums opacity-70">{pendingTotal}</span>
        </button>
        {portfolio.agents.map((agent) => {
          const count = countByAgent.get(agent.id) ?? 0;
          const on = agentFilter === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              aria-pressed={on}
              onClick={() => setAgentFilter(on ? null : agent.id)}
              className={cn(
                'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                on
                  ? 'border-primary/35 bg-primary-soft text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                agent.status === 'veille' && !on && 'opacity-70',
              )}
            >
              <span style={{ color: AGENT_META[agent.id].color }} className="flex shrink-0">
                <AgentIcon token={AGENT_META[agent.id].icon} size={13} />
              </span>
              {t(AGENT_META[agent.id].nameKey)}
              {count > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning-soft px-1 text-2xs font-bold text-warning-ink tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Le parc à gauche, le logement ouvert à droite. Chaque colonne défile
             pour elle-même : l'écran entier tient dans sa hauteur. ─────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 min-[900px]:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-solid border-border bg-card">
          {/* « 5 sur 8 » et non « 5 » : la liste ne montre que les logements où
              il se passe quelque chose, la tuile compte tout le parc. Sans le
              total, l'écart entre les deux passerait pour une incohérence. */}
          <p className="m-0 shrink-0 border-b border-solid border-border px-3 py-2 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
            {visibleRows.length < portfolio.propertyCount
              ? `${visibleRows.length} ${t('supervision.portfolio.outOf', 'sur')} ${portfolio.propertyCount} `
              : `${visibleRows.length} `}
            {t('supervision.portfolio.propertiesShort', 'logements')}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto" data-vertical-scroll>
            {visibleRows.length === 0 ? (
              <EmptyState
                variant="transparent"
                icon={<CheckCircle className="text-success" />}
                title={t('supervision.portfolio.emptyList', 'Aucun logement concerné')}
              />
            ) : (
              visibleRows.map((row) => {
                const on = activeRow?.id === row.id;
                const deadline = formatDeadline(row.nextDeadline, now, deadlineLabels);
                return (
                  <button
                    key={row.id}
                    type="button"
                    aria-current={on}
                    onClick={() => setOpenProperty(row.id)}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-2 border-b border-solid border-border px-3 py-2.5 text-start transition-colors last:border-b-0',
                      on ? 'bg-primary-soft' : 'hover:bg-muted',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('m-0 truncate text-xs font-semibold', on ? 'text-primary' : 'text-foreground')}>
                        {row.name}
                      </p>
                      <p className="m-0 truncate text-2xs text-muted-foreground">
                        {row.activity ?? t('supervision.states.idle', 'En veille')}
                        {deadline && ` · ${deadline}`}
                      </p>
                      {/* Les agents concernés, en pastilles de marque : on voit
                          d'un coup d'œil QUI travaille sur ce logement. */}
                      {row.agents.length > 0 && (
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {row.agents.slice(0, 5).map((id) => (
                            <span
                              key={id}
                              title={t(AGENT_META[id].nameKey)}
                              className="flex size-4 items-center justify-center rounded-full"
                              style={{ background: `${AGENT_META[id].color}1F`, color: AGENT_META[id].color }}
                            >
                              <AgentIcon token={AGENT_META[id].icon} size={10} />
                            </span>
                          ))}
                          {row.agents.length > 5 && (
                            <span className="text-2xs text-muted-foreground tabular-nums">
                              +{row.agents.length - 5}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {row.actions.length > 0 && (
                      <Badge variant="warning" className="shrink-0 tabular-nums">
                        {row.actions.length}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-solid border-border bg-card">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-solid border-border px-3 py-2">
            <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {activeRow?.name ?? t('supervision.portfolio.noProperty', 'Aucun logement')}
            </p>
            <ToggleGroup
              type="single"
              size="sm"
              value={rightView}
              onValueChange={(v) => v && setRightView(v as typeof rightView)}
              className="shrink-0"
            >
              {/* Libellés COURTS : `supervision.queue.title` vaut « Attend ta
                  validation », trop long pour un onglet. */}
              <ToggleGroupItem value="queue" className="text-xs">
                {t('supervision.board.queueTitle', 'À valider')}
              </ToggleGroupItem>
              <ToggleGroupItem value="activity" className="text-xs">
                {t('supervision.board.activity', 'Activité')}
              </ToggleGroupItem>
              <ToggleGroupItem value="report" className="text-xs">
                {t('supervision.report.titleBase', 'Bilan')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3" data-vertical-scroll data-tethers-viewport>
            {rightView === 'queue' && (
              <PendingQueue
                actions={activeActions}
                onValidate={handleValidate}
                onEdit={handleEdit}
                onAdjustPrice={handleAdjustPrice}
                variant="panel"
              />
            )}
            {rightView === 'activity' && (
              activeFeed.length > 0 ? (
                <ActivityFeed entries={activeFeed} pending={activeActions} />
              ) : (
                <EmptyState
                  variant="transparent"
                  icon={<CheckCircle className="text-muted-foreground" />}
                  title={t('supervision.feed.emptyProperty', 'Rien à signaler sur ce logement')}
                />
              )
            )}
            {/* Le bilan reste de niveau PARC — le titre le dit, la colonne est
                partagée. C'est la seule surface de cet écran qui ne parle pas
                du logement ouvert. */}
            {rightView === 'report' && <SupervisionReportStrip />}
          </div>
        </section>
      </div>

      {toasts.length > 0 && (
        <div
          className="absolute top-[16px] start-[50%] z-[8] flex flex-col items-center gap-1.5"
          style={{ transform: 'translateX(-50%)' }}
        >
          <ResolutionToasts toasts={toasts} />
        </div>
      )}

      <AgentDrawer open={Boolean(selected)} detail={detail} onClose={() => setSelected(null)} />

      {priceAction && (
        <PriceAdjustmentModal
          suggestionId={priceAction.id}
          propertyId={Number(priceAction.propertyId ?? 0)}
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
