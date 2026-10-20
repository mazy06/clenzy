import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CircleCheck, Wrench } from '../../icons/glyphs';
import { Button, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Home } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useHomeMapCenter } from '../../hooks/useHomeMapCenter';
import EmptyState from '../../components/EmptyState';
import { BaitlyPropertyMap } from '../../components/BaitlyPropertyMap';
import PropertyMapCard from './PropertyMapCard';
import KeyPointMapCard from '../connected-objects/KeyPointMapCard';
import { useQuery } from '@tanstack/react-query';
import { keyExchangeApi } from '../../services/api/keyExchangeApi';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { MarkerState } from '../../components/map/markerStates';
import MapWithSheet from '../../components/baitly/MapWithSheet';
import PropertyMapRow from './PropertyMapRow';
import { MapCardCoordinator } from '../../components/map/MapCardCoordinator';
import { useProviderSectorLayer } from '../marketplace/sectors/useProviderSectorLayer';
import { useSearchParams } from 'react-router-dom';
import { useIdleReady } from '../../hooks/useIdleReady';
import { useMissionMapPages } from '../../hooks/useMissionMap';
import { categoryFromParam, type PrestationCategory, type PrestationRow } from '../prestations/prestationFilters';
import type { PropertyMapView } from './map-views/propertyMapView';
import PrestationsMapList from './map-views/PrestationsMapList';
import ReservationsMapList from './map-views/ReservationsMapList';
import { useOpenIssues, usePrestationPins, useReservationWindow, worstIssueByProperty } from './map-views/mapViewData';
import IssuesMapList from './map-views/IssuesMapList';
import type { PropertyMarker, MapBounds } from '../../components/BaitlyPropertyMap';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import type { ChannexMappingDto } from '../../services/api/channexApi';
import { mapDateRange, pointInMapScope, validMapDay, type MapPoint, type MapQuickFilter } from './map-views/baitlyMapContext';
import { useBaitlyMapContext } from './map-views/useBaitlyMapContext';
import BaitlyMapFilters from './map-views/BaitlyMapFilters';
import type { SectorMode } from '../../components/map/sectorLayer';
import { MapRowInteractions, MapLinkedRow } from './map-views/MapRowInteractions';

/**
 * Taille du lot affiché. La zone visible peut contenir des centaines de logements ;
 * les peindre tous d'un coup construit autant de lignes, chacune avec ses pastilles
 * et ses infobulles, pour un écran qui n'en montre qu'une dizaine. Les données sont
 * déjà côté client : ce qui coûte, c'est le DOM, et c'est lui qu'on étale.
 */
const BATCH_SIZE = 20;

interface PropertiesMapViewProps {
  mapMarkers: PropertyMarker[];
  viewportProperties: PropertyListItem[];
  allProperties?: PropertyListItem[];
  onScopeChange?: (ids: number[] | null) => void;
  onResetPropertyFilters?: () => void;
  channexMappings: Map<number, ChannexMappingDto>;
  onBoundsChange: (bounds: MapBounds) => void;
  onDiagnose: (propertyId: number, propertyName: string) => void;
  canManageContracts: boolean;
  missingContractIds: Set<number>;
  /** Clic sur le badge « Contrat manquant » : ouvre la modal de contrat préselectionnée. */
  onMissingContractClick: (propertyId: number) => void;
  /** Onglet du menu Carte affiché (Logements par défaut) ; la fiche logement peut demander d'en changer. */
  view?: PropertyMapView;
  onViewChange?: (view: PropertyMapView) => void;
  /** Liste des logements en cours de chargement : la carte est déjà là, la liste attend. */
  loading?: boolean;
}

/**
 * Vue carte des logements — même surface que les deux autres cartes de
 * l'application (demandes de service, interventions) : sur desktop la carte
 * occupe la colonne principale et la liste vit dans un panneau à droite, à sa
 * hauteur ; sous 640 px la liste devient la feuille tirable de `MapWithSheet`.
 *
 * <p>L'empilement précédent — carte de 400 px en haut, liste dessous — pliait
 * deux surfaces qui réclament chacune l'attention entière : en lisant la liste
 * la carte était morte au-dessus, en manipulant la carte la liste sortait du
 * champ. Le panneau latéral les rend simultanées, ce qui est le propre d'une
 * vue carte : déplacer la carte MET À JOUR la liste, sous les yeux.</p>
 */
const DAY_STATES: Record<string, MarkerState> = {
  TURNOVER: 'turnover',
  ARRIVAL: 'arrival',
  DEPARTURE: 'departure',
  OCCUPIED: 'occupied',
};

/** Une maintenance ou une désactivation prime sur le planning du jour. */
function propertyMarkerState(
  marker: PropertyMarker,
  dayStates: Array<{ propertyId: number; state: string }> | undefined,
): MarkerState | undefined {
  if (marker.state === 'alert' || marker.state === 'inactive') return marker.state;
  const day = dayStates?.find((entry) => entry.propertyId === marker.id);
  return day ? DAY_STATES[day.state] : marker.state;
}

const PropertiesMapView: React.FC<PropertiesMapViewProps> = ({
  mapMarkers, viewportProperties, channexMappings, onBoundsChange, onDiagnose,
  canManageContracts, missingContractIds, onMissingContractClick, view = 'properties', onViewChange, loading = false,
  allProperties = viewportProperties, onScopeChange, onResetPropertyFilters,
}) => {
  // Calques et compteurs secondaires (secteurs, anomalies) : après le premier rendu utile.
  const secondaryReady = useIdleReady(!loading);
  const setView = useCallback((next: PropertyMapView) => onViewChange?.(next), [onViewChange]);
  const { t } = useTranslation();
  const homeCenter = useHomeMapCenter();
  const { context, patch, ready: contextReady, reset } = useBaitlyMapContext(view, onViewChange);
  const setAreaPoint = useCallback((area: MapPoint | MapPoint[] | null) => patch({ area }), [patch]);
  const setSectorMode = useCallback((sectorMode: SectorMode) => patch({ sectorMode }), [patch]);
  const range = mapDateRange(context.period, context.from, context.to);
  const periodValid = context.period !== 'custom' || (validMapDay(context.from) && validMapDay(context.to) && context.from <= context.to);

  // Points de remise des clés des logements affichés : mêmes filtres que la liste.
  const pointsQuery = useQuery({
    queryKey: ['key-exchange-points'],
    queryFn: () => keyExchangeApi.getPoints(),
    staleTime: 60_000,
  });
  const keyPoints = useMemo(() => {
    const shown = new Set(mapMarkers.map((marker) => marker.id));
    return (pointsQuery.data ?? []).filter(
      (point) => point.storeLat != null && point.storeLng != null && shown.has(point.propertyId),
    );
  }, [pointsQuery.data, mapMarkers]);
  // État du jour (arrivée, départ, rotation, occupé) : l'anneau des épingles lit le planning.
  const statesQuery = useQuery({
    queryKey: ['properties', 'map-states'],
    queryFn: () => propertiesApi.getMapStates(),
    staleTime: 5 * 60_000,
  });
  // Emprise visible, pour la colonne des prestataires (la liste des logements la reçoit du parent).
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
    onBoundsChange(bounds);
  }, [onBoundsChange]);
  // Calque des secteurs : actif, l'anneau des épingles dit si un prestataire couvre le logement.
  const sectorLayer = useProviderSectorLayer(mapBounds, secondaryReady, {
    point: context.area, onPointChange: setAreaPoint, mode: context.sectorMode, onModeChange: setSectorMode,
  });
  const areaPending = !!context.area && !sectorLayer.selectedArea;
  const matchesQuick = useCallback((property: PropertyListItem) => {
    const id = Number(property.id);
    switch (context.quick) {
      case 'active': return property.status.toLowerCase() === 'active';
      case 'maintenance': return ['maintenance', 'under_maintenance'].includes(property.status.toLowerCase());
      case 'missing': return canManageContracts && missingContractIds.has(id);
      case 'uncovered': return sectorLayer.allCoverage?.has(id) && sectorLayer.allCoverage.get(id)!.length === 0;
      default: return true;
    }
  }, [context.quick, canManageContracts, missingContractIds, sectorLayer.allCoverage]);
  const areaProperties = useMemo(() => allProperties.filter(property => property.latitude != null && property.longitude != null
    && !areaPending && (!sectorLayer.selectedArea || pointInMapScope(property.longitude, property.latitude, sectorLayer.selectedArea, null))),
  [allProperties, sectorLayer.selectedArea, areaPending]);
  const scopeProperties = useMemo(() => areaProperties.filter(matchesQuick), [areaProperties, matchesQuick]);
  const scopeIds = useMemo(() => new Set(scopeProperties.map(property => Number(property.id))), [scopeProperties]);
  const scopedViewport = useMemo(() => scopeProperties.filter(property => pointInMapScope(property.longitude!, property.latitude!, sectorLayer.selectedArea, mapBounds)),
    [scopeProperties, sectorLayer.selectedArea, mapBounds]);
  const counterProperties = useMemo(() => areaProperties.filter(property => pointInMapScope(property.longitude!, property.latitude!, sectorLayer.selectedArea, mapBounds)),
    [areaProperties, sectorLayer.selectedArea, mapBounds]);
  const scopeKey = [...scopeIds].sort((a, b) => a - b).join(',');
  const onScopeChangeRef = useRef(onScopeChange);
  onScopeChangeRef.current = onScopeChange;
  useEffect(() => { onScopeChangeRef.current?.([...scopeIds]); }, [scopeKey]);
  useEffect(() => () => onScopeChangeRef.current?.(null), []);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [locateProperty, setLocateProperty] = useState<{ id: number; request: number } | null>(null);
  const [resetCameraKey, setResetCameraKey] = useState(0);
  const locate = useCallback((id: number) => {
    setSelectedPropertyId(id);
    setLocateProperty(current => ({ id, request: (current?.request ?? 0) + 1 }));
  }, []);
  const interactions = useMemo(() => ({ highlight: setHighlightedId, locate, selectedId: selectedPropertyId, highlightedId }), [locate, selectedPropertyId, highlightedId]);

  // Onglet du menu Carte : Logements, Prestations (interventions + demandes), Réservations, Anomalies.
  const [params, setParams] = useSearchParams();
  const category = params.has('type') ? categoryFromParam(params.get('type')) : context.category;
  const setCategory = useCallback((next: PrestationCategory) => { patch({ category: next }); setParams((previous) => {
    const updated = new URLSearchParams(previous);
    if (next === 'all') updated.delete('type'); else updated.set('type', next === 'request' ? 'requests' : 'interventions');
    return updated;
  }, { replace: true }); }, [setParams, patch]);
  const prestationPins = usePrestationPins(category, view === 'prestations' && periodValid, { ...range, propertyIds: scopeKey || 'none' });
  const pageBounds = sectorLayer.selectedArea ? { north: 90, south: -90, west: -180, east: 180 } : mapBounds;
  const prestationPages = useMissionMapPages<PrestationRow>('prestations', prestationPins.filters, pageBounds, view === 'prestations' && periodValid);
  const reservationsQuery = useReservationWindow(view === 'reservations' && periodValid, [...scopeIds], range);
  // Anomalies à traiter : leur pastille d'alerte reste sur les épingles dans toutes les vues.
  const issuesQuery = useOpenIssues(secondaryReady);
  const periodIssues = useMemo(() => (issuesQuery.data ?? []).filter(issue => periodValid
    && (!range.from || issue.createdAt.slice(0, 10) >= range.from) && (!range.to || issue.createdAt.slice(0, 10) <= range.to)),
  [issuesQuery.data, range.from, range.to, periodValid]);
  const worstIssues = useMemo(() => worstIssueByProperty(periodIssues), [periodIssues]);
  const visibleIssues = useMemo(() => {
    const visible = new Set(scopedViewport.map((property) => Number(property.id)));
    return periodIssues.filter(issue => visible.has(issue.propertyId));
  }, [periodIssues, scopedViewport]);
  // Le prestataire d'une prestation n'a de sens que dans la vue Prestations.
  const { focusProviderUser } = sectorLayer;
  const previousView = useRef(view);
  useEffect(() => {
    if (previousView.current === 'prestations' && view !== 'prestations') setHighlightedId(null);
    previousView.current = view;
  }, [view]);

  const reservationPropertyIds = useMemo(
    () => new Set((reservationsQuery.data ?? []).map((reservation) => reservation.propertyId)),
    [reservationsQuery.data],
  );
  const visibleReservations = useMemo(() => {
    const visible = new Set(scopedViewport.map((property) => Number(property.id)));
    return (reservationsQuery.data ?? []).filter((reservation) => visible.has(reservation.propertyId) && periodValid);
  }, [reservationsQuery.data, scopedViewport, periodValid]);

  const propertyMarkers = useMemo<PropertyMarker[]>(
    () => [
      ...mapMarkers.filter(marker => scopeIds.has(Number(marker.id))).map((marker) => ({
        ...marker,
        state: sectorLayer.coverage
          ? ((sectorLayer.coverage.get(Number(marker.id))?.length ?? 0) > 0 ? 'covered' as const : 'uncovered' as const)
          : propertyMarkerState(marker, statesQuery.data),
      })),
      ...keyPoints.filter(point => scopeIds.has(point.propertyId)).map((point) => ({
        id: point.id,
        lat: point.storeLat as number,
        lng: point.storeLng as number,
        name: point.storeName,
        type: 'key_exchange' as const,
      })),
    ],
    [mapMarkers, keyPoints, statesQuery.data, sectorLayer.coverage, scopeIds],
  );
  // Une épingle reste un logement ; chaque vue ne garde que les logements concernés.
  const viewMarkers = useMemo<PropertyMarker[]>(() => {
    if (view === 'issues') {
      const issueProperties = new Set(periodIssues.map(issue => issue.propertyId));
      return mapMarkers.filter((marker) => scopeIds.has(Number(marker.id)) && issueProperties.has(Number(marker.id)))
        .map((marker) => {
          const severity = worstIssues.get(Number(marker.id));
          return { ...marker, state: severity === 'CRITICAL' || severity === 'HIGH' ? 'alert' as const : undefined };
        });
    }
    if (view === 'prestations') {
      return mapMarkers.filter((marker) => scopeIds.has(Number(marker.id)) && periodValid && prestationPins.byProperty.has(Number(marker.id)))
        .map((marker) => ({ ...marker, state: prestationPins.byProperty.get(Number(marker.id))?.state }));
    }
    if (view === 'reservations') {
      return mapMarkers.filter((marker) => scopeIds.has(Number(marker.id)) && periodValid && reservationPropertyIds.has(Number(marker.id)))
        .map((marker) => ({ ...marker, state: propertyMarkerState(marker, statesQuery.data) }));
    }
    return propertyMarkers;
  }, [view, mapMarkers, prestationPins.byProperty, reservationPropertyIds, statesQuery.data, propertyMarkers, worstIssues, scopeIds, periodIssues, periodValid]);
  const markers = useMemo<PropertyMarker[]>(() => viewMarkers.map((marker) => {
    if (marker.type === 'key_exchange') return marker;
    const severity = worstIssues.get(Number(marker.id));
    return severity ? { ...marker, alert: severity.toLowerCase() as PropertyMarker['alert'] } : marker;
  }), [viewMarkers, worstIssues]);

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [scopedViewport]);
  const visibleProperties = scopedViewport.slice(0, visibleCount);
  const hasMore = visibleCount < scopedViewport.length;
  useEffect(() => {
    const sentinel = endRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + BATCH_SIZE); },
      { root: sentinel.closest('[data-map-list-scroll]'), threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  /** Compteurs de la ZONE VISIBLE — ils suivent la carte, là où les tuiles
      portefeuille du haut d'écran suivent, elles, les filtres. */
  const indicators = useMemo(() => {
    const counts = counterProperties.reduce(
      (accumulator, property) => {
        const status = String(property.status).toUpperCase();
        if (status === 'ACTIVE') accumulator.active += 1;
        if (status === 'MAINTENANCE' || status === 'UNDER_MAINTENANCE') accumulator.maintenance += 1;
        if (missingContractIds.has(Number(property.id))) accumulator.missing += 1;
        return accumulator;
      },
      { active: 0, maintenance: 0, missing: 0 },
    );
    const uncovered = counterProperties.filter(property => sectorLayer.allCoverage?.has(Number(property.id)) && sectorLayer.allCoverage.get(Number(property.id))!.length === 0).length;
    return [
      { key: 'active', label: t('properties.statuses.ACTIVE'), count: counts.active, Icon: CircleCheck, color: 'var(--bui-success-ink)' },
      { key: 'maintenance', label: t('properties.statuses.MAINTENANCE'), count: counts.maintenance, Icon: Wrench, color: 'var(--bui-warning-ink)' },
      ...(canManageContracts
        ? [{ key: 'missing', label: t('contracts.gate.badge', 'Contrat manquant'), count: counts.missing, Icon: AlertTriangle, color: 'var(--bui-destructive-ink)' }]
        : []),
      { key: 'uncovered', label: t('mapPilot.quick.uncovered', 'Non couverts'), count: uncovered, Icon: Home, color: 'var(--bui-warning-ink)' },
    ];
  }, [counterProperties, missingContractIds, canManageContracts, t, sectorLayer.allCoverage]);

  // Les prestataires servent à lire qui couvre et qui intervient : pas les séjours ni les anomalies.
  const emptyState = loading ? (
    <div className="space-y-2 p-3" role="status" aria-label={t('common.loading')}>
      <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
    </div>
  ) : mapMarkers.length === 0 ? (
    <EmptyState
      variant="plain"
      icon={<Home />}
      title={t('propertyMap.noCoordinatesTitle')}
      description={t('propertyMap.noCoordinates')}
    />
  ) : scopedViewport.length === 0 ? (
    <EmptyState
      variant="plain"
      icon={<Home />}
      title={t('propertyMap.emptyZoneTitle')}
      description={t('propertyMap.emptyZone')}
    />
  ) : undefined;

  return <>
    <MapCardCoordinator><MapRowInteractions.Provider value={interactions}>
    <MapWithSheet
      desktopLayout="split"
      className="baitly-properties-map"
      listResetKey={`${view}:${scopeKey}:${context.period}:${context.from}:${context.to}:${scopedViewport.length}`}
      aside={sectorLayer.panel}
      map={
        <BaitlyPropertyMap
          properties={markers}
          center={homeCenter}
          height="100%"
          renderPopup={(marker) => {
            if (marker.type === 'key_exchange') {
              const point = keyPoints.find((candidate) => candidate.id === marker.id);
              return point ? <KeyPointMapCard point={point} /> : null;
            }
            return marker.id ? (
              <PropertyMapCard propertyId={marker.id} view={view} onShowView={setView}
                providerDate={range.from}
                range={range}
                onDayAssignee={view === 'prestations' ? focusProviderUser : undefined} />
            ) : null;
          }}
          onBoundsChange={handleBoundsChange}
          sectors={sectorLayer.overlay}
          mapTools={<>{sectorLayer.tool}
            <BaitlyMapFilters context={context} onChange={patch} hasArea={!!context.area || !!sectorLayer.selectedArea}
              issuePeriod={view === 'issues' && !!range.from}
              onClearArea={sectorLayer.clearArea} onReset={() => {
                reset(); sectorLayer.clearArea(); setSelectedPropertyId(null); setHighlightedId(null);
                setLocateProperty(null); setResetCameraKey(value => value + 1);
                setParams(previous => { const next = new URLSearchParams(previous); next.delete('type'); next.set('tab', 'properties'); return next; }, { replace: true });
                onResetPropertyFilters?.();
              }} />
          </>}
          focusBounds={sectorLayer.focusBounds}
          highlightedPropertyId={highlightedId ?? undefined}
          locateProperty={locateProperty}
          resetCameraKey={resetCameraKey}
          onMarkerClick={marker => { if (marker.type !== 'key_exchange') setSelectedPropertyId(marker.id ?? null); }}
          onMarkerClose={marker => setSelectedPropertyId(current => current === marker.id ? null : current)}
          onMarkerHover={marker => setHighlightedId(marker?.type !== 'key_exchange' ? marker?.id ?? null : null)}
          camera={contextReady ? context.camera : null}
          onCameraChange={camera => { if (contextReady) patch({ camera }); }}
        />
      }
      listTitle={view === 'prestations'
        ? t('prestations.mapVisible', { count: periodValid ? prestationPages.data?.pages[0]?.totalElements ?? 0 : 0 })
        : view === 'issues'
          ? t('propertyMap.issuesVisible', { count: visibleIssues.length, defaultValue: '{{count}} anomalie(s) dans cette zone' })
        : view === 'reservations'
          ? t('propertyMap.reservationsVisible', { count: visibleReservations.length, defaultValue: '{{count}} séjour(s) dans cette zone' })
          : t('propertyMap.visible', { count: scopedViewport.length })}
      listIndicators={view !== 'properties' ? undefined : 
        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
          {indicators.map(({ key, label, count, Icon, color }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button type="button"
                  aria-pressed={context.quick === key}
                  disabled={key === 'uncovered' && !sectorLayer.allCoverage}
                  onClick={() => patch({ quick: context.quick === key ? 'all' : key as MapQuickFilter })}
                  aria-label={`${count} ${label}`}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-1 outline-none hover:bg-muted aria-pressed:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50"
                >
                  <Icon size={15} style={{ color }} aria-hidden />
                  <span className="font-semibold">{count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      }
      emptyState={view === 'properties' ? emptyState : undefined}
    >
      {view === 'prestations' && periodValid && (
        <PrestationsMapList pages={prestationPages} bounds={mapBounds} category={category} onCategoryChange={setCategory} />
      )}
      {view === 'issues' && (
        <IssuesMapList issues={visibleIssues} allIssues={issuesQuery.data ?? []} loading={issuesQuery.isLoading} failed={issuesQuery.isError} />
      )}
      {view === 'reservations' && (
        <ReservationsMapList reservations={visibleReservations} loading={reservationsQuery.isLoading} failed={reservationsQuery.isError} />
      )}
      {view === 'properties' && visibleProperties.map((property) => (
        <MapLinkedRow key={property.id} propertyId={Number(property.id)} showLocate={false}><PropertyMapRow
          property={property}
          channexMapping={channexMappings.get(Number(property.id))}
          onDiagnose={onDiagnose}
          showMissingContract={canManageContracts && missingContractIds.has(Number(property.id))}
          onMissingContractClick={onMissingContractClick}
        /></MapLinkedRow>
      ))}
      {view === 'properties' && hasMore && (
        <div ref={endRef} className="flex shrink-0 justify-center p-3">
          <Button variant="ghost" onClick={() => setVisibleCount((count) => count + BATCH_SIZE)}>
            {t('missionMap.loadMore')}
          </Button>
        </div>
      )}
    </MapWithSheet>
    </MapRowInteractions.Provider></MapCardCoordinator>
  </>;
};

export default PropertiesMapView;
