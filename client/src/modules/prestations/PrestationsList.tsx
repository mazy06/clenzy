import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { Add, Build, Refresh } from '../../icons';
import EmptyState from '../../components/EmptyState';
import ExportButton from '../../components/ExportButton';
import FilterSearchBar from '../../components/FilterSearchBar';
import PagePagination from '../../components/PagePagination';
import compactHeaderActions from '../../components/compactHeaderActions';
import { useTranslation } from '../../hooks/useTranslation';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { fetchMissionMapExport, useMissionList, useMissionMapOverview, MISSION_MAP_PAGE_SIZE } from '../../hooks/useMissionMap';
import { useInterventionsList } from '../interventions/useInterventionsList';
import { useServiceRequestsList } from '../service-requests/useServiceRequestsList';
import ServiceReferenceIssues from '../service-requests/ServiceReferenceIssues';
import { PrestationActionsContext, type PrestationActions } from './PrestationActionsContext';
import PrestationDialogs from './PrestationDialogs';
import PrestationRows from './PrestationRows';
import PrestationsMapView from './PrestationsMapView';
import HeaderIconButton from './HeaderIconButton';
import { usePrestationFilterOptions } from './usePrestationFilterOptions';
import { prestationExportColumns, toPrestationExportRecord } from './prestationExport';
import {
  buildPrestationFilters,
  categoryFromParam,
  type PrestationCategory,
  type PrestationPeriod,
  type PrestationRow,
} from './prestationFilters';

interface PrestationsListProps {
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

const orAll = (value: string) => value || 'all';

/**
 * Écran Prestations : interventions et demandes de service dans une seule liste chronologique
 * et une seule carte. Filtres, pagination et fusion sont faits par le serveur
 * (`/api/mission-map/prestations`) ; chaque ligne garde les actions de son type.
 */
export default function PrestationsList({ actionsContainer, filtersContainer }: PrestationsListProps) {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = usePersistedViewMode<'list' | 'map'>('prestations', 'list', ['list', 'map'] as const);
  const intervention = useInterventionsList(false);
  const request = useServiceRequestsList(false);
  const actions: PrestationActions = { intervention, request };
  const { t, isAdmin, isManager, isHost, navigate, canCreateInterventions } = intervention;
  const isManagerView = isAdmin() || isManager();

  const category = categoryFromParam(params.get('type'));
  const propertyParam = params.get('propertyId');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState<PrestationPeriod>('all');
  const [assignee, setAssignee] = useState('all');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Type et logement vivent dans l'URL : les anciens liens profonds (`?type=`, `?propertyId=`) s'y posent.
  const setParam = (key: string, value: string) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value === 'all' || value === '') next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });

  const filters = useMemo(() => buildPrestationFilters({
    search: debouncedSearch, category, status, period, assignee,
    propertyId: propertyParam ? Number(propertyParam) : undefined,
  }, new Date()), [debouncedSearch, category, status, period, assignee, propertyParam]);
  useEffect(() => { setPage(0); }, [filters]);

  const list = useMissionList<PrestationRow>('prestations', filters, page, viewMode === 'list' && !intervention.permissionsLoading);
  const overview = useMissionMapOverview('prestations', filters, viewMode === 'map');
  const options = usePrestationFilterOptions(category, isManagerView);
  const total = viewMode === 'map' ? overview.data?.total ?? 0 : list.data?.totalElements ?? 0;

  const actionButtons = (
    <div className="flex items-center gap-1">
      <ExportButton
        data={[]}
        loadData={async () => (await fetchMissionMapExport<PrestationRow>('prestations', filters, 'list')).map(toPrestationExportRecord)}
        columns={prestationExportColumns}
        fileName="prestations"
        variant="icon"
      />
      <HeaderIconButton label={t('common.refresh')} disabled={list.isFetching}
        onClick={() => void queryClient.invalidateQueries({ queryKey: ['interventions', 'list', 'prestations'] })}>
        <Refresh size={18} strokeWidth={1.75} />
      </HeaderIconButton>
      {(isManagerView || isHost()) && (
        <HeaderIconButton accent label={t('serviceRequests.create')} onClick={() => navigate('/service-requests/new')}>
          <Add size={20} strokeWidth={1.75} />
        </HeaderIconButton>
      )}
      {canCreateInterventions && isManagerView && (
        <HeaderIconButton accent label={t('interventions.create')} onClick={() => navigate('/interventions/new')}>
          <Build size={18} strokeWidth={1.75} />
        </HeaderIconButton>
      )}
    </div>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={search}
      onSearchChange={setSearch}
      searchPlaceholder={t('prestations.search', 'Rechercher une prestation')}
      filters={{
        category: { value: category, options: options.categories, label: t('prestations.filters.kind', 'Type'),
          onChange: (value) => setParam('type', value === 'intervention' ? 'interventions' : value === 'request' ? 'requests' : 'all') },
        status: { value: status, options: options.statuses, onChange: (value) => setStatus(orAll(value)), label: t('common.status') },
        period: { value: period, options: options.periods, onChange: (value) => setPeriod(orAll(value) as PrestationPeriod),
          label: t('prestations.filters.period', 'Période') },
        ...(options.properties.length > 1 ? { location: { value: propertyParam ?? 'all', options: options.properties,
          onChange: (value: string) => setParam('propertyId', value), label: t('prestations.filters.property', 'Logement') } } : {}),
        ...(isManagerView ? { assignedTo: { value: assignee, options: options.assignees, onChange: (value: string) => setAssignee(orAll(value)),
          label: t('prestations.filters.assignee', 'Intervenant') } } : {}),
      }}
      counter={{ label: t('prestations.counter', 'prestation'), count: total, singular: '', plural: 's' }}
      viewToggle={{ mode: viewMode, modes: ['list', 'map'], onChange: (mode) => setViewMode(mode === 'map' ? 'map' : 'list') }}
    />
  );

  return (
    <PrestationActionsContext.Provider value={actions}>
      {actionsContainer && createPortal(compactHeaderActions(actionButtons), actionsContainer)}
      {filtersContainer && createPortal(filterBar, filtersContainer)}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isManagerView && <ServiceReferenceIssues />}
        {viewMode === 'map' ? <PrestationsMapView filters={filters} /> : (
          <PrestationListBody list={list} page={page} onPageChange={setPage} category={category} />
        )}
      </div>
      <PrestationDialogs actions={actions} />
    </PrestationActionsContext.Provider>
  );
}

function PrestationListBody({ list, page, onPageChange, category }: {
  list: ReturnType<typeof useMissionList<PrestationRow>>; page: number; onPageChange: (page: number) => void;
  category: PrestationCategory;
}) {
  const { t } = useTranslation();
  if (list.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t('missionMap.loadError')} <Button variant="outline" onClick={() => void list.refetch()}>{t('common.retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!list.data) return <Skeleton className="h-48 w-full" />;
  if (list.data.content.length === 0) {
    return (
      <EmptyState
        icon={<Build />}
        title={t('prestations.empty.title', 'Aucune prestation')}
        description={t(category === 'request' ? 'prestations.empty.requests' : 'prestations.empty.description',
          'Les interventions planifiées et les demandes à traiter apparaîtront ici.')}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
        <PrestationRows rows={list.data.content} />
      </div>
      <PagePagination
        page={page}
        onPageChange={onPageChange}
        count={list.data.totalElements}
        rowsPerPage={MISSION_MAP_PAGE_SIZE}
        hideNavigationOnSinglePage
      />
    </div>
  );
}
