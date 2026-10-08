import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, SlidersHorizontal, ChevronDown } from '../../../icons/glyphs';
import { Badge, Skeleton, ToggleGroup, ToggleGroupItem } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import NavCountBadge from '../../../components/NavCountBadge';
import { PropertyThumbnail } from '../../../components/baitly/PropertyThumbnail';
import { useScreenSearch } from '../../../components/ScreenChrome';
import { usePropertiesList } from '../../../hooks/usePropertiesList';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSupervision } from '../core/useSupervision';
import { useSupervisionReport } from '../core/useSupervisionReport';
import { useResolutionToasts } from '../core/useResolutionToasts';
import { PendingQueue } from './PendingQueue';
import { ActivityFeed } from './ActivityFeed';
import { SupervisionReportContent } from './SupervisionReportStrip';
import { ResolutionToasts } from './ResolutionToasts';
import { PriceAdjustmentModal } from './PriceAdjustmentModal';
import { AGENT_META } from '../constants';
import { AgentPortrait } from '../renderers/AgentPortrait';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId, PendingAction, PortfolioPendingAction } from '../types';
import '../supervision-surfaces.css';
import '../../../components/baitly/widgetPanel.css';
import './portfolio-panel.css';

export interface PortfolioPanelProps {
  createProvider: () => SupervisionProvider;
  deps: unknown[];
  onEditAction?: (actionId: string) => void;
}

interface PropertyRow {
  id: string;
  name: string;
  city?: string;
  photo?: string;
  actions: PortfolioPendingAction[];
  agents: AgentId[];
  nextDeadline: number | null;
}

const searchText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();

function PortfolioSkeleton() {
  const { t } = useTranslation();
  return <div role="status" aria-busy aria-label={t('supervision.states.loading')} className="baitly-portfolio__skeleton">
    <Skeleton className="h-20 rounded-xl" />
    <Skeleton className="h-12 rounded-xl" />
    <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  </div>;
}

/** A property-first workspace. Small screens drill into one property while
 * selection, filtering and the shared action handlers remain identical. */
export function PortfolioPanel({ createProvider, deps, onEditAction }: PortfolioPanelProps) {
  const { t, currentLanguage } = useTranslation();
  const { toasts, markInFlight, onResolved } = useResolutionToasts();
  const { status, snapshot, actions, retry } = useSupervision(createProvider, deps, { onResolved });
  const { report, loading: reportLoading } = useSupervisionReport();
  // Reuse the collection cache, never one metadata request per property.
  const { properties } = usePropertiesList();
  const number = useMemo(() => new Intl.NumberFormat(currentLanguage, {
    numberingSystem: currentLanguage.startsWith('ar') ? 'arab' : 'latn',
  }), [currentLanguage]);
  const [agentFilter, setAgentFilter] = useState<AgentId | null>(null);
  const [openProperty, setOpenProperty] = useState<string | null>(null);
  const [rightView, setRightView] = useState<'queue' | 'activity' | 'report'>('queue');
  const [search, setSearch] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [priceAction, setPriceAction] = useState<PortfolioPendingAction | null>(null);
  const filtersId = useId();
  const headingId = useId();
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const propertyListRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  useScreenSearch(search, setSearch, t('supervision.portfolio.searchPlaceholder'));

  useEffect(() => {
    if (!window.matchMedia('(max-width: 899px)').matches) return;
    if (detailVisible) detailHeadingRef.current?.focus({ preventScroll: true });
    else if (returnFocus.current) {
      propertyListRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus({ preventScroll: true });
      returnFocus.current = false;
    }
  }, [detailVisible]);

  const handleValidate = useCallback((id: string) => {
    markInFlight(id);
    void actions.validatePending(id);
  }, [actions, markInFlight]);
  const handleEdit = useCallback((id: string) => {
    markInFlight(id);
    void actions.editPending(id);
    onEditAction?.(id);
  }, [actions, markInFlight, onEditAction]);
  const handleAdjustPrice = useCallback((action: PendingAction | PortfolioPendingAction) => {
    setPriceAction(action as PortfolioPendingAction);
  }, []);

  const portfolio = snapshot?.scope === 'portfolio' ? snapshot : null;
  const rows = useMemo<PropertyRow[]>(() => {
    if (!portfolio) return [];
    const byId = new Map<string, PropertyRow>();
    const touch = (id: string, name: string) => {
      let row = byId.get(id);
      if (!row) {
        row = { id, name, actions: [], agents: [], nextDeadline: null };
        byId.set(id, row);
      }
      return row;
    };
    // Include quiet properties too; absence of actions must not hide a home.
    for (const property of properties) {
      const row = touch(String(property.id), property.name);
      row.city = property.city;
      row.photo = property.imageUrl || property.photoUrls?.[0];
    }
    for (const action of portfolio.pending) {
      const row = touch(action.propertyId, action.propertyName);
      row.actions.push(action);
      if (!row.agents.includes(action.agentId)) row.agents.push(action.agentId);
    }
    for (const agent of portfolio.agents) {
      for (const item of agent.items) {
        const row = touch(item.propertyId, item.propertyName);
        if (!row.agents.includes(agent.id)) row.agents.push(agent.id);
      }
    }
    for (const row of byId.values()) {
      const times = row.actions.map(a => new Date(a.expiresAt).getTime()).filter(Number.isFinite);
      row.nextDeadline = times.length ? Math.min(...times) : null;
    }
    return [...byId.values()].sort((a, b) => b.actions.length - a.actions.length
      || (a.nextDeadline ?? Infinity) - (b.nextDeadline ?? Infinity)
      || a.name.localeCompare(b.name));
  }, [portfolio, properties]);

  const countByAgent = useMemo(() => {
    const counts = new Map<AgentId, number>();
    for (const action of portfolio?.pending ?? []) counts.set(action.agentId, (counts.get(action.agentId) ?? 0) + 1);
    return counts;
  }, [portfolio]);
  const visibleRows = useMemo(() => {
    const query = searchText(search.trim());
    return rows.filter(row => (!agentFilter || row.agents.includes(agentFilter))
      && (!query || searchText(row.name + ' ' + (row.city ?? '')).includes(query)));
  }, [rows, agentFilter, search]);
  const activeRow = visibleRows.find(row => row.id === openProperty) ?? visibleRows[0] ?? null;
  const activeActions = useMemo(() => {
    const list = activeRow?.actions ?? [];
    return agentFilter ? list.filter(action => action.agentId === agentFilter) : list;
  }, [activeRow, agentFilter]);
  const activeFeed = useMemo(() => portfolio && activeRow
    ? portfolio.feed.filter(entry => entry.propertyName === activeRow.name && (!agentFilter || entry.agentId === agentFilter)) : [], [portfolio, activeRow, agentFilter]);

  if (status === 'loading') return <PortfolioSkeleton />;
  if (!portfolio) return <div className="baitly-supervision-surface baitly-portfolio__unavailable" role="status">
    <h2>{t('supervision.portfolio.unavailable')}</h2>
    <p>{t('supervision.portfolio.unavailableHelp')}</p>
    <button type="button" className="baitly-hitl-primary" onClick={retry}>{t('common.retry', 'Réessayer')}</button>
  </div>;

  const pendingTotal = portfolio.pending.length;
  const propertyTotal = Math.max(portfolio.propertyCount, rows.length);
  const timeSaved = report ? '≈ ' + number.format(Math.floor(report.estimatedTimeSavedMinutes / 60))
    + ' ' + t('supervision.hitl.unitHour') + ' ' + number.format(report.estimatedTimeSavedMinutes % 60) : '–';
  const summary = [
    { image: '/images/portfolio-metrics/pending-review.webp', label: t('supervision.portfolio.pendingLabel'), value: number.format(pendingTotal), note: t('supervision.portfolio.awaitingDecision') },
    { image: '/images/portfolio-metrics/time-saved.webp', label: t('supervision.report.timeSaved'), value: timeSaved, note: t('supervision.portfolio.reportWindow', { displayCount: number.format(report?.windowDays ?? 30) }) },
    { image: '/images/portfolio-metrics/automated-actions.webp', label: t('supervision.report.autoActions'), value: report ? number.format(report.autoActions) : '–', note: t('supervision.portfolio.reportWindow', { displayCount: number.format(report?.windowDays ?? 30) }) },
  ];
  const chooseAgent = (id: AgentId | null) => {
    setAgentFilter(id);
    setDetailVisible(false);
    setFiltersExpanded(false);
    if (id && window.matchMedia('(max-width: 899px)').matches) {
      requestAnimationFrame(() => filterToggleRef.current?.focus({ preventScroll: true }));
    }
  };

  return <div className="baitly-supervision-surface baitly-portfolio" data-detail={detailVisible || undefined}>
    <header className="baitly-portfolio__overview">
      <div className="baitly-portfolio__identity">
        <h2>{t('supervision.portfolio.overviewTitle')}</h2>
        <p><strong>{number.format(propertyTotal)}</strong> {t('supervision.portfolio.propertiesShort')}
          <span className="baitly-portfolio__connection" data-offline={status === 'offline' || undefined}>
            <i aria-hidden="true" />{status === 'offline' ? t('supervision.states.offline') : t('supervision.toolbar.online')}
          </span>
        </p>
      </div>
      <dl className="baitly-portfolio__metrics">{summary.map(item => <div key={item.label}>
        <img src={item.image} width={40} height={40} alt="" decoding="async" />
        <div><dt>{item.label}</dt><dd>{item.value}</dd><small>{item.note}</small></div>
      </div>)}</dl>
    </header>

    <div className="baitly-portfolio__filters" data-expanded={filtersExpanded || undefined}>
      <button type="button" className="baitly-portfolio__filter baitly-portfolio__all-agents" aria-pressed={agentFilter === null} onClick={() => chooseAgent(null)}>
        {t('supervision.portfolio.allAgents')}<NavCountBadge count={pendingTotal} tone="warning" formatCount={number.format} />
      </button>
      <button ref={filterToggleRef} type="button" className="baitly-portfolio__filter-toggle" aria-expanded={filtersExpanded} aria-controls={filtersId} onClick={() => setFiltersExpanded(value => !value)}>
        {agentFilter ? <span className="baitly-portfolio__filter-portrait"><AgentPortrait agentId={agentFilter} /></span> : <SlidersHorizontal size={16} />}
        {agentFilter ? t(AGENT_META[agentFilter].nameKey) : t('supervision.portfolio.filterAgents')}<ChevronDown size={15} />
      </button>
      <div id={filtersId} className="baitly-portfolio__agent-filters" role="group" aria-label={t('supervision.portfolio.filterAgents')}>
        {portfolio.agents.map(agent => <button key={agent.id} type="button" className="baitly-portfolio__filter" aria-pressed={agentFilter === agent.id} onClick={() => chooseAgent(agentFilter === agent.id ? null : agent.id)}>
          <span className="baitly-portfolio__filter-portrait"><AgentPortrait agentId={agent.id} /></span>
          <span>{t(AGENT_META[agent.id].nameKey)}</span><NavCountBadge count={countByAgent.get(agent.id)} tone="warning" formatCount={number.format} />
        </button>)}
      </div>
    </div>

    <div className="baitly-portfolio__workspace">
      <aside className="baitly-portfolio__properties" aria-label={t('supervision.portfolio.propertyList')}>
        <header><h3>{t('supervision.portfolio.propertyList')}</h3><span className="baitly-portfolio__list-count">{number.format(visibleRows.length)} / {number.format(propertyTotal)}</span>
          <p>{t('supervision.portfolio.sortedBy')}</p>
        </header>
        {search && <div className="baitly-portfolio__search-result"><span>{search}</span><button type="button" onClick={() => setSearch('')}>{t('supervision.portfolio.clearSearch')}</button></div>}
        <div ref={propertyListRef} className="baitly-portfolio__property-list" data-vertical-scroll>
          {visibleRows.length === 0 ? <div className="baitly-portfolio__empty"><CheckCircle2 size={24} /><p>{t('supervision.portfolio.emptyList')}</p></div> : visibleRows.map(row => {
            const rowCount = agentFilter ? row.actions.filter(action => action.agentId === agentFilter).length : row.actions.length;
            return <button key={row.id} type="button" aria-current={activeRow?.id === row.id} data-property-id={row.id} className="baitly-portfolio__property"
              onClick={() => { setOpenProperty(row.id); setDetailVisible(true); }}>
              <PropertyThumbnail name={row.name} src={row.photo} />
              <span className="baitly-portfolio__property-info">
                <strong dir="auto">{row.name}</strong>
                {row.city && <span dir="auto" className="baitly-portfolio__city">{row.city}</span>}
                <span className="baitly-portfolio__property-status" data-clear={rowCount === 0 || undefined}>
                  {rowCount > 0 ? <><b>{number.format(rowCount)}</b> {t('supervision.board.toValidate')}</> : <><CheckCircle2 size={12} />{t('supervision.portfolio.noDecision')}</>}
                  <ArrowRight className="baitly-portfolio__forward" size={14} aria-hidden="true" />
                </span>
              </span>
            </button>;
          })}
        </div>
      </aside>

      <section className="baitly-portfolio__detail" aria-labelledby={headingId}>
        <button type="button" className="baitly-portfolio__back" onClick={() => { returnFocus.current = true; setDetailVisible(false); }}><ArrowLeft size={17} />{t('supervision.portfolio.backToProperties')}</button>
        <header className="baitly-portfolio__detail-heading">
          {activeRow && rightView !== 'report' && <PropertyThumbnail name={activeRow.name} src={activeRow.photo} />}
          <div><h3 ref={detailHeadingRef} tabIndex={-1} id={headingId} dir="auto">{rightView === 'report' ? t('supervision.portfolio.portfolioReport') : activeRow?.name ?? t('supervision.portfolio.noProperty')}</h3>
            <p>{rightView === 'report' ? t('supervision.portfolio.reportScope') : <>{activeRow?.city && <><bdi>{activeRow.city}</bdi><span aria-hidden="true"> · </span></>}{t('supervision.portfolio.agentCount', { count: activeRow?.agents.length ?? 0, displayCount: number.format(activeRow?.agents.length ?? 0) })}</>}</p>
          </div>
          {activeRow && rightView !== 'report' && <div className="baitly-portfolio__assigned" aria-hidden="true">
            {activeRow.agents.slice(0, 3).map(id => <span key={id}><AgentPortrait agentId={id} /></span>)}
            {activeRow.agents.length > 3 && <small>+{number.format(activeRow.agents.length - 3)}</small>}
          </div>}
        </header>
        <div className="baitly-portfolio__tabs">
          <ToggleGroup type="single" value={rightView} onValueChange={value => value && setRightView(value as typeof rightView)} aria-label={t('supervision.portfolio.detailViews')}>
            <ToggleGroupItem value="queue">{t('supervision.board.queueTitle')}<NavCountBadge count={activeActions.length} tone="warning" formatCount={number.format} /></ToggleGroupItem>
            <ToggleGroupItem value="activity">{t('supervision.board.activity')}</ToggleGroupItem>
            <ToggleGroupItem value="report">{t('supervision.report.titleBase')}</ToggleGroupItem>
          </ToggleGroup>
          {agentFilter && rightView !== 'report' && <Badge variant="info" className="baitly-portfolio__active-filter">{t(AGENT_META[agentFilter].nameKey)}</Badge>}
        </div>
        <div key={(activeRow?.id ?? 'empty') + ':' + rightView + ':' + (agentFilter ?? 'all')} className="baitly-portfolio__detail-scroll" data-vertical-scroll data-tethers-viewport>
          {rightView === 'queue' && <PendingQueue actions={activeActions} onValidate={handleValidate} onEdit={handleEdit} onAdjustPrice={handleAdjustPrice} variant="panel" presentation="portfolio" />}
          {rightView === 'activity' && (activeFeed.length > 0 ? <ActivityFeed entries={activeFeed} pending={activeActions} /> : <EmptyState icon={<CheckCircle2 />} title={t('supervision.feed.emptyProperty')} />)}
          {rightView === 'report' && (reportLoading ? <Skeleton className="h-48 rounded-xl" /> : report ? <SupervisionReportContent report={report} /> : <p className="baitly-portfolio__empty">{t('supervision.portfolio.reportUnavailable')}</p>)}
        </div>
      </section>
    </div>

    {toasts.length > 0 && <div className="baitly-portfolio__toasts"><ResolutionToasts toasts={toasts} /></div>}
    {priceAction && <PriceAdjustmentModal suggestionId={priceAction.id} propertyId={Number(priceAction.propertyId ?? 0)} actionParams={priceAction.actionParams}
      onClose={() => setPriceAction(null)} onApplied={() => { markInFlight(priceAction.id); setPriceAction(null); }} />}
  </div>;
}
