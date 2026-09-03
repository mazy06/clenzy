import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
import { useAuth } from '../../hooks/useAuth';
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
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
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

interface PropertiesListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

export default function PropertiesList({ embedded = false, actionsContainer, filtersContainer }: PropertiesListProps) {
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
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
  const kpiMap = usePropertyKpiSummaries(allPropertyIds);

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
    enabled: cleaningEstimateIds.length > 0,
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
      label: option.label
    }))
  ];

  // ─── Render ───────────────────────────────────────────────────────

  const actionButtons = (
    <div className="flex gap-1 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Action principale de l'écran, mais dans un en-tête déjà dense :
              contour de marque plutôt qu'un aplat plein. */}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('properties.create')}
            onClick={() => navigate('/properties/new')}
            className="border-solid border-primary bg-transparent text-primary hover:bg-primary-soft hover:text-primary"
          >
            <Add size={20} strokeWidth={1.75} />
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
      viewToggle={{
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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Portail des actions vers le PageHeader du parent en mode embarqué.
          Ternaires explicites (au lieu de &&) pour ne jamais passer le booléen
          `false` en children. */}
      {embedded && actionsContainer ? createPortal(compactHeaderActions(actionButtons), actionsContainer) : null}
      {embedded && filtersContainer ? createPortal(filterBar, filtersContainer) : null}

      {!embedded ? (
        <div className="shrink-0">
          <PageHeader
            title={t('properties.title')}
            subtitle={t('properties.subtitle')}
            iconBadge={<Home />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </div>
      ) : null}

      {/* Gate de rattrapage : rappel des logements sans contrat de gestion actif.
          Le variant `warning` du primitif porte deja le fond pastel et l'encre
          `-ink` : aucune couleur n'est reecrite ici, seule la mise en ligne. */}
      {canManageContracts && missingContractIds.size > 0 ? (
        <MissingContractsBanner
          count={missingContractIds.size}
          onEstablish={() => openContractModal([...missingContractIds][0] ?? null)}
          className="mb-1.5"
        />
      ) : null}

      {/* Tuiles portefeuille (projection) — l'agrégat suit les filtres. */}
      {filteredProperties.length > 0 && (
        <PropertiesPortfolioTiles properties={filteredProperties} kpiMap={kpiMap} />
      )}

      {/* Liste des propriétés */}
      {filteredProperties.length === 0 ? (
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
            ? 'Astuce : une fois une propriété créée, branche son lien iCal pour synchroniser automatiquement les réservations Airbnb.'
            : undefined}
        />
      ) : viewMode === 'map' ? (
        <PropertiesMapView
          mapMarkers={mapMarkers}
          viewportProperties={viewportProperties}
          channexMappings={channexMappings}
          onBoundsChange={handleBoundsChange}
          onDiagnose={openDiagnoseFor}
          canManageContracts={canManageContracts}
          missingContractIds={missingContractIds}
          onMissingContractClick={openContractModal}
          navigate={navigate}
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
  );
}
