import React from 'react';
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
  DeleteConfirmDialog,
  StatusChangeDialog,
  AssignDialog,
  ValidateConfirmDialog,
  ErrorDialog,
  SuccessDialog,
} from './ServiceRequestsDialogs';

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

  const exportColumns: ExportColumn[] = [
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
  ];

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
      />

      {/* Liste des demandes de service */}
      <Grid container spacing={2}>
        {filteredServiceRequests.length === 0 ? (
          <Grid item xs={12}>
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
                {(false || isAdmin() || isManager() || isHost()) && (
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
          </Grid>
        ) : (
          filteredServiceRequests.map((request) => (
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
          ))
        )}
      </Grid>

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
