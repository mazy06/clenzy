import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Inventory2, Refresh, ArrowForward } from '../../icons';
import { Alert, AlertDescription, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import PagePagination from '../../components/PagePagination';
import NavCountBadge from '../../components/NavCountBadge';
import { PageHeaderActionsProvider, usePageHeaderActions, usePageHeaderActionsSlot, resolveTabHeader } from '../../components/PageHeaderActionsContext';
import { useScreenSearch } from '../../components/ScreenChrome';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { consumablesApi, type ConsumablesView } from '../../services/api/consumablesApi';
import { ConsumablesList } from './ConsumablesList';
import './consumables.css';

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
  const tabs = useScreenTabs('/consumables');
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const view = (tabs[activeTab]?.key ?? 'pending') as ConsumablesView;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [propertyId, setPropertyId] = useState('all');
  const [pagination, setPagination] = useState({ scope: '', page: 0 });
  const scope = `${view}:${propertyId}:${debouncedSearch}`;
  const page = pagination.scope === scope ? pagination.page : 0;
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().slice(0, 200)), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useScreenSearch(search, setSearch, t('consumables.search'));
  const query = useQuery({
    queryKey: ['consumables', user?.id, user?.organizationId, view, propertyId, debouncedSearch, page],
    queryFn: () => consumablesApi.list(view, propertyId, debouncedSearch, page),
    enabled: !!user && !loading,
    staleTime: 0,
  });
  const properties = useQuery({
    queryKey: ['consumables-properties', user?.id, user?.organizationId],
    queryFn: consumablesApi.properties,
    enabled: !!user && !loading,
    staleTime: 60_000,
  });
  const data = query.data;
  const filtered = !!debouncedSearch || propertyId !== 'all';
  const reset = () => { setSearch(''); setDebouncedSearch(''); setPropertyId('all'); };
  const meta = Object.fromEntries(tabs.map(tab => [tab.label, { subtitle: t(`consumables.intro.${tab.key}`) }]));
  const header = resolveTabHeader(t('navigation.consumables'), t('consumables.intro.pending'),
    tabs.map(tab => tab.label), activeTab, meta);

  return <PageHeaderActionsProvider slot={slot}>
    <PageHeader {...header} iconBadge={<Inventory2 />} actions={portalContainer} />
    <PageTabs options={tabs.map(tab => ({ ...tab, badge: data?.counts[tab.key as ConsumablesView] }))}
      value={activeTab} onChange={setActiveTab} ariaLabel={t('navigation.consumables')} />
    <RefreshAction refresh={() => { void query.refetch(); }} fetching={query.isFetching} />
    <section className="baitly-consumables-surface" aria-label={t(`tabHeaders.consumables.${view}`)} aria-busy={query.isFetching}>
      <div className="baitly-consumables-toolbar">
        <div><h2>{t(`tabHeaders.consumables.${view}`)}<NavCountBadge count={data?.totalElements} tone="info" className="ms-2" /></h2>
          <p>{t(`consumables.intro.${view}`)}</p></div>
        <Select value={propertyId} onValueChange={setPropertyId} disabled={!properties.data}>
          <SelectTrigger className="baitly-consumables-property" aria-label={t('consumables.propertyFilter')}>
            <SelectValue placeholder={t('consumables.allProperties')} />
          </SelectTrigger>
          <SelectContent><SelectItem value="all">{t('consumables.allProperties')}</SelectItem>
            {(properties.data ?? []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {(query.isError || properties.isError) && <Alert variant="destructive" className="m-3 w-auto"><AlertDescription>{t('consumables.error')}</AlertDescription>
        <Button variant="outline" size="sm" onClick={() => { void query.refetch(); void properties.refetch(); }}>{t('common.retry')}</Button>
      </Alert>}
      {!data && query.isPending ? <div className="baitly-consumables-loading" role="status" aria-label={t('common.loading')}>
        {Array.from({ length: 5 }, (_, i) => <div key={i}><Skeleton className="size-14 rounded-xl" /><Skeleton className="h-10 flex-1" /></div>)}
      </div> : data && <>
        <ConsumablesList rows={data.rows} view={view} filtered={filtered} onReset={reset}
          canOpenPlanning={user?.permissions?.includes('reservations:view')} />
        <PagePagination page={data.page} rowsPerPage={data.size} count={data.totalElements}
          onPageChange={next => setPagination({ scope, page: next })} className="px-4 border-t border-border" />
      </>}
      {view === 'stock' && !!data?.rows.length && <div className="baitly-consumables-footer">
        <span>{t('consumables.stockHelp')}</span><Link to="/properties">{t('consumables.openProperties')}<ArrowForward size={14} /></Link>
      </div>}
    </section>
  </PageHeaderActionsProvider>;
}
