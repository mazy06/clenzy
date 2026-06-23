import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  Cancel,
  Description,
  Assignment,
} from '../../icons';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import { useServiceRequestsList } from './useServiceRequestsList';
import { statusColors, priorityColors, typeIcons } from './serviceRequestsUtils';
import {
  DeleteConfirmDialog,
  StatusChangeDialog,
  AssignDialog,
  ErrorDialog,
  SuccessDialog,
} from './ServiceRequestsDialogs';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import { ITEMS_PER_PAGE } from './serviceRequestsListConstants';
import ServiceRequestsMapView from './ServiceRequestsMapView';
import ServiceRequestsGridView from './ServiceRequestsGridView';
import ServiceRequestsTableView from './ServiceRequestsTableView';

interface ServiceRequestsListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

export default function ServiceRequestsList({ embedded = false, actionsContainer, filtersContainer }: ServiceRequestsListProps) {
  const {
    // Filter state
    searchTerm,
    setSearchTerm,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    selectedPriority,
    setSelectedPriority,

    // Menu state
    anchorEl,
    selectedServiceRequest,

    // Data
    serviceRequests,
    loading,
    filteredServiceRequests,

    // Delete dialog
    deleteDialogOpen,
    setDeleteDialogOpen,

    // Status change dialog
    statusChangeDialogOpen,
    setStatusChangeDialogOpen,
    selectedRequestForStatusChange,
    setSelectedRequestForStatusChange,
    newStatus,
    setNewStatus,

    // Assign dialog
    assignDialogOpen,
    selectedRequestForAssignment,
    assignAssignmentType,
    setAssignAssignmentType,
    assignSelectedTeamId,
    setAssignSelectedTeamId,
    assignSelectedUserId,
    setAssignSelectedUserId,
    assignTeams,
    assignUsers,
    loadingAssignData,

    // Validate dialog
    validateDialogOpen,
    setValidateDialogOpen,
    selectedRequestForValidation,
    setSelectedRequestForValidation,
    validating,

    // Error/success dialogs
    errorDialogOpen,
    setErrorDialogOpen,
    errorMessage,
    successDialogOpen,
    setSuccessDialogOpen,
    successMessage,

    // Handlers
    handleMenuOpen,
    handleMenuClose,
    handleEdit,
    handleViewDetails,
    handleDelete,
    confirmDelete,
    confirmStatusChange,
    handleAssignServiceRequest,
    confirmAssignment,
    closeAssignDialog,
    handleValidateAndCreateIntervention,
    confirmValidation,

    // Permission checks
    canModifyServiceRequest,
    canDeleteServiceRequest,
    canCancelServiceRequest,
    getRemainingCancellationTime,

    // Filter options
    serviceTypes,
    statuses,
    priorities,

    // Auth
    isAdmin,
    isManager,
    isHost,
    navigate,
    t,
  } = useServiceRequestsList();

  const [page, setPage] = useState(0);
  // Auto default : map si au moins 1 demande a une propriete geocodee, sinon list.
  // undefined tant qu'on charge -> le hook conserve son fallback initial.
  const autoDefaultMode = useMemo<'map' | 'list' | undefined>(() => {
    if (loading) return undefined;
    return serviceRequests.some((r) => r.propertyLatitude && r.propertyLongitude)
      ? 'map'
      : 'list';
  }, [loading, serviceRequests]);
  const [viewMode, setViewMode] = usePersistedViewMode<'grid' | 'list' | 'map'>(
    'service-requests',
    'map',
    ['grid', 'list', 'map'] as const,
    autoDefaultMode,
  );

  // ─── Map state ──────────────────────────────────────────────
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => setMapBounds(bounds), 300);
  }, []);

  useEffect(() => {
    if (viewMode !== 'map') setMapBounds(null);
  }, [viewMode]);

  const mapMarkers: PropertyMarker[] = useMemo(
    () =>
      filteredServiceRequests
        .filter((r) => r.propertyLatitude && r.propertyLongitude)
        .map((r) => ({
          lat: r.propertyLatitude!,
          lng: r.propertyLongitude!,
          name: `${r.title} — ${r.propertyName}`,
          id: Number(r.id),
          type: 'property' as const,
        })),
    [filteredServiceRequests],
  );

  const viewportRequests = useMemo(() => {
    if (!mapBounds) return filteredServiceRequests.filter((r) => r.propertyLatitude && r.propertyLongitude);
    const pad = 0.005;
    return filteredServiceRequests.filter((r) => {
      if (!r.propertyLatitude || !r.propertyLongitude) return false;
      return (
        r.propertyLatitude >= mapBounds.south - pad &&
        r.propertyLatitude <= mapBounds.north + pad &&
        r.propertyLongitude >= mapBounds.west - pad &&
        r.propertyLongitude <= mapBounds.east + pad
      );
    });
  }, [filteredServiceRequests, mapBounds]);

  // Dynamic page size based on available viewport height
  const { containerRef: listContainerRef, pageSize: rowsPerPage } = useDynamicPageSize({
    rowHeight: 49,
    headerHeight: 42,
    bottomChrome: 72,
    min: 5,
    max: 50,
  });

  // Reset page when dynamic page size changes
  useEffect(() => { setPage(0); }, [rowsPerPage]);

  const effectivePageSize = viewMode === 'grid' ? ITEMS_PER_PAGE : rowsPerPage;

  const paginatedServiceRequests = useMemo(
    () => filteredServiceRequests.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [filteredServiceRequests, page, effectivePageSize]
  );

  // Reset page quand les filtres changent
  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedType, selectedStatus, selectedPriority, viewMode]);

  // Deep-link notification : surligne la demande ciblee (?highlight=<srId>).
  // Force la vue liste (les cartes/lignes portent data-highlight-id, pas la carte) et
  // ouvre la page qui contient la demande pour qu'elle soit visible avant le flash.
  const highlightId = useHighlightParam();
  const highlightApplied = useRef(false);
  useEffect(() => {
    if (!highlightId || loading || highlightApplied.current) return;
    const idx = filteredServiceRequests.findIndex((r) => String(r.id) === highlightId);
    if (idx < 0) return;
    highlightApplied.current = true;
    if (viewMode === 'map') setViewMode('list');
    const size = viewMode === 'grid' ? ITEMS_PER_PAGE : rowsPerPage;
    setPage(Math.floor(idx / size));
  }, [highlightId, loading, filteredServiceRequests, viewMode, rowsPerPage, setViewMode]);

  useHighlightTarget(highlightId, !loading && filteredServiceRequests.length > 0);

  const exportColumns: ExportColumn[] = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Titre' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Statut' },
    { key: 'priority', label: 'Priorité' },
    { key: 'propertyName', label: 'Propriété' },
    { key: 'requestorName', label: 'Demandeur' },
    { key: 'assignedToName', label: 'Assigné à' },
    { key: 'dueDate', label: "Date d'échéance", formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
    { key: 'createdAt', label: 'Date de création', formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
  ], []);

  // Icon-button d'action principale : contour accent + fond accent-soft au survol
  // (pattern boutons baseline — jamais d'aplat plein).
  const createButtonSx = {
    p: 0.5,
    borderRadius: '9px',
    border: '1px solid var(--accent)',
    color: 'var(--accent)',
    bgcolor: 'transparent',
    transition: 'background-color .14s, border-color .14s, color .14s',
    '&:hover': { bgcolor: 'var(--accent-soft)', borderColor: 'var(--accent-deep)', color: 'var(--accent-deep)' },
  } as const;

  const actionButtons = (
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
      <ExportButton
        data={filteredServiceRequests}
        columns={exportColumns}
        fileName="demandes-service"
        variant="icon"
      />
      <Tooltip title={t('serviceRequests.create')}>
        <IconButton
          size="small"
          onClick={() => navigate('/service-requests/new')}
          sx={createButtonSx}
        >
          <Add size={20} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const filterBar = (
    <FilterSearchBar
      bare
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder={t('serviceRequests.search')}
      filters={{
        type: {
          value: selectedType,
          options: serviceTypes,
          onChange: setSelectedType,
          label: t('common.type')
        },
        status: {
          value: selectedStatus,
          options: statuses,
          onChange: setSelectedStatus,
          label: t('common.status')
        },
        priority: {
          value: selectedPriority,
          options: priorities,
          onChange: setSelectedPriority,
          label: t('serviceRequests.fields.priority')
        }
      }}
      counter={{
        label: t('serviceRequests.request'),
        count: filteredServiceRequests.length,
        singular: "",
        plural: "s"
      }}
      viewToggle={{
        mode: viewMode,
        onChange: setViewMode,
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
            title={t('serviceRequests.title')}
            subtitle={t('serviceRequests.subtitle')}
            iconBadge={<Description />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </Box>
      )}

      {/* Liste des demandes de service */}
      {filteredServiceRequests.length === 0 ? (
        <EmptyState
          icon={<Description />}
          title={t('serviceRequests.noRequestFound')}
          description={`${
            isAdmin() || isManager()
              ? t('serviceRequests.noRequestCreated')
              : t('serviceRequests.noRequestAssigned')
          } — ${t('serviceRequests.requestsDescription')}`}
          action={(isAdmin() || isManager() || isHost()) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add size={16} strokeWidth={1.75} />}
              onClick={() => navigate('/service-requests/new')}
            >
              {t('serviceRequests.createFirst')}
            </Button>
          )}
        />
      ) : viewMode === 'map' ? (
        <ServiceRequestsMapView
          mapMarkers={mapMarkers}
          viewportRequests={viewportRequests}
          onBoundsChange={handleBoundsChange}
          navigate={navigate}
        />
      ) : viewMode === 'grid' ? (
        <ServiceRequestsGridView
          serviceRequests={paginatedServiceRequests}
          totalCount={filteredServiceRequests.length}
          page={page}
          onPageChange={setPage}
          onMenuOpen={handleMenuOpen}
          typeIcons={typeIcons}
          statuses={statuses}
          priorities={priorities}
          statusColors={statusColors}
          priorityColors={priorityColors}
          navigate={navigate}
        />
      ) : (
        <ServiceRequestsTableView
          serviceRequests={paginatedServiceRequests}
          totalCount={filteredServiceRequests.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          containerRef={listContainerRef}
          onMenuOpen={handleMenuOpen}
          navigate={navigate}
        />
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <Visibility size={20} strokeWidth={1.75} />
          </ListItemIcon>
          {t('serviceRequests.viewDetails')}
        </MenuItem>

        {/* Action d'assignation - visible pour managers et admins si la demande n'est pas assignee */}
        {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && !selectedServiceRequest.assignedToId && (
          <MenuItem onClick={() => {
            handleAssignServiceRequest(selectedServiceRequest);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <Assignment fontSize="small" color="primary" />
            </ListItemIcon>
            {t('serviceRequests.assign')}
          </MenuItem>
        )}

        {/* Option de modification - toujours visible si permissions */}
        {selectedServiceRequest && canModifyServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <Edit size={20} strokeWidth={1.75} />
            </ListItemIcon>
            {t('serviceRequests.modify')}
          </MenuItem>
        )}

        {/* Option de suppression - seulement si pas approuvee */}
        {selectedServiceRequest && canDeleteServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={handleDelete}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            {t('serviceRequests.delete')}
          </MenuItem>
        )}

        {/* Option d'annulation - seulement si approuvee */}
        {selectedServiceRequest && canCancelServiceRequest(selectedServiceRequest) && (
          <MenuItem onClick={() => {
            setSelectedRequestForStatusChange(selectedServiceRequest);
            setNewStatus('CANCELLED');
            setStatusChangeDialogOpen(true);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <Cancel fontSize="small" color="warning" />
            </ListItemIcon>
            <ListItemText
              primary={t('serviceRequests.cancel')}
              secondary={`Temps restant: ${Math.round(getRemainingCancellationTime(selectedServiceRequest.createdAt))}h`}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Dialogs */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        requestTitle={selectedServiceRequest?.title}
        t={t}
      />

      <StatusChangeDialog
        open={statusChangeDialogOpen}
        onClose={() => setStatusChangeDialogOpen(false)}
        onConfirm={confirmStatusChange}
        requestTitle={selectedRequestForStatusChange?.title}
        newStatus={newStatus}
        onStatusChange={setNewStatus}
        statuses={statuses}
        t={t}
      />

      <AssignDialog
        open={assignDialogOpen}
        onClose={closeAssignDialog}
        onConfirm={confirmAssignment}
        selectedRequest={selectedRequestForAssignment}
        assignmentType={assignAssignmentType}
        onAssignmentTypeChange={setAssignAssignmentType}
        selectedTeamId={assignSelectedTeamId}
        onTeamChange={setAssignSelectedTeamId}
        selectedUserId={assignSelectedUserId}
        onUserChange={setAssignSelectedUserId}
        teams={assignTeams}
        users={assignUsers}
        loadingData={loadingAssignData}
        t={t}
      />

      <ErrorDialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        message={errorMessage}
        t={t}
      />

      <SuccessDialog
        open={successDialogOpen}
        onClose={() => setSuccessDialogOpen(false)}
        message={successMessage}
        t={t}
      />
    </Box>
  );
}
