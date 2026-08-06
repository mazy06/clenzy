import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Alert as UiAlert, AlertDescription } from '../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { createPortal } from 'react-dom';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Build,
  Refresh,
} from '../../icons';
import { INTERVENTION_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import ExportButton from '../../components/ExportButton';
import { useInterventionsList, MAP_VIEW_PAGE_SIZE } from './useInterventionsList';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import InterventionsMapView from './InterventionsMapView';
import InterventionsGridView from './InterventionsGridView';
import InterventionsTableView from './InterventionsTableView';
import InterventionAssignDialog from './InterventionAssignDialog';

interface InterventionsListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

const ICON_BUTTON_CLASS =
  'p-[3px] rounded-md border border-solid border-border text-muted-foreground '
  + 'hover:bg-muted hover:border-faint hover:text-foreground';

const ICON_BUTTON_ACCENT_CLASS =
  'p-[3px] rounded-md border border-solid border-primary text-primary '
  + 'hover:bg-primary-soft hover:border-primary hover:text-primary';

export default function InterventionsList({ embedded = false, actionsContainer, filtersContainer }: InterventionsListProps) {
  const {
    // State
    interventions,
    loading,
    error,
    selectedIntervention,
    anchorEl,
    searchTerm,
    selectedType,
    selectedStatus,
    selectedPriority,
    page,
    pageSize,
    totalCount,
    ITEMS_PER_PAGE,
    assignDialogOpen,
    assignType,
    assignTargetId,
    teams,
    availableUsers,
    assignLoading,
    canViewInterventions,
    canCreateInterventions,
    canDeleteInterventions,
    permissionsLoading,

    // Setters
    setSearchTerm,
    setSelectedType,
    setSelectedStatus,
    setSelectedPriority,
    setPage,
    setPageSize,
    setAssignType,
    setAssignTargetId,

    // Handlers
    loadInterventions,
    handleMenuOpen,
    handleMenuClose,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleOpenAssignDialog,
    handleCloseAssignDialog,
    handleAssign,
    canModifyIntervention,

    // Computed
    filteredInterventions,
    paginatedInterventions,
    exportColumns,

    // Auth helpers
    isManager,
    isAdmin,
    navigate,
    t,
    user,
  } = useInterventionsList();

  // Auto default : map si au moins 1 intervention a une propriete geocodee, sinon list.
  // undefined tant qu'on charge -> le hook conserve son fallback initial.
  const autoDefaultMode = useMemo<'map' | 'list' | undefined>(() => {
    if (loading) return undefined;
    return interventions.some((i) => i.propertyLatitude && i.propertyLongitude)
      ? 'map'
      : 'list';
  }, [loading, interventions]);
  const [viewMode, setViewMode] = usePersistedViewMode<'grid' | 'list' | 'map'>(
    'interventions',
    'map',
    ['grid', 'list', 'map'] as const,
    autoDefaultMode,
  );
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // Dynamic page size based on available viewport height
  const { containerRef: listContainerRef, pageSize: listRowsPerPage } = useDynamicPageSize({
    rowHeight: 49,
    headerHeight: 42,
    bottomChrome: 72,
    min: 5,
    max: 50,
  });

  // Pagination SERVEUR : la taille de page suit la vue active
  // (grille = 6 cartes, table = hauteur dynamique, carte = plafond serveur).
  // setPageSize remet la page à 0 quand la taille change.
  useEffect(() => {
    const target = viewMode === 'grid'
      ? ITEMS_PER_PAGE
      : viewMode === 'list'
        ? listRowsPerPage
        : MAP_VIEW_PAGE_SIZE;
    if (target !== pageSize) setPageSize(target);
  }, [viewMode, listRowsPerPage, pageSize, setPageSize, ITEMS_PER_PAGE]);

  // ─── Map bounds tracking (debounced) ──────────────────────────────────────
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => setMapBounds(bounds), 300);
  }, []);

  useEffect(() => {
    return () => { if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current); };
  }, []);

  // Reset mapBounds when leaving map view
  useEffect(() => {
    if (viewMode !== 'map') setMapBounds(null);
  }, [viewMode]);

  // Un DropdownMenuItem Radix referme le menu de lui-meme apres selection, la
  // ou le MenuItem MUI ne le faisait pas. Sans ce garde, `onOpenChange(false)`
  // appellerait handleMenuClose(), qui EFFACE selectedIntervention — or
  // handleOpenAssignDialog doit le conserver pour la modale d'assignation.
  const menuItemSelectedRef = useRef(false);
  const onMenuItem = (action: () => void) => () => {
    menuItemSelectedRef.current = true;
    action();
  };
  const handleMenuOpenChange = (open: boolean) => {
    if (open) return;
    if (menuItemSelectedRef.current) {
      menuItemSelectedRef.current = false;
      return;
    }
    handleMenuClose();
  };

  const mapMarkers: PropertyMarker[] = useMemo(
    () =>
      filteredInterventions
        .flatMap((i) =>
          i.propertyLatitude && i.propertyLongitude
            ? [{
                lat: i.propertyLatitude!,
                lng: i.propertyLongitude!,
                name: `${i.title} — ${i.propertyName}`,
                id: i.id,
                type: 'property' as const,
              }]
            : [],
        ),
    [filteredInterventions],
  );

  const viewportInterventions = useMemo(() => {
    const withCoords = filteredInterventions.filter((i) => i.propertyLatitude && i.propertyLongitude);
    if (!mapBounds) return withCoords;
    // Small padding (~500m) so markers at the viewport edge are included
    const pad = 0.005;
    return withCoords.filter((i) => (
      i.propertyLatitude! >= mapBounds.south - pad &&
      i.propertyLatitude! <= mapBounds.north + pad &&
      i.propertyLongitude! >= mapBounds.west - pad &&
      i.propertyLongitude! <= mapBounds.east + pad
    ));
  }, [filteredInterventions, mapBounds]);

  // Compteur affiché : total serveur, sauf recherche active (filtre client
  // sur la page courante — cf. useInterventionsList).
  const displayedCount = searchTerm ? filteredInterventions.length : totalCount;

  // Protection contre les données invalides
  if (!Array.isArray(interventions)) {
    return (
      <div className="p-3">
        <UiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>Erreur de chargement des données. Veuillez rafraîchir la page.</AlertDescription>
        </UiAlert>
      </div>
    );
  }

  // Vérifications conditionnelles dans le rendu
  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  // Permissions en cours de chargement
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner className="size-8" />
      </div>
    );
  }

  // Si pas de permission, afficher un message informatif
  if (!canViewInterventions) {
    return (
      <div className="p-3">
        <UiAlert variant="info">
          <Info />
          <AlertDescription><h6 className="text-sm font-semibold mb-[0.35em]">
            {t('interventions.errors.noPermission')}
          </h6><p className="text-sm">
            {t('interventions.noPermissionMessage')}
          </p></AlertDescription>
        </UiAlert>
      </div>
    );
  }

  // Générer les types d'intervention avec traductions
  const interventionTypes = [
    { value: 'all', label: t('interventions.allTypes') },
    { value: 'CLEANING', label: 'Nettoyage' },
    { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
    { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
    { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
    { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
    { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
    { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
    { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive' },
    { value: 'EMERGENCY_REPAIR', label: "Réparation d'Urgence" },
    { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique' },
    { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie' },
    { value: 'HVAC_REPAIR', label: 'Réparation Climatisation' },
    { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager' },
    { value: 'GARDENING', label: 'Jardinage' },
    { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur' },
    { value: 'PEST_CONTROL', label: 'Désinsectisation' },
    { value: 'DISINFECTION', label: 'Désinfection' },
    { value: 'RESTORATION', label: 'Remise en État' },
    { value: 'OTHER', label: 'Autre' },
  ];

  // Générer les statuts avec traductions
  const statuses = [
    { value: 'all', label: t('interventions.allStatuses') },
    ...INTERVENTION_STATUS_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  ];

  // Générer les priorités avec traductions
  const priorities = [
    { value: 'all', label: t('interventions.allPriorities') },
    ...PRIORITY_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
  ];

  // Le bouton « … » qui ouvre le menu vit dans les vues enfant (grille / table),
  // qui remontent seulement son noeud DOM via l'`anchorEl` du hook : impossible
  // d'envelopper ce bouton dans un DropdownMenuTrigger d'ici. On accroche donc
  // Radix a une ancre invisible calee sur le rectangle du bouton, ce qui rend
  // le meme point d'ancrage que l'ancien Menu MUI.
  const anchorRect = anchorEl?.getBoundingClientRect();

  const actionButtons = (
    <div className="flex gap-1 items-center">
      <ExportButton
        data={filteredInterventions}
        columns={exportColumns}
        fileName="interventions"
        variant="icon"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span : un bouton desactive n'emet pas d'evenement de survol, et le
              Button du kit (fonction, React 18) ne transmet pas de ref. */}
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.refresh')}
              onClick={loadInterventions}
              disabled={loading}
              className={ICON_BUTTON_CLASS}
            >
              <Refresh size={18} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('common.refresh')}</TooltipContent>
      </Tooltip>
      {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
      {canCreateInterventions && (isAdmin() || isManager()) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('interventions.create')}
                onClick={() => navigate('/interventions/new')}
                className={ICON_BUTTON_ACCENT_CLASS}
              >
                <AddIcon size={20} strokeWidth={1.75} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{t('interventions.create')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('interventions.search')}
      filters={{
        type: {
          value: selectedType,
          options: interventionTypes,
          onChange: setSelectedType,
          label: t('common.type'),
        },
        status: {
          value: selectedStatus,
          options: statuses,
          onChange: setSelectedStatus,
          label: t('common.status'),
        },
        priority: {
          value: selectedPriority,
          options: priorities,
          onChange: setSelectedPriority,
          label: t('interventions.fields.priority'),
        },
      }}
      counter={{
        label: t('interventions.intervention'),
        count: displayedCount,
        singular: '',
        plural: 's',
      }}
      viewToggle={{
        mode: viewMode,
        onChange: (mode) => { setViewMode(mode); setPage(0); },
      }}
    />
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* Portal filters into parent's PageHeader when embedded */}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}

      {!embedded && (
        <div className="shrink-0">
          <PageHeader
            title={t('interventions.title')}
            subtitle={t('interventions.subtitle')}
            iconBadge={<Build />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </div>
      )}

      {error && (
        <UiAlert variant="destructive" className="mb-3 py-1.5 shrink-0">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </UiAlert>
      )}

      {/* ─── Liste des interventions ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">

          {loading ? (
            <ListSkeleton rows={6} variant="row" />
          ) : filteredInterventions.length === 0 ? (
            <EmptyState
              icon={<Build />}
              title={t('interventions.noInterventionFound')}
              description={`${
                canCreateInterventions
                  ? t('interventions.noInterventionValidated')
                  : t('interventions.noInterventionAssigned')
              } — ${t('interventions.interventionsDescription')}`}
            />
          ) : viewMode === 'map' ? (
            <InterventionsMapView
              mapMarkers={mapMarkers}
              viewportInterventions={viewportInterventions}
              onBoundsChange={handleBoundsChange}
              navigate={navigate}
            />
          ) : viewMode === 'grid' ? (
            <InterventionsGridView
              interventions={paginatedInterventions}
              totalCount={displayedCount}
              page={page}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              onMenuOpen={handleMenuOpen}
              canModifyIntervention={canModifyIntervention}
            />
          ) : (
            <InterventionsTableView
              interventions={filteredInterventions}
              totalCount={displayedCount}
              page={page}
              rowsPerPage={pageSize}
              onPageChange={setPage}
              onMenuOpen={handleMenuOpen}
              containerRef={listContainerRef}
              navigate={navigate}
            />
          )}
        </div>

      {/* ─── Menus et dialogs partagés ─────────────────────────────────────── */}
      <DropdownMenu open={Boolean(anchorEl)} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden="true"
            className="fixed pointer-events-none"
            style={{
              left: anchorRect?.left ?? 0,
              top: anchorRect?.top ?? 0,
              width: anchorRect?.width ?? 0,
              height: anchorRect?.height ?? 0,
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-[11rem]">
          <DropdownMenuItem onClick={onMenuItem(handleViewDetails)}>
            <span className="inline-flex"><VisibilityIcon size={18} strokeWidth={1.75} /></span>
            {t('interventions.viewDetails')}
          </DropdownMenuItem>
          {(isManager() || isAdmin()) && selectedIntervention?.status === 'PENDING' && (
            <DropdownMenuItem onClick={onMenuItem(handleOpenAssignDialog)}>
              <span className="inline-flex text-info"><AssignmentIcon size={18} strokeWidth={1.75} /></span>
              Assigner
            </DropdownMenuItem>
          )}
          {selectedIntervention && canModifyIntervention(selectedIntervention) && (
            <DropdownMenuItem onClick={onMenuItem(handleEdit)}>
              <span className="inline-flex"><EditIcon size={18} strokeWidth={1.75} /></span>
              Modifier
            </DropdownMenuItem>
          )}
          {canDeleteInterventions && (
            <DropdownMenuItem onClick={onMenuItem(handleDelete)}>
              <span className="inline-flex"><DeleteIcon size={18} strokeWidth={1.75} /></span>
              {t('interventions.delete')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog d'assignation rapide */}
      <InterventionAssignDialog
        open={assignDialogOpen}
        selectedIntervention={selectedIntervention}
        assignType={assignType}
        assignTargetId={assignTargetId}
        teams={teams}
        availableUsers={availableUsers}
        assignLoading={assignLoading}
        onClose={handleCloseAssignDialog}
        onAssign={handleAssign}
        setAssignType={setAssignType}
        setAssignTargetId={setAssignTargetId}
      />

    </div>
  );
}
