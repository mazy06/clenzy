import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select as MuiSelect,
  TablePagination,
  Menu,
} from '@mui/material';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import InterventionCard from './InterventionCard';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Build,
  Refresh,
} from '@mui/icons-material';
import { INTERVENTION_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import ExportButton from '../../components/ExportButton';
import { useInterventionsList } from './useInterventionsList';

const paginationSx = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 2,
  borderRadius: 1,
} as const;

export default function InterventionsList() {
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
    isHost,
    isManager,
    isAdmin,
    navigate,
    t,
    user,
  } = useInterventionsList();

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

  return (
    <Box>
      <PageHeader
        title={t('interventions.title')}
        subtitle={t('interventions.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ExportButton
              data={filteredInterventions}
              columns={exportColumns}
              fileName="interventions"
            />
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadInterventions}
              disabled={loading}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              {t('common.refresh')}
            </Button>
            {(isManager() || isAdmin()) && (
              <Button
                variant="outlined"
                onClick={() => navigate('/interventions/pending-validation')}
                sx={{ textTransform: 'none' }}
              >
                {t('interventions.pendingValidation.title')}
              </Button>
            )}
            {isHost() && (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate('/interventions/pending-payment')}
                sx={{ textTransform: 'none' }}
              >
                {t('interventions.pendingPayment.title')}
              </Button>
            )}
            {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
            {canCreateInterventions && (isAdmin() || isManager()) && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => navigate('/interventions/new')}
                size="small"
              >
                {t('interventions.create')}
              </Button>
            )}
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* Filtres et recherche */}
      <FilterSearchBar
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
      />

      <Grid container spacing={2}>
        {filteredInterventions.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ textAlign: 'center', py: 2.5, px: 2, ...createSpacing.card() }}>
              <CardContent>
                <Box sx={{ mb: 1.5 }}>
                  <Build sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('interventions.noInterventionFound')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {canCreateInterventions
                    ? t('interventions.noInterventionValidated')
                    : t('interventions.noInterventionAssigned')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                  {t('interventions.interventionsDescription')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', fontSize: '0.7rem', display: 'block', mb: 2 }}
                >
                  {'💡'} {t('interventions.interventionsTip')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          paginatedInterventions
            .map((intervention) => {
              // Vérification stricte de l'intervention avant le rendu
              if (
                !intervention ||
                typeof intervention !== 'object' ||
                !intervention.id ||
                !intervention.title ||
                !intervention.description ||
                !intervention.type ||
                !intervention.status ||
                !intervention.priority
              ) {
                return null;
              }

              return (
                <Grid item xs={12} md={6} lg={4} key={intervention.id}>
                  <InterventionCard
                    intervention={intervention}
                    onMenuOpen={handleMenuOpen}
                    canEdit={canModifyIntervention(intervention)}
                  />
                </Grid>
              );
            })
            .filter(Boolean)
        )}
      </Grid>

      {filteredInterventions.length > ITEMS_PER_PAGE && (
        <TablePagination
          component="div"
          count={filteredInterventions.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={ITEMS_PER_PAGE}
          rowsPerPageOptions={[ITEMS_PER_PAGE]}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          sx={paginationSx}
        />
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleViewDetails} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <VisibilityIcon sx={{ mr: 1, fontSize: 18 }} />
          {t('interventions.viewDetails')}
        </MenuItem>
        {(isManager() || isAdmin()) && selectedIntervention?.status === 'PENDING' && (
          <MenuItem onClick={handleOpenAssignDialog} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <AssignmentIcon sx={{ mr: 1, fontSize: 18, color: 'info.main' }} />
            Assigner
          </MenuItem>
        )}
        {selectedIntervention && canModifyIntervention(selectedIntervention) && (
          <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <EditIcon sx={{ mr: 1, fontSize: 18 }} />
            Modifier
          </MenuItem>
        )}
        {canDeleteInterventions && (
          <MenuItem onClick={handleDelete} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
            {t('interventions.delete')}
          </MenuItem>
        )}
      </Menu>

      {/* Dialog d'assignation rapide */}
      <Dialog
        open={assignDialogOpen}
        onClose={handleCloseAssignDialog}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
          Assigner l'intervention
          {selectedIntervention && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8125rem' }}>
              {selectedIntervention.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Sélecteur type : Équipe / Utilisateur */}
          <ToggleButtonGroup
            value={assignType}
            exclusive
            onChange={(_e, val) => {
              if (val !== null) {
                setAssignType(val);
                setAssignTargetId('');
              }
            }}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
          >
            <ToggleButton value="team" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
              <GroupIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Équipe
            </ToggleButton>
            <ToggleButton value="user" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
              <PersonIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Utilisateur
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Sélecteur cible */}
          <FormControl fullWidth size="small">
            <InputLabel>{assignType === 'team' ? 'Équipe' : 'Utilisateur'}</InputLabel>
            <MuiSelect
              value={assignTargetId}
              onChange={(e) => setAssignTargetId(e.target.value as number)}
              label={assignType === 'team' ? 'Équipe' : 'Utilisateur'}
            >
              {assignType === 'team'
                ? teams.map((team) => (
                    <MenuItem key={team.id} value={team.id} sx={{ fontSize: '0.875rem' }}>
                      {team.name}
                      {team.memberCount !== undefined && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({team.memberCount} membres)
                        </Typography>
                      )}
                    </MenuItem>
                  ))
                : availableUsers.map((u) => (
                    <MenuItem key={u.id} value={u.id} sx={{ fontSize: '0.875rem' }}>
                      {u.firstName} {u.lastName}
                      {u.role && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({u.role})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
            </MuiSelect>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAssignDialog} size="small" sx={{ textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleAssign}
            variant="contained"
            size="small"
            disabled={assignTargetId === '' || assignLoading}
            sx={{ textTransform: 'none' }}
          >
            {assignLoading ? <CircularProgress size={18} /> : 'Assigner'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
