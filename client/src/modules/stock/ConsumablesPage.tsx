import { useEffect, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Inventory2, Refresh, ArrowForward } from '../../icons';
import { PackageCheck, ClipboardList, Send } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import PagePagination from '../../components/PagePagination';
import NavCountBadge from '../../components/NavCountBadge';
import { PageHeaderActionsProvider, usePageHeaderActions, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { consumablesApi, type ConsumablesView } from '../../services/api/consumablesApi';
import { ConsumablesList } from './ConsumablesList';
import { BaitlyConsumableInventory } from './BaitlyConsumableInventory';
import { StockThumbnail } from './StockThumbnail';
import './consumables.css';

const VIEWS = ['stock', 'pending', 'ordered'] as const;
const PAGE_SIZE = { stock: 12, pending: 4, ordered: 4 };
const VIEW_ICONS = { stock: Inventory2, pending: ClipboardList, ordered: Send };

function RefreshAction({ refresh, fetching }: { refresh: () => void; fetching: boolean }) {
  const { t } = useTranslation();
  return usePageHeaderActions(<Button variant="ghost" onClick={refresh} disabled={fetching}>
    <Refresh size={16} />{t('consumables.refresh')}
  </Button>);
}

export default function ConsumablesPage() {
  const { user } = useAuth();
  return <ConsumablesWorkspace key={`${user?.id}:${user?.organizationId}`} />;
}

function ConsumablesWorkspace() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [propertyId, setPropertyId] = useState('all');
  const [pagination, setPagination] = useState({ scope: '', stock: 0, pending: 0, ordered: 0 });
  const scope = `${propertyId}:${debouncedSearch}`;
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().slice(0, 200)), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useScreenSearch(search, setSearch, t('consumables.search'));
  const queries = useQueries({ queries: VIEWS.map(view => ({
    queryKey: ['consumables', user?.id, user?.organizationId, view, propertyId, debouncedSearch,
      pagination.scope === scope ? pagination[view] : 0, PAGE_SIZE[view]],
    queryFn: () => consumablesApi.list(view, propertyId, debouncedSearch,
      pagination.scope === scope ? pagination[view] : 0, PAGE_SIZE[view]),
    enabled: !!user && !loading,
    staleTime: 0,
  })) });
  const properties = useQuery({
    queryKey: ['consumables-properties', user?.id, user?.organizationId],
    queryFn: consumablesApi.properties,
    enabled: !!user && !loading,
    staleTime: 60_000,
  });
  // Bookmarked tabs now lead to their section on this single Baitly workspace.
  useEffect(() => {
    const legacyView = params.get('tab');
    if (legacyView && VIEWS.includes(legacyView as ConsumablesView)) {
      document.getElementById(`consumables-${legacyView}`)?.scrollIntoView?.({ block: 'start' });
    }
  }, [params]);
  const filtered = !!debouncedSearch || propertyId !== 'all';
  const reset = () => { setSearch(''); setDebouncedSearch(''); setPropertyId('all'); };
  const refresh = () => { queries.forEach(query => { void query.refetch(); }); void properties.refetch(); };
  const goToPage = (view: ConsumablesView, page: number) => setPagination(previous => ({
    ...(previous.scope === scope ? previous : { scope, stock: 0, pending: 0, ordered: 0 }), [view]: page,
  }));
  const canOpenPlanning = user?.permissions?.includes('reservations:view');

  return <PageHeaderActionsProvider slot={slot}>
    <PageHeader title={t('navigation.consumables')} subtitle={t('consumables.workspace.intro')}
      iconBadge={<Inventory2 />} actions={portalContainer} />
    <RefreshAction refresh={refresh} fetching={queries.some(query => query.isFetching)} />
    <div className="baitly-supply-workspace">
      <div className="baitly-supply-overview">
        <div className="baitly-supply-intro">
          <div className="baitly-supply-photo-stack" aria-hidden="true">
            <StockThumbnail name="" catalogKey="coffee-capsules" size={52} />
            <StockThumbnail name="" catalogKey="toilet-paper" size={52} />
          </div>
          <div><h2>{t('consumables.workspace.title')}</h2><p>{t('consumables.workspace.subtitle')}</p></div>
        </div>
        <Select value={propertyId} onValueChange={setPropertyId} disabled={!properties.data}>
          <SelectTrigger className="baitly-consumables-property" aria-label={t('consumables.propertyFilter')}>
            <SelectValue placeholder={t('consumables.allProperties')} />
          </SelectTrigger>
          <SelectContent><SelectItem value="all">{t('consumables.allProperties')}</SelectItem>
            {(properties.data ?? []).map(property => <SelectItem key={property.id} value={String(property.id)}>{property.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {properties.isError && <Alert variant="destructive"><AlertDescription>{t('consumables.error')}</AlertDescription>
        <Button variant="outline" size="sm" onClick={() => { void properties.refetch(); }}>{t('common.retry')}</Button></Alert>}
      <nav className="baitly-supply-flow" aria-label={t('consumables.workspace.flow')}>
        {VIEWS.map((view, index) => {
          const Icon = VIEW_ICONS[view];
          return <a href={`#consumables-${view}`} key={view}>
            <Icon size={18} aria-hidden="true" />
            <span>{t(`consumables.workspace.${view}`)}</span>
            <NavCountBadge count={queries[index].data?.totalElements} />
            {index < 2 && <ArrowForward size={14} className="baitly-supply-flow-arrow" aria-hidden="true" />}
          </a>;
        })}
      </nav>
      <div className="baitly-supply-layout">
        {VIEWS.map((view, index) => {
          const query = queries[index];
          const data = query.data;
          const Icon = VIEW_ICONS[view];
          return <section id={`consumables-${view}`} key={view} className={`baitly-supply-section baitly-supply-${view}`}
            aria-labelledby={`consumables-${view}-title`} aria-busy={query.isFetching}>
            <header className="baitly-supply-section-heading">
              <div><h2 id={`consumables-${view}-title`}><Icon size={18} aria-hidden="true" />
                {t(`consumables.workspace.${view}`)}<NavCountBadge count={data?.totalElements} /></h2>
                <p>{t(`consumables.workspace.${view}Hint`)}</p></div>
              {view === 'stock' && <Button asChild variant="outline" size="sm"><Link to={propertyId === 'all' ? '/properties' : `/properties/${propertyId}?tab=inventory&subtab=stock`}>
                {t('consumables.workspace.manage')}<ArrowForward size={14} aria-hidden="true" /></Link></Button>}
            </header>
            {query.isError && <Alert variant="destructive" className="m-3 w-auto"><AlertDescription>{t('consumables.error')}</AlertDescription>
              <Button variant="outline" size="sm" onClick={() => { void query.refetch(); }}>{t('common.retry')}</Button></Alert>}
            {!data && query.isPending ? <div className="baitly-consumables-loading" role="status" aria-label={t('common.loading')}>
              {Array.from({ length: view === 'stock' ? 6 : 3 }, (_, i) => <div key={i}><Skeleton className="size-14 rounded-lg" /><Skeleton className="h-10 flex-1" /></div>)}
            </div> : data && <>
              {view === 'stock' ? <BaitlyConsumableInventory rows={data.rows} filtered={filtered} onReset={reset}
                canEdit={!!user?.permissions?.includes('properties:edit')} />
                : <ConsumablesList rows={data.rows} view={view} filtered={filtered} onReset={reset} canOpenPlanning={canOpenPlanning} compact />}
              <PagePagination page={data.page} rowsPerPage={data.size} count={data.totalElements} compact={view !== 'stock'}
                onPageChange={next => goToPage(view, next)} className="baitly-supply-pagination" />
            </>}
            {view === 'ordered' && <p className="baitly-supply-receipt-note"><PackageCheck size={17} aria-hidden="true" />{t('consumables.workspace.receiptNote')}</p>}
          </section>;
        })}
      </div>
    </div>
  </PageHeaderActionsProvider>;
}
