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
}) => {
  // Calques et compteurs secondaires (secteurs, anomalies) : après le premier rendu utile.
  const secondaryReady = useIdleReady(!loading);
  const setView = useCallback((next: PropertyMapView) => onViewChange?.(next), [onViewChange]);
  const { t } = useTranslation();
  const homeCenter = useHomeMapCenter();

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
  const sectorLayer = useProviderSectorLayer(mapBounds, secondaryReady);

  // Onglet du menu Carte : Logements, Prestations (interventions + demandes), Réservations, Anomalies.
  const [params, setParams] = useSearchParams();
  const category = categoryFromParam(params.get('type'));
  const setCategory = useCallback((next: PrestationCategory) => setParams((previous) => {
    const updated = new URLSearchParams(previous);
    if (next === 'all') updated.delete('type'); else updated.set('type', next === 'request' ? 'requests' : 'interventions');
    return updated;
  }, { replace: true }), [setParams]);
  const prestationPins = usePrestationPins(category, view === 'prestations');
  const prestationPages = useMissionMapPages<PrestationRow>('prestations', prestationPins.filters, mapBounds, view === 'prestations');
  const reservationsQuery = useReservationWindow(view === 'reservations');
  // Anomalies à traiter : leur pastille d'alerte reste sur les épingles dans toutes les vues.
  const issuesQuery = useOpenIssues(secondaryReady);
  const worstIssues = useMemo(() => worstIssueByProperty(issuesQuery.data ?? []), [issuesQuery.data]);
  const visibleIssues = useMemo(() => {
    const visible = new Set(viewportProperties.map((property) => Number(property.id)));
    return (issuesQuery.data ?? []).filter((issue) => visible.has(issue.propertyId));
  }, [issuesQuery.data, viewportProperties]);
  // Le prestataire d'une prestation n'a de sens que dans la vue Prestations.
  const { focusProviderUser } = sectorLayer;
  useEffect(() => { if (view !== 'prestations') focusProviderUser(null); }, [view, focusProviderUser]);

  const reservationPropertyIds = useMemo(
    () => new Set((reservationsQuery.data ?? []).map((reservation) => reservation.propertyId)),
    [reservationsQuery.data],
  );
  const visibleReservations = useMemo(() => {
    const visible = new Set(viewportProperties.map((property) => Number(property.id)));
    return (reservationsQuery.data ?? []).filter((reservation) => visible.has(reservation.propertyId));
  }, [reservationsQuery.data, viewportProperties]);

  const propertyMarkers = useMemo<PropertyMarker[]>(
    () => [
      ...mapMarkers.map((marker) => ({
        ...marker,
        state: sectorLayer.coverage
          ? ((sectorLayer.coverage.get(Number(marker.id))?.length ?? 0) > 0 ? 'covered' as const : 'uncovered' as const)
          : propertyMarkerState(marker, statesQuery.data),
      })),
      ...keyPoints.map((point) => ({
        id: point.id,
        lat: point.storeLat as number,
        lng: point.storeLng as number,
        name: point.storeName,
        type: 'key_exchange' as const,
      })),
    ],
    [mapMarkers, keyPoints, statesQuery.data, sectorLayer.coverage],
  );
  // Une épingle reste un logement ; chaque vue ne garde que les logements concernés.
  const viewMarkers = useMemo<PropertyMarker[]>(() => {
    if (view === 'issues') {
      return mapMarkers.filter((marker) => worstIssues.has(Number(marker.id)))
        .map((marker) => {
          const severity = worstIssues.get(Number(marker.id));
          return { ...marker, state: severity === 'CRITICAL' || severity === 'HIGH' ? 'alert' as const : undefined };
        });
    }
    if (view === 'prestations') {
      return mapMarkers.filter((marker) => prestationPins.byProperty.has(Number(marker.id)))
        .map((marker) => ({ ...marker, state: prestationPins.byProperty.get(Number(marker.id))?.state }));
    }
    if (view === 'reservations') {
      return mapMarkers.filter((marker) => reservationPropertyIds.has(Number(marker.id)))
        .map((marker) => ({ ...marker, state: propertyMarkerState(marker, statesQuery.data) }));
    }
    return propertyMarkers;
  }, [view, mapMarkers, prestationPins.byProperty, reservationPropertyIds, statesQuery.data, propertyMarkers, worstIssues]);
  const markers = useMemo<PropertyMarker[]>(() => viewMarkers.map((marker) => {
    if (marker.type === 'key_exchange') return marker;
    const severity = worstIssues.get(Number(marker.id));
    return severity ? { ...marker, alert: severity.toLowerCase() as PropertyMarker['alert'] } : marker;
  }), [viewMarkers, worstIssues]);

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [viewportProperties]);
  const visibleProperties = viewportProperties.slice(0, visibleCount);
  const hasMore = visibleCount < viewportProperties.length;
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
    const counts = viewportProperties.reduce(
      (accumulator, property) => {
        const status = String(property.status).toUpperCase();
        if (status === 'ACTIVE') accumulator.active += 1;
        if (status === 'MAINTENANCE' || status === 'UNDER_MAINTENANCE') accumulator.maintenance += 1;
        if (missingContractIds.has(Number(property.id))) accumulator.missing += 1;
        return accumulator;
      },
      { active: 0, maintenance: 0, missing: 0 },
    );
    return [
      { key: 'active', label: t('properties.statuses.ACTIVE'), count: counts.active, Icon: CircleCheck, color: 'var(--bui-success-ink)' },
      { key: 'maintenance', label: t('properties.statuses.MAINTENANCE'), count: counts.maintenance, Icon: Wrench, color: 'var(--bui-warning-ink)' },
      ...(canManageContracts
        ? [{ key: 'missing', label: t('contracts.gate.badge', 'Contrat manquant'), count: counts.missing, Icon: AlertTriangle, color: 'var(--bui-destructive-ink)' }]
        : []),
    ];
  }, [viewportProperties, missingContractIds, canManageContracts, t]);

  // Les prestataires servent à lire qui couvre et qui intervient : pas les séjours ni les anomalies.
  const sectorsShown = view === 'properties' || view === 'prestations';

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
  ) : viewportProperties.length === 0 ? (
    <EmptyState
      variant="plain"
      icon={<Home />}
      title={t('propertyMap.emptyZoneTitle')}
      description={t('propertyMap.emptyZone')}
    />
  ) : undefined;

  return (
    <MapWithSheet
      desktopLayout="split"
      className="baitly-properties-map"
      listResetKey={`${view}:${viewportProperties.length}:${viewportProperties[0]?.id ?? ''}`}
      aside={sectorsShown ? sectorLayer.panel : undefined}
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
                onDayAssignee={view === 'prestations' ? focusProviderUser : undefined} />
            ) : null;
          }}
          onBoundsChange={handleBoundsChange}
          sectors={sectorsShown ? sectorLayer.overlay : null}
          mapTools={sectorsShown ? sectorLayer.tool : undefined}
          focusBounds={sectorsShown ? sectorLayer.focusBounds : null}
        />
      }
      listTitle={view === 'prestations'
        ? t('prestations.mapVisible', { count: prestationPages.data?.pages[0]?.totalElements ?? 0 })
        : view === 'issues'
          ? t('propertyMap.issuesVisible', { count: visibleIssues.length, defaultValue: '{{count}} anomalie(s) dans cette zone' })
        : view === 'reservations'
          ? t('propertyMap.reservationsVisible', { count: visibleReservations.length, defaultValue: '{{count}} séjour(s) dans cette zone' })
          : t('propertyMap.visible', { count: viewportProperties.length })}
      listIndicators={view !== 'properties' ? undefined : 
        <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
          {indicators.map(({ key, label, count, Icon, color }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={`${count} ${label}`}
                  className="inline-flex items-center gap-1 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon size={15} style={{ color }} aria-hidden />
                  <span className="font-semibold">{count}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      }
      emptyState={view === 'properties' ? emptyState : undefined}
    >
      {view === 'prestations' && (
        <PrestationsMapList pages={prestationPages} bounds={mapBounds} category={category} onCategoryChange={setCategory} />
      )}
      {view === 'issues' && (
        <IssuesMapList issues={visibleIssues} allIssues={issuesQuery.data ?? []} loading={issuesQuery.isLoading} failed={issuesQuery.isError} />
      )}
      {view === 'reservations' && (
        <ReservationsMapList reservations={visibleReservations} loading={reservationsQuery.isLoading} failed={reservationsQuery.isError} />
      )}
      {view === 'properties' && visibleProperties.map((property) => (
        <PropertyMapRow
          key={property.id}
          property={property}
          channexMapping={channexMappings.get(Number(property.id))}
          onDiagnose={onDiagnose}
          showMissingContract={canManageContracts && missingContractIds.has(Number(property.id))}
          onMissingContractClick={onMissingContractClick}
        />
      ))}
      {view === 'properties' && hasMore && (
        <div ref={endRef} className="flex shrink-0 justify-center p-3">
          <Button variant="ghost" onClick={() => setVisibleCount((count) => count + BATCH_SIZE)}>
            {t('missionMap.loadMore')}
          </Button>
        </div>
      )}
    </MapWithSheet>
  );
};

export default PropertiesMapView;
