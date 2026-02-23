import React, { useState, useEffect, useMemo } from 'react';
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
  getServiceRequestStatusColor,
  getServiceRequestStatusLabel,
  getServiceRequestPriorityColor,
  getServiceRequestPriorityLabel,
} from '../../utils/statusUtils';
import {
  DeleteConfirmDialog,
  StatusChangeDialog,
  AssignDialog,
  ValidateConfirmDialog,
  ErrorDialog,
  SuccessDialog,
} from './ServiceRequestsDialogs';

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

function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null) return '—';
  return `${price}€`;
}

export default function ServiceRequestsList() {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [rowsPerPage, setRowsPerPage] = useState(LIST_DEFAULT_ROWS);
  const theme = useTheme();
  const ITEMS_PER_PAGE = 6;

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

  return (
    <Box>
      <PageHeader
        title={t('serviceRequests.title')}
        subtitle={t('serviceRequests.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ExportButton
              data={filteredServiceRequests}
              columns={exportColumns}
              fileName="demandes-service"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/service-requests/new')}
              size="small"
              title={t('serviceRequests.create')}
            >
              {t('serviceRequests.create')}
            </Button>
          </Box>
        }
      />

      {/* Filtres et recherche */}
      <FilterSearchBar
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
        <Paper sx={LIST_PAPER_SX}>
          <TableContainer>
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
                      <Chip
                        label={getServiceRequestStatusLabel(request.status, t)}
                        color={getServiceRequestStatusColor(request.status)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={getServiceRequestPriorityLabel(request.priority, t)}
                        color={getServiceRequestPriorityColor(request.priority)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                        {formatPrice(request.estimatedCost)}
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
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Lignes par page"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
            sx={paginationSx}
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

        {/* Action de validation et creation d'intervention - visible pour managers et admins seulement si assignee */}
        {(isAdmin() || isManager()) && selectedServiceRequest?.status === 'PENDING' && selectedServiceRequest.assignedToId && (
          <MenuItem onClick={() => {
            handleValidateAndCreateIntervention(selectedServiceRequest);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <CheckCircle fontSize="small" color="success" />
            </ListItemIcon>
            {t('serviceRequests.validateAndCreateIntervention')}
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
              secondary={`Temps restant: ${Math.round(getRemainingCancellationTime(selectedServiceRequest.approvedAt || selectedServiceRequest.createdAt))}h`}
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

      <ValidateConfirmDialog
        open={validateDialogOpen}
        onClose={() => {
          setValidateDialogOpen(false);
          setSelectedRequestForValidation(null);
        }}
        onConfirm={confirmValidation}
        selectedRequest={selectedRequestForValidation}
        validating={validating}
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
