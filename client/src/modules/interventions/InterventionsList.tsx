import React, { useState } from 'react';
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
  Tab,
  Tabs,
  TextField,
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
  MoreVert,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { extractApiList } from '../../types';
import { INTERVENTION_STATUS_OPTIONS, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import ExportButton from '../../components/ExportButton';
import { useInterventionsList, interventionsKeys } from './useInterventionsList';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusColor,
  getInterventionStatusLabel,
  getInterventionPriorityColor,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';

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

const TAB_SX = {
  minHeight: 36,
  textTransform: 'none',
  fontSize: '0.84rem',
  fontWeight: 600,
  py: 0.75,
  px: 2,
} as const;

const TABS_CONTAINER_SX = {
  minHeight: 36,
  mb: 1.5,
  '& .MuiTabs-indicator': {
    height: 2.5,
    borderRadius: 1,
  },
} as const;

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [listRowsPerPage, setListRowsPerPage] = useState(LIST_DEFAULT_ROWS);
  const [listPage, setListPage] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  const queryClient = useQueryClient();

  // ─── Pending validation query ───────────────────────────────────────────────
  const pendingQuery = useQuery({
    queryKey: interventionsKeys.pendingValidation(),
    queryFn: async () => {
      const data = await interventionsApi.getAll({ status: 'AWAITING_VALIDATION' });
      return extractApiList<Intervention>(data);
    },
    enabled: activeTab === 1 && (isManager() || isAdmin()),
    staleTime: 30_000,
  });

  const pendingInterventions = pendingQuery.data ?? [];
  const pendingLoading = pendingQuery.isLoading;

  // ─── Pending validation pagination ──────────────────────────────────────────
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingRowsPerPage, setPendingRowsPerPage] = useState(LIST_DEFAULT_ROWS);
  const paginatedPending = pendingInterventions.slice(
    pendingPage * pendingRowsPerPage,
    (pendingPage + 1) * pendingRowsPerPage
  );

  // ─── Validation dialog state ────────────────────────────────────────────────
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationTarget, setValidationTarget] = useState<Intervention | null>(null);
  const [estimatedCost, setEstimatedCost] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateMutation = useMutation({
    mutationFn: ({ interventionId, cost }: { interventionId: number; cost: number }) =>
      apiClient.post(`/interventions/${interventionId}/validate`, { estimatedCost: cost }),
    onSuccess: () => {
      handleCloseValidationDialog();
      queryClient.invalidateQueries({ queryKey: interventionsKeys.all });
    },
    onError: (err: Error) => {
      setValidationError(err.message || 'Erreur de connexion');
    },
  });

  const handleOpenValidationDialog = (intervention: Intervention) => {
    setValidationTarget(intervention);
    setEstimatedCost('');
    setValidationError(null);
    setValidationDialogOpen(true);
  };

  const handleCloseValidationDialog = () => {
    setValidationDialogOpen(false);
    setValidationTarget(null);
    setEstimatedCost('');
    setValidationError(null);
  };

  const handleValidate = () => {
    if (!validationTarget) return;
    const cost = parseFloat(estimatedCost);
    if (isNaN(cost) || cost <= 0) {
      setValidationError('Veuillez entrer un montant valide');
      return;
    }
    setValidationError(null);
    validateMutation.mutate({ interventionId: validationTarget.id, cost });
  };

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
              title={t('common.refresh')}
            >
              {t('common.refresh')}
            </Button>
            {isHost() && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/interventions/pending-payment')}
                title={t('interventions.pendingPayment.title')}
              >
                {t('interventions.pendingPayment.title')}
              </Button>
            )}
            {/* Seuls les ADMIN et MANAGER peuvent créer des interventions manuellement */}
            {canCreateInterventions && (isAdmin() || isManager()) && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigate('/interventions/new')}
                title={t('interventions.create')}
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

      {/* ─── Onglets Validées / En attente ─────────────────────────────────── */}
      {(isManager() || isAdmin()) ? (
        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v); setPendingPage(0); setListPage(0); }}
          sx={TABS_CONTAINER_SX}
        >
          <Tab label={`Validées (${filteredInterventions.length})`} sx={TAB_SX} />
          <Tab label={`En attente (${pendingInterventions.length})`} sx={TAB_SX} />
        </Tabs>
      ) : null}

      {/* ─── Tab 0 : Interventions validées ─────────────────────────────────── */}
      {activeTab === 0 && (
        <>
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
            viewToggle={{
              mode: viewMode,
              onChange: (mode) => { setViewMode(mode); setListPage(0); },
            }}
          />

          {filteredInterventions.length === 0 ? (
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
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <>
              <Grid container spacing={2}>
                {paginatedInterventions
                  .map((intervention) => {
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
                  .filter(Boolean)}
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
            </>
          ) : (
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
                      <TableCell>Type</TableCell>
                      <TableCell>Propriété</TableCell>
                      <TableCell>Assigné à</TableCell>
                      <TableCell align="center">Statut</TableCell>
                      <TableCell align="center">Priorité</TableCell>
                      <TableCell align="center">Progression</TableCell>
                      <TableCell>Planifié le</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listPaginatedInterventions.map((intervention) => {
                      if (!intervention?.id) return null;
                      return (
                        <TableRow
                          key={intervention.id}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:last-child td': { borderBottom: 0 },
                          }}
                          onClick={() => navigate(`/interventions/${intervention.id}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                              {intervention.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {intervention.requestorName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getInterventionTypeLabel(intervention.type, t)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {intervention.propertyName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {intervention.propertyAddress}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {intervention.assignedToName || '—'}
                            </Typography>
                            {intervention.assignedToType && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                {intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getInterventionStatusLabel(intervention.status, t)}
                              color={getInterventionStatusColor(intervention.status)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getInterventionPriorityLabel(intervention.priority, t)}
                              color={getInterventionPriorityColor(intervention.priority)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 80 }}>
                              <LinearProgress
                                variant="determinate"
                                value={intervention.progressPercentage}
                                sx={{
                                  flex: 1,
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    borderRadius: 3,
                                    bgcolor: intervention.progressPercentage === 100 ? 'success.main'
                                      : intervention.progressPercentage >= 50 ? 'info.main' : 'warning.main',
                                  },
                                }}
                              />
                              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.68rem', minWidth: 28 }}>
                                {intervention.progressPercentage}%
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {formatDateShort(intervention.scheduledDate)}
                            </Typography>
                            {intervention.estimatedDurationHours > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                ~{intervention.estimatedDurationHours}h
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="Détails">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                              >
                                <VisibilityIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Actions">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, intervention); }}
                              >
                                <MoreVert sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={filteredInterventions.length}
                page={listPage}
                onPageChange={(_, p) => setListPage(p)}
                rowsPerPage={listRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setListRowsPerPage(parseInt(e.target.value, 10));
                  setListPage(0);
                }}
                rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
                labelRowsPerPage="Lignes par page"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                sx={paginationSx}
              />
            </Paper>
          )}
        </>
      )}

      {/* ─── Tab 1 : Interventions en attente de validation ─────────────────── */}
      {activeTab === 1 && (
        <>
          {pendingLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress size={32} />
            </Box>
          ) : pendingInterventions.length === 0 ? (
            <Card sx={{ textAlign: 'center', py: 2.5, px: 2, ...createSpacing.card() }}>
              <CardContent>
                <Box sx={{ mb: 1.5 }}>
                  <Build sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Aucune intervention en attente
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Toutes les interventions ont été validées.
                </Typography>
              </CardContent>
            </Card>
          ) : (
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
                      <TableCell>Type</TableCell>
                      <TableCell>Propriété</TableCell>
                      <TableCell>Demandeur</TableCell>
                      <TableCell>Date prévue</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedPending.map((intervention) => {
                      if (!intervention?.id) return null;
                      return (
                        <TableRow
                          key={intervention.id}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:last-child td': { borderBottom: 0 },
                          }}
                          onClick={() => navigate(`/interventions/${intervention.id}`)}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                              {intervention.title}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getInterventionTypeLabel(intervention.type, t)}
                              size="small"
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {intervention.propertyName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                              {intervention.propertyAddress}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {intervention.requestorName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                              {formatDateShort(intervention.scheduledDate)}
                            </Typography>
                            {intervention.estimatedDurationHours > 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                ~{intervention.estimatedDurationHours}h
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="Détails">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}`); }}
                              >
                                <VisibilityIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Valider">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => { e.stopPropagation(); handleOpenValidationDialog(intervention); }}
                              >
                                <CheckCircleIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {pendingInterventions.length > LIST_DEFAULT_ROWS && (
                <TablePagination
                  component="div"
                  count={pendingInterventions.length}
                  page={pendingPage}
                  onPageChange={(_, p) => setPendingPage(p)}
                  rowsPerPage={pendingRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setPendingRowsPerPage(parseInt(e.target.value, 10));
                    setPendingPage(0);
                  }}
                  rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
                  labelRowsPerPage="Lignes par page"
                  labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                  sx={paginationSx}
                />
              )}
            </Paper>
          )}
        </>
      )}

      {/* ─── Menus et dialogs partagés ─────────────────────────────────────── */}
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

      {/* Dialog de validation */}
      <Dialog open={validationDialogOpen} onClose={handleCloseValidationDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1, fontSize: '1rem', fontWeight: 600 }}>
          Valider l'intervention
        </DialogTitle>
        <DialogContent>
          {validationTarget && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Intervention : {validationTarget.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Propriété : {validationTarget.propertyName}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            label="Coût estimé (€)"
            type="number"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            error={!!validationError}
            helperText={validationError}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseValidationDialog} disabled={validateMutation.isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleValidate}
            variant="contained"
            disabled={validateMutation.isPending || !estimatedCost}
            startIcon={validateMutation.isPending ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {validateMutation.isPending ? 'Validation...' : 'Valider'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
