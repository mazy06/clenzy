import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Add, Home } from '../../icons';
import { useNavigate } from 'react-router-dom';
import type { PropertyMapView } from './map-views/propertyMapView';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { useAuth } from '../../hooks/useAuth';
import { useIdleReady } from '../../hooks/useIdleReady';
import ListSkeleton from '../../components/ListSkeleton';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import { useChannexMappings } from '../../hooks/useChannexMappings';
import ChannexDiagnoseDialog from '../settings/components/ChannexDiagnoseDialog';
import ChannexFullDisconnectDialog from '../settings/components/ChannexFullDisconnectDialog';
import type { PropertyMarker, MapBounds } from '../../components/BaitlyPropertyMap';
import { usePropertiesList, propertiesListKeys } from '../../hooks/usePropertiesList';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import { usePropertyKpiSummaries } from '../../hooks/usePropertyKpiSummaries';
import { propertiesApi } from '../../services/api/propertiesApi';
import { useContractedPropertyIds } from '../../hooks/useContractedPropertyIds';
import ManagementContractFormModal from '../contracts/ManagementContractFormModal';
import MissingContractsBanner from '../contracts/MissingContractsBanner';
import { ITEMS_PER_PAGE } from './propertiesListConstants';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import PropertiesMapView from './PropertiesMapView';
import PropertiesGridView from './PropertiesGridView';
import PropertiesPortfolioTiles from './PropertiesPortfolioTiles';
import PropertiesTableView from './PropertiesTableView';
import PropertyDeleteDialog from './PropertyDeleteDialog';
import PropertyStatusToggleDialog from './PropertyStatusToggleDialog';
import compactHeaderActions from '../../components/compactHeaderActions';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import { useUserPreference } from '../../hooks/useUserPreference';

interface PropertiesListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
  /** Onglet du menu Carte : Logements, ou une vue carte (prestations, réservations, anomalies). */
  mapView?: PropertyMapView;
  onMapViewChange?: (view: PropertyMapView) => void;
}

export default function PropertiesList({
  embedded = false, actionsContainer, filtersContainer, mapView = 'properties', onMapViewChange,
}: PropertiesListProps) {
  // ─── React Query ──────────────────────────────────────────────────
  const { properties, isLoading, deleteProperty } = usePropertiesList();

  // Quick Win #4 : health badges Channex. Le hook gate l'appel sur le role
  // (SUPER_ADMIN/SUPER_MANAGER uniquement) → map vide pour les autres roles.
  const { mappings: channexMappings, refresh: refreshChannexMappings } = useChannexMappings();

  // Quick Win #5 : Diagnose + Repair. Le clic sur le badge ouvre un dialog qui
  // fetche le diagnostic et propose 1-3 actions (re-sync / full disconnect /
  // ouvrir le hub) en 1 clic chacune.
  const [diagnoseTarget, setDiagnoseTarget] = useState<{
    propertyId: number;
    propertyName: string;
  } | null>(null);
  const [fullDisconnectTarget, setFullDisconnectTarget] = useState<{
    propertyId: number;
    propertyName: string;
  } | null>(null);

  const openDiagnoseFor = useCallback((propertyId: number, propertyName: string) => {
    setDiagnoseTarget({ propertyId, propertyName });
  }, []);
  const handleDiagnoseFullDisconnect = useCallback(() => {
    if (!diagnoseTarget) return;
    setFullDisconnectTarget(diagnoseTarget);
  }, [diagnoseTarget]);
  // handleDiagnoseOpenHub est defini plus bas (apres const navigate = useNavigate()).

  // ─── Local UI state ───────────────────────────────────────────────
  const [propertyFilters, setPropertyFilters] = useUserPreference('map.propertyFilters', { search: '', type: 'all', status: 'all' });
  const { search: searchTerm, type: selectedType, status: selectedStatus } = propertyFilters;
  const setSearchTerm = (search: string) => setPropertyFilters({ ...propertyFilters, search });
  const setSelectedType = (type: string) => setPropertyFilters({ ...propertyFilters, type });
  const setSelectedStatus = (status: string) => setPropertyFilters({ ...propertyFilters, status });
  const [mapScopeIds, setMapScopeIds] = useState<number[] | null>(null);
  const [selectedHost] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState<PropertyListItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PropertyListItem | null>(null);
  const [page, setPage] = useState(0);
  // Auto default : map si au moins 1 propriete a des coords GPS, sinon list.
  // undefined tant qu'on charge -> le hook conserve son fallback initial.
  const autoDefaultMode = useMemo<'map' | 'list' | undefined>(() => {
    if (isLoading) return undefined;
    return properties.some((p) => p.latitude != null && p.longitude != null)
      ? 'map'
      : 'list';
  }, [isLoading, properties]);
  const [viewMode, setViewMode] = usePersistedViewMode<'grid' | 'list' | 'map'>(
    'properties',
    'map',
    ['grid', 'list', 'map'] as const,
    autoDefaultMode,
  );
  // Prestations, réservations et anomalies n'existent que sur la carte : ces onglets l'imposent.
  const mapOnly = mapView !== 'properties';
  const effectiveViewMode = mapOnly ? 'map' : viewMode;
  // Taille de page MESUREE, pas choisie : le hook partage avec Interventions,
  // Reservations et Demandes compte les lignes qui tiennent dans la hauteur
  // restante, en mesurant une vraie ligne du DOM. Les 10 lignes fixes d'avant
  // depassaient la carte sur telephone, et comme le cadre clippe sans defiler,
  // la derniere etait coupee en deux et les suivantes inatteignables.
  const { containerRef: listContainerRef, pageSize: listRowsPerPage } = useDynamicPageSize({
    rowHeight: 64,
    headerHeight: 42,
    bottomChrome: 72,
    min: 3,
    max: 50,
  });
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => propertiesApi.updateStatus(Number(id), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertiesListKeys.all });
      setStatusTarget(null);
    },
  });
  const { isAdmin, isManager, isHost } = useAuth();

  // Gate « contrat manquant » : logements de l'org sans contrat de gestion actif (rattrapage).
  const canManageContracts = isAdmin() || isManager() || isHost();
  const { propertyIds: contractedPropertyIds } = useContractedPropertyIds(canManageContracts);
  const missingContractIds = useMemo(
    () => new Set(
      canManageContracts
        ? properties.flatMap((p) => (contractedPropertyIds.has(Number(p.id)) ? [] : [Number(p.id)]))
        : [],
    ),
    [canManageContracts, properties, contractedPropertyIds],
  );
  const { t } = useTranslation();

  // Modal de création de contrat de gestion (bandeau « Établir les contrats »
  // + badge « Contrat manquant »). null = fermée ; sinon logement préselectionné.
  const [contractModalPropertyId, setContractModalPropertyId] = useState<number | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const openContractModal = useCallback((propertyId: number | null) => {
    setContractModalPropertyId(propertyId);
    setContractModalOpen(true);
  }, []);

  // Quick Win #5 suite : OPEN_HUB action depuis le diagnose dialog → on
  // navigate vers les settings. Requiert `navigate` declaree juste au-dessus.
  const handleDiagnoseOpenHub = useCallback(() => {
    navigate('/settings?tab=integrations');
  }, [navigate]);

  // Phase 3 — Deep-link depuis les notifications Channex. Quand le watchdog
  // notifie l'admin d'une erreur de sync, l'actionUrl est /properties?diagnoseChannex=42.
  // On lit le param au mount + on ouvre auto le diagnose dialog pour cette property.
  // Le mapping doit etre charge (channexMappings) pour qu'on connaisse le nom.
  useEffect(() => {
    const url = new URL(window.location.href);
    const target = url.searchParams.get('diagnoseChannex');
    if (!target || diagnoseTarget) return;
    const propertyId = Number(target);
    if (Number.isNaN(propertyId) || propertyId <= 0) return;
    const property = properties.find((p) => Number(p.id) === propertyId);
    if (!property) return; // pas encore charge ou ne nous appartient pas
    openDiagnoseFor(propertyId, property.name);
    // Nettoie le param de l'URL pour eviter une re-ouverture au prochain mount.
    url.searchParams.delete('diagnoseChannex');
    window.history.replaceState({}, '', url.toString());
  }, [properties, diagnoseTarget, openDiagnoseFor]);

  // ─── KPI opérationnels ────────────────────────────────────────────
  // Une seule requête batchée pour TOUT le portefeuille (ensemble stable :
  // pas de refetch au fil de la recherche). Les tuiles portefeuille agrègent
  // sur les logements filtrés ; la grille pioche ses cartes dans la même map.
  const allPropertyIds = useMemo(
    () => properties.map((p) => Number(p.id)),
    [properties],
  );
  // Indicateurs du portefeuille : secondaires, demandés après le premier rendu de l'écran
  // (carte et épingles d'abord) pour ne pas disputer le backend à la liste des logements.
  const secondaryReady = useIdleReady(!isLoading);
  const { map: kpiMap, isLoading: kpiLoading } = usePropertyKpiSummaries(allPropertyIds, { ready: secondaryReady });

  // ─── Filtering ────────────────────────────────────────────────────

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = property.name.toLowerCase().includes(searchLower) ||
                           property.address.toLowerCase().includes(searchLower) ||
                           property.city.toLowerCase().includes(searchLower);
      const matchesType = selectedType === 'all' || property.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
      const matchesHost = selectedHost === 'all' || property.ownerId === selectedHost;

      return matchesSearch && matchesType && matchesStatus && matchesHost;
    });
  }, [properties, searchTerm, selectedType, selectedStatus, selectedHost]);

  const effectivePageSize = viewMode === 'grid' ? ITEMS_PER_PAGE : listRowsPerPage;

  const paginatedProperties = useMemo(
    () => filteredProperties.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [filteredProperties, page, effectivePageSize]
  );

  // Coûts de ménage estimés (vrai estimateur d'intervention backend) des logements
  // visibles, en une seule requête batchée. Grid + Table les consomment (grid via
  // PropertyCard, table via map) — plus de formule frontend divergente.
  const cleaningEstimateIds = useMemo(
    () => paginatedProperties.map((p) => Number(p.id)).sort((a, b) => a - b),
    [paginatedProperties],
  );
  const cleaningEstimatesQuery = useQuery({
    queryKey: ['properties-cleaning-estimates', cleaningEstimateIds],
    queryFn: () => propertiesApi.getCleaningEstimates(cleaningEstimateIds),
    // Seules la grille et la table les affichent : rien à demander en vue carte.
    enabled: cleaningEstimateIds.length > 0 && effectiveViewMode !== 'map',
    staleTime: 60_000,
  });
  const cleaningEstimates = cleaningEstimatesQuery.data ?? {};

  // ─── Map markers (from filtered properties with coordinates) ─────
  const mapMarkers: PropertyMarker[] = useMemo(
    () =>
      filteredProperties
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          lat: p.latitude!,
          lng: p.longitude!,
          name: p.name,
          id: Number(p.id),
          type: 'property' as const,
          state: p.status === 'maintenance' ? ('alert' as const) : p.status === 'inactive' ? ('inactive' as const) : undefined,
          thumbnailUrl: toApiMediaUrl(p.imageUrl ?? p.photoUrls?.[0]) ?? null,
          subtitle: [p.address, p.city].filter(Boolean).join(', ') || null,
        })),
    [filteredProperties],
  );

  useEffect(() => {
    setPage(0);
    if (viewMode !== 'map') setMapBounds(null);
  }, [searchTerm, selectedType, selectedStatus, selectedHost, viewMode]);

  // La taille de page suit la hauteur : elle retrecit quand la fenetre retrecit
  // (ou qu'on passe en paysage). Sans ce recadrage, la page courante pouvait
  // sortir de la plage et la liste s'affichait vide.
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(filteredProperties.length / effectivePageSize) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [page, effectivePageSize, filteredProperties.length]);

  // ─── Map bounds tracking (debounced) ───────────────────────────────
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => setMapBounds(bounds), 300);
  }, []);

  useEffect(() => {
    return () => { if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current); };
  }, []);

  const viewportProperties = useMemo(() => {
    if (!mapBounds) return filteredProperties.filter((p) => p.latitude != null && p.longitude != null);
    // Small padding (~500m) so markers at the viewport edge are included
    const pad = 0.005;
    return filteredProperties.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      return (
        p.latitude >= mapBounds.south - pad &&
        p.latitude <= mapBounds.north + pad &&
        p.longitude >= mapBounds.west - pad &&
        p.longitude <= mapBounds.east + pad
      );
    });
  }, [filteredProperties, mapBounds]);

  // ─── Delete handler ───────────────────────────────────────────────

  const confirmDelete = () => {
    if (!selectedProperty) return;
    deleteProperty(selectedProperty.id);
    setDeleteDialogOpen(false);
    setSelectedProperty(null);
  };

  const handleDeleteRequest = useCallback((property: PropertyListItem) => {
    setSelectedProperty(property);
    setDeleteDialogOpen(true);
  }, []);

  // ─── Filter options ───────────────────────────────────────────────

  const propertyTypes = useMemo(() => [
    { value: 'all', label: t('properties.allTypes') },
    { value: 'apartment', label: t('properties.types.apartment') },
    { value: 'house', label: t('properties.types.house') },
    { value: 'villa', label: t('properties.types.villa') },
    { value: 'studio', label: t('properties.types.studio') },
  ], [t]);

  const exportColumns: ExportColumn[] = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'type', label: 'Type' },
    { key: 'address', label: 'Adresse' },
    { key: 'city', label: 'Ville' },
    { key: 'status', label: 'Statut' },
    { key: 'nightlyPrice', label: 'Prix/nuit (€)' },
    { key: 'bedrooms', label: 'Chambres' },
    { key: 'bathrooms', label: 'Salles de bain' },
    { key: 'squareMeters', label: 'Surface (m²)' },
  ], []);

  const statusOptions = [
    { value: 'all', label: t('properties.allStatuses') },
    ...PROPERTY_STATUS_OPTIONS.map(option => ({
      value: option.value.toLowerCase(),
      label: t(option.labelKey)
    }))
  ];

  // ─── Render ───────────────────────────────────────────────────────

  const contractReminder = canManageContracts && missingContractIds.size > 0 ? (
    <MissingContractsBanner compact count={missingContractIds.size}
      onEstablish={() => openContractModal([...missingContractIds][0] ?? null)} />
  ) : null;
  const contractHeaderActions = usePageHeaderActions(embedded ? contractReminder : null);

  const actionButtons = (
    <div className="flex gap-1 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Action principale de l'écran, mais dans un en-tête déjà dense :
              contour de marque plutôt qu'un aplat plein. */}
          <Button
            variant="outline"
            data-keep-label
            data-header-create
            aria-label={t('properties.create')}
            onClick={() => navigate('/properties/new')}
            className="border-solid border-primary bg-transparent text-primary hover:bg-primary-soft hover:text-primary"
          >
            <Add size={20} strokeWidth={1.75} />
            <span>{t('common.add', 'Ajouter')}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('properties.create')}</TooltipContent>
      </Tooltip>
    </div>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={isHost() ? t('properties.searchMy') : t('properties.search')}
      filters={{
        type: {
          value: selectedType,
          options: propertyTypes,
          onChange: setSelectedType,
          label: t('properties.type')
        },
        status: {
          value: selectedStatus,
          options: statusOptions,
          onChange: setSelectedStatus,
          label: t('properties.status')
        },
      }}
      counter={{
        label: t('properties.property'),
        count: filteredProperties.length,
        singular: "",
        plural: "s"
      }}
      viewToggle={mapOnly ? undefined : {
        mode: viewMode,
        onChange: setViewMode,
      }}
      extraActions={(
        <ExportButton
          data={filteredProperties}
          columns={exportColumns}
          fileName="proprietes"
        />
      )}
    />
  );

  const mapSurfaceRef = useRef<HTMLDivElement>(null);
  const portfolioOverlayRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const surface = mapSurfaceRef.current;
    const overlay = portfolioOverlayRef.current;
    if (!surface || !overlay || effectiveViewMode !== 'map') return;
    const measure = () => surface.style.setProperty('--map-overlay-top', `${overlay.getBoundingClientRect().height + 20}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(overlay);
    return () => { observer.disconnect(); surface.style.removeProperty('--map-overlay-top'); };
  }, [effectiveViewMode, filteredProperties.length > 0]);

  return (
    <>
      {/* Le bandeau du header deborde du rembourrage du conteneur de contenu
          (marges negatives). Il vit donc HORS de la colonne ci-dessous, dont le
          `overflow-hidden` decoupait ce debordement sur les quatre cotes : le
          bandeau s'arretait au bord du rembourrage, comme une carte. */}
      {!embedded ? (
        <div className="shrink-0">
          <PageHeader
            title={t('navigation.map', 'Carte')}
            subtitle={t('properties.pilotageSubtitle', 'Logements, prestations, séjours et anomalies, sur la carte')}
            iconBadge={<Home />}
            backPath="/dashboard"
            showBackButton={false}
            actions={<div className="flex items-center gap-2">{contractReminder}{actionButtons}</div>}
            filters={filterBar}
          />
        </div>
      ) : null}
      <div ref={mapSurfaceRef} className={`flex flex-col flex-1 min-h-0 overflow-hidden${effectiveViewMode === 'map' ? ' baitly-map-stage relative' : ''}`}>
        {/* Portail des actions vers le PageHeader du parent en mode embarqué.
            Ternaires explicites (au lieu de &&) pour ne jamais passer le booléen
            `false` en children. */}
        {embedded && actionsContainer ? createPortal(compactHeaderActions(actionButtons), actionsContainer) : null}
        {embedded && filtersContainer ? createPortal(filterBar, filtersContainer) : null}
        {contractHeaderActions}

        {/* Tuiles portefeuille (projection) — l'agrégat suit les filtres. */}
        {filteredProperties.length > 0 && (
          <div ref={portfolioOverlayRef} className={effectiveViewMode === 'map' ? 'baitly-map-stage__kpis' : undefined}>
          <PropertiesPortfolioTiles properties={effectiveViewMode === 'map' && mapScopeIds
            ? filteredProperties.filter(property => mapScopeIds.includes(Number(property.id))) : filteredProperties} kpiMap={kpiMap} loading={kpiLoading} />
          </div>
        )}

        {/* Liste des propriétés. Pendant le chargement, la carte est montée tout de suite
            (fond, contrôles, position) ; ses épingles arrivent avec les logements. */}
        {isLoading && effectiveViewMode !== 'map' ? (
          <ListSkeleton rows={6} variant="row" />
        ) : filteredProperties.length === 0 && !isLoading ? (
          <EmptyState
            icon={<Home />}
            title={t('properties.noPropertyFound')}
            description={`${
              isAdmin() || isManager()
                ? t('properties.noPropertyCreated')
                : t('properties.noPropertyAssigned')
            } — ${t('properties.propertiesDescription')}`}
            action={(isAdmin() || isManager() || isHost()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/properties/new')}
              >
                <Add size={16} strokeWidth={1.75} />
                {t('properties.createFirst')}
              </Button>
            )}
            tip={(isAdmin() || isManager() || isHost())
              ? t('properties.icalTip')
              : undefined}
          />
        ) : effectiveViewMode === 'map' ? (
          <PropertiesMapView
            view={mapView}
            onViewChange={onMapViewChange}
            loading={isLoading}
            mapMarkers={mapMarkers}
            viewportProperties={viewportProperties}
            allProperties={filteredProperties}
            onScopeChange={setMapScopeIds}
            onResetPropertyFilters={() => setPropertyFilters({ search: '', type: 'all', status: 'all' })}
            channexMappings={channexMappings}
            onBoundsChange={handleBoundsChange}
            onDiagnose={openDiagnoseFor}
            canManageContracts={canManageContracts}
            missingContractIds={missingContractIds}
            onMissingContractClick={openContractModal}
          />
        ) : viewMode === 'grid' ? (
          <PropertiesGridView
            properties={paginatedProperties}
            totalCount={filteredProperties.length}
            page={page}
            onPageChange={setPage}
            kpiMap={kpiMap}
            channexMappings={channexMappings}
            cleaningEstimates={cleaningEstimates}
            onDelete={handleDeleteRequest}
            onDiagnose={openDiagnoseFor}
            canManageContracts={canManageContracts}
            missingContractIds={missingContractIds}
            onMissingContractClick={openContractModal}
            navigate={navigate}
          />
        ) : (
          <PropertiesTableView
            properties={paginatedProperties}
            totalCount={filteredProperties.length}
            page={page}
            rowsPerPage={listRowsPerPage}
            onPageChange={setPage}
            containerRef={listContainerRef}
            channexMappings={channexMappings}
            cleaningEstimates={cleaningEstimates}
            canManageContracts={canManageContracts}
            missingContractIds={missingContractIds}
            onMissingContractClick={openContractModal}
            onToggleStatus={setStatusTarget}
            onDelete={handleDeleteRequest}
            navigate={navigate}
          />
        )}

        {/* Modal de création de contrat de gestion (gate de rattrapage). */}
        <ManagementContractFormModal
          open={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          initialPropertyId={contractModalPropertyId}
        />

        <PropertyDeleteDialog
          open={deleteDialogOpen}
          propertyName={selectedProperty?.name}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={confirmDelete}
        />

        <PropertyStatusToggleDialog
          property={statusTarget}
          pending={statusMutation.isPending}
          onClose={() => setStatusTarget(null)}
          onConfirm={() => {
            if (!statusTarget) return;
            statusMutation.mutate({
              id: statusTarget.id,
              status: statusTarget.status === 'active' ? 'INACTIVE' : 'ACTIVE',
            });
          }}
        />

        {/* FAB pour ajouter rapidement */}
        {(isAdmin() || isManager() || isHost()) ? (
          // Le bouton d'action flottant n'a pas d'equivalent dans le kit : c'est
          // un bouton rond, rendu ici par le Button du kit. Le seuil de 900 px est
          // explicite (les breakpoints Tailwind lisent 768).
          <Button
            variant="outline"
            size="icon"
            aria-label={t('properties.create')}
            onClick={() => navigate('/properties/new')}
            className="fixed bottom-4 end-4 z-40 size-10 rounded-full border-solid border-primary bg-card text-primary shadow-lg hover:bg-primary-soft hover:text-primary min-[900px]:hidden"
          >
            <Add size={20} strokeWidth={1.75} />
          </Button>
        ) : null}

        {/* Quick Win #5 : Diagnose + Repair dialog (declenche par clic sur health badge) */}
        {diagnoseTarget && (
          <ChannexDiagnoseDialog
            open={diagnoseTarget !== null}
            onClose={() => setDiagnoseTarget(null)}
            propertyId={diagnoseTarget.propertyId}
            onFullDisconnect={handleDiagnoseFullDisconnect}
            onOpenHub={handleDiagnoseOpenHub}
            onResyncSuccess={() => { void refreshChannexMappings(); }}
          />
        )}

        {/* Quick Win #2 : Smart Disconnect declenche depuis le diagnostic
            (l'utilisateur clique "Deconnecter completement" dans le diagnose dialog). */}
        {fullDisconnectTarget && (
          <ChannexFullDisconnectDialog
            open={fullDisconnectTarget !== null}
            onClose={() => setFullDisconnectTarget(null)}
            propertyId={fullDisconnectTarget.propertyId}
            propertyName={fullDisconnectTarget.propertyName}
            onSuccess={() => { void refreshChannexMappings(); }}
          />
        )}
      </div>
    </>
  );
}
