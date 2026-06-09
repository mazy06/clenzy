import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  MenuItem,
  Alert,
  CircularProgress,
  Menu,
  IconButton,
  Tooltip,
} from '@mui/material';
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
import { createSpacing } from '../../theme/spacing';
import ExportButton from '../../components/ExportButton';
import { useInterventionsList } from './useInterventionsList';
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
  const [listPage, setListPage] = useState(0);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // Dynamic page size based on available viewport height
  const { containerRef: listContainerRef, pageSize: listRowsPerPage } = useDynamicPageSize({
    rowHeight: 49,
    headerHeight: 42,
    bottomChrome: 72,
    min: 5,
    max: 50,
  });

  // Reset page when dynamic page size changes
  useEffect(() => { setListPage(0); }, [listRowsPerPage]);

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

  const mapMarkers: PropertyMarker[] = useMemo(
    () =>
      filteredInterventions
        .filter((i) => i.propertyLatitude && i.propertyLongitude)
        .map((i) => ({
          lat: i.propertyLatitude!,
          lng: i.propertyLongitude!,
          name: `${i.title} — ${i.propertyName}`,
          id: i.id,
          type: 'property' as const,
        })),
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

  const listPaginatedInterventions = filteredInterventions.slice(
    listPage * listRowsPerPage,
    (listPage + 1) * listRowsPerPage
  );

  // Protection contre les données invalides
  if (!Array.isArray(interventions)) {
    return (
      <Box sx={createSpacing.page()}>
        <Alert severity="error">
          Erreur de chargement des données. Veuillez rafraîchir la page.
        </Alert>
      </Box>
    );
  }

  // Vérifications conditionnelles dans le rendu
  if (!user) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} />
      </Box>
    );
  }

  // Permissions en cours de chargement
  if (permissionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={32} />
      </Box>
    );
  }

  // Si pas de permission, afficher un message informatif
  if (!canViewInterventions) {
    return (
      <Box sx={createSpacing.page()}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            {t('interventions.errors.noPermission')}
          </Typography>
          <Typography variant="body1">
            {t('interventions.noPermissionMessage')}
          </Typography>
        </Alert>
      </Box>
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

  const iconButtonSx = {
    p: 0.5,
    borderRadius: 1,
    border: '1px solid',
    borderColor: 'divider',
    color: 'text.secondary',
    '&:hover': { bgcolor: 'rgba(107,138,154,0.08)', borderColor: 'primary.main', color: 'primary.main' },
    '& .MuiSvgIcon-root': { fontSize: 18 },
  } as const;

  const actionButtons = (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
      <ExportButton
        data={filteredInterventions}
        columns={exportColumns}
        fileName="interventions"
        variant="icon"
      />
      <Tooltip title={t('common.refresh')}>
        <IconButton
          onClick={loadInterventions}
          disabled={loading}
          size="small"
          sx={iconButtonSx}
        >
          <Refresh size={18} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
      {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
      {canCreateInterventions && (isAdmin() || isManager()) && (
        <Tooltip title={t('interventions.create')}>
          <IconButton
            size="small"
            onClick={() => navigate('/interventions/new')}
            sx={{ ...iconButtonSx, color: 'primary.main', borderColor: 'primary.main', bgcolor: 'rgba(107,138,154,0.06)' }}
          >
            <AddIcon size={20} strokeWidth={1.75} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
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
        count: filteredInterventions.length,
        singular: '',
        plural: 's',
      }}
      viewToggle={{
        mode: viewMode,
        onChange: (mode) => { setViewMode(mode); setListPage(0); },
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* Portal filters into parent's PageHeader when embedded */}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}

      {!embedded && (
        <Box sx={{ flexShrink: 0 }}>
          <PageHeader
            title={t('interventions.title')}
            subtitle={t('interventions.subtitle')}
            iconBadge={<Build />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* ─── Liste des interventions ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

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
              totalCount={filteredInterventions.length}
              page={page}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPage}
              onMenuOpen={handleMenuOpen}
              canModifyIntervention={canModifyIntervention}
            />
          ) : (
            <InterventionsTableView
              interventions={listPaginatedInterventions}
              totalCount={filteredInterventions.length}
              page={listPage}
              rowsPerPage={listRowsPerPage}
              onPageChange={setListPage}
              onMenuOpen={handleMenuOpen}
              containerRef={listContainerRef}
              navigate={navigate}
            />
          )}
        </Box>

      {/* ─── Menus et dialogs partagés ─────────────────────────────────────── */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleViewDetails} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <Box component="span" sx={{ display: "inline-flex", mr: 1 }}><VisibilityIcon size={18} strokeWidth={1.75} /></Box>
          {t('interventions.viewDetails')}
        </MenuItem>
        {(isManager() || isAdmin()) && selectedIntervention?.status === 'PENDING' && (
          <MenuItem onClick={handleOpenAssignDialog} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <Box component="span" sx={{ display: "inline-flex", mr: 1, color: "info.main" }}><AssignmentIcon size={18} strokeWidth={1.75} /></Box>
            Assigner
          </MenuItem>
        )}
        {selectedIntervention && canModifyIntervention(selectedIntervention) && (
          <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <Box component="span" sx={{ display: "inline-flex", mr: 1 }}><EditIcon size={18} strokeWidth={1.75} /></Box>
            Modifier
          </MenuItem>
        )}
        {canDeleteInterventions && (
          <MenuItem onClick={handleDelete} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <Box component="span" sx={{ display: "inline-flex", mr: 1 }}><DeleteIcon size={18} strokeWidth={1.75} /></Box>
            {t('interventions.delete')}
          </MenuItem>
        )}
      </Menu>

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

    </Box>
  );
}
