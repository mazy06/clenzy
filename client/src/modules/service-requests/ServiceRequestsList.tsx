import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TablePagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  useTheme,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  CheckCircle,
  Cancel,
  Description,
  Assignment,
  MoreVert,
  Refresh,
  LocationOn,
  Build as BuildIcon,
} from '@mui/icons-material';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import ServiceRequestCard from '../../components/ServiceRequestCard';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import { createSpacing } from '../../theme/spacing';
import { useServiceRequestsList } from './useServiceRequestsList';
import { statusColors, priorityColors, typeIcons } from './serviceRequestsUtils';
import {
  getServiceRequestStatusLabel,
  getServiceRequestStatusHex,
  getServiceRequestPriorityLabel,
  getServiceRequestPriorityHex,
} from '../../utils/statusUtils';
import {
  DeleteConfirmDialog,
  StatusChangeDialog,
  AssignDialog,
  ValidateConfirmDialog,
  ErrorDialog,
  SuccessDialog,
} from './ServiceRequestsDialogs';
import { useDynamicPageSize } from '../../hooks/useDynamicPageSize';
import { useCurrency } from '../../hooks/useCurrency';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';

const paginationSx = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 2,
  borderRadius: 1,
} as const;

const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
const LIST_DEFAULT_ROWS = 10;

const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(price: number | undefined, symbol: string): string {
  if (price === undefined || price === null) return '—';
  return `${price}${symbol}`;
}

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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('map');
  const theme = useTheme();
  const { convertAndFormat } = useCurrency();
  const ITEMS_PER_PAGE = 6;

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
        data={filteredServiceRequests}
        columns={exportColumns}
        fileName="demandes-service"
        variant="icon"
      />
      <Tooltip title={t('serviceRequests.create')}>
        <IconButton
          size="small"
          onClick={() => navigate('/service-requests/new')}
          sx={{ ...iconButtonSx, color: 'primary.main', borderColor: 'primary.main', bgcolor: 'rgba(107,138,154,0.06)' }}
        >
          <Add />
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
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </Box>
      )}

      {/* Liste des demandes de service */}
      {filteredServiceRequests.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 2.5, px: 2, ...createSpacing.card() }}>
          <CardContent>
            <Box sx={{ mb: 1.5 }}>
              <Description sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.6 }} />
            </Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('serviceRequests.noRequestFound')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {isAdmin() || isManager()
                ? t('serviceRequests.noRequestCreated')
                : t('serviceRequests.noRequestAssigned')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
              {t('serviceRequests.requestsDescription')}
            </Typography>
            {(isAdmin() || isManager() || isHost()) && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => navigate('/service-requests/new')}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  {t('serviceRequests.createFirst')}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'map' ? (
        /* ─── Vue carte + liste viewport ─── */
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 0, overflow: 'hidden', flexShrink: 0 }}>
            {mapMarkers.length > 0 ? (
              <MapboxPropertyMap
                properties={mapMarkers}
                height={400}
                onMarkerClick={(marker) => {
                  if (marker.id) navigate(`/service-requests/${marker.id}`);
                }}
                onBoundsChange={handleBoundsChange}
              />
            ) : (
              <Box sx={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <BuildIcon sx={{ fontSize: 36, color: 'text.secondary', opacity: 0.5 }} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  Aucune demande avec coordonnées GPS
                </Typography>
              </Box>
            )}
          </Paper>

          {mapMarkers.length > 0 && (
            <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}
              >
                {viewportRequests.length} {viewportRequests.length > 1 ? 'demandes' : 'demande'} dans la zone visible
              </Typography>

              {viewportRequests.length === 0 ? (
                <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                    Aucune demande dans cette zone. Déplacez ou dézoomez la carte.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
                  {viewportRequests.map((request) => {
                    const statusColor = getServiceRequestStatusHex(request.status);
                    const priorityColor = getServiceRequestPriorityHex(request.priority);
                    return (
                      <Paper
                        key={request.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          boxShadow: 'none',
                          borderRadius: 1.5,
                          p: 1.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                        }}
                        onClick={() => navigate(`/service-requests/${request.id}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {request.title}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <LocationOn sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {request.propertyName} — {request.propertyAddress}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Chip
                              label={getServiceRequestStatusLabel(request.status, t)}
                              size="small"
                              sx={{
                                backgroundColor: `${statusColor}18`,
                                color: statusColor,
                                border: `1px solid ${statusColor}40`,
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '0.62rem',
                                height: 22,
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                            <Chip
                              label={getServiceRequestPriorityLabel(request.priority, t)}
                              size="small"
                              sx={{
                                backgroundColor: `${priorityColor}18`,
                                color: priorityColor,
                                border: `1px solid ${priorityColor}40`,
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '0.62rem',
                                height: 22,
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                            {request.assignedToName && (
                              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', ml: 0.5 }}>
                                {request.assignedToName}
                              </Typography>
                            )}
                            <Tooltip title="Voir">
                              <IconButton size="small" sx={{ ml: 0.5 }}>
                                <Visibility sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
        <>
          <Grid container spacing={2}>
            {paginatedServiceRequests.map((request) => (
              <Grid item xs={12} md={6} lg={4} key={request.id}>
                <ServiceRequestCard
                  request={request}
                  onMenuOpen={handleMenuOpen}
                  typeIcons={typeIcons}
                  statuses={statuses}
                  priorities={priorities}
                  statusColors={statusColors}
                  priorityColors={priorityColors}
                />
              </Grid>
            ))}
          </Grid>
          {filteredServiceRequests.length > ITEMS_PER_PAGE && (
            <TablePagination
              component="div"
              count={filteredServiceRequests.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={ITEMS_PER_PAGE}
              rowsPerPageOptions={[ITEMS_PER_PAGE]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              sx={paginationSx}
            />
          )}
        </>
      ) : (
        /* ─── Vue liste (table) ─── */
        <Paper ref={listContainerRef} sx={{ ...LIST_PAPER_SX, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: theme.palette.text.secondary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell>Titre</TableCell>
                  <TableCell>Propriété</TableCell>
                  <TableCell>Demandeur</TableCell>
                  <TableCell>Assigné à</TableCell>
                  <TableCell align="center">Statut</TableCell>
                  <TableCell align="center">Priorité</TableCell>
                  <TableCell align="right">Coût</TableCell>
                  <TableCell>Échéance</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedServiceRequests.map((request) => (
                  <TableRow
                    key={request.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { borderBottom: 0 },
                    }}
                    onClick={() => navigate(`/service-requests/${request.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                        {request.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {request.type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {request.propertyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {request.propertyAddress}, {request.propertyCity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {request.requestorName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {request.assignedToName || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {(() => { const c = getServiceRequestStatusHex(request.status); return (
                        <Chip
                          label={getServiceRequestStatusLabel(request.status, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${c}18`,
                            color: c,
                            border: `1px solid ${c}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            height: 24,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      ); })()}
                    </TableCell>
                    <TableCell align="center">
                      {(() => { const c = getServiceRequestPriorityHex(request.priority); return (
                        <Chip
                          label={getServiceRequestPriorityLabel(request.priority, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${c}18`,
                            color: c,
                            border: `1px solid ${c}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            height: 24,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      ); })()}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                        {request.estimatedCost != null ? convertAndFormat(request.estimatedCost, 'EUR') : '—'}
                      </Typography>
                      {request.estimatedDuration > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          ~{request.estimatedDuration}h
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {formatDateShort(request.dueDate)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Détails">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); navigate(`/service-requests/${request.id}`); }}
                        >
                          <Visibility sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Actions">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, request); }}
                        >
                          <MoreVert sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredServiceRequests.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[]}
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
            sx={{ ...paginationSx, flexShrink: 0 }}
          />
        </Paper>
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
            <Visibility fontSize="small" />
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
              <Edit fontSize="small" />
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
