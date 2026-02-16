import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Fab,
  Alert,
  CircularProgress,
  Badge,
  Tooltip,
  Divider,
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
} from '@mui/material';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import InterventionCard from './InterventionCard';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Build,
  Refresh
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, teamsApi, usersApi } from '../../services/api';
import type { Team } from '../../services/api';
import type { User } from '../../services/api/usersApi';
import { InterventionStatus, INTERVENTION_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  requestorName: string;
  assignedToName: string;
  assignedToType: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  progressPercentage: number;
  createdAt: string;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

// Les interventions sont maintenant chargées depuis la base de données
// et représentent les service requests validés par les managers/admins

// Options de filtres
const interventionTypes = [
  { value: 'all', label: 'Tous les types' },
  { value: 'CLEANING', label: 'Nettoyage' },
  { value: 'EXPRESS_CLEANING', label: 'Nettoyage Express' },
  { value: 'DEEP_CLEANING', label: 'Nettoyage en Profondeur' },
  { value: 'WINDOW_CLEANING', label: 'Nettoyage des Vitres' },
  { value: 'FLOOR_CLEANING', label: 'Nettoyage des Sols' },
  { value: 'KITCHEN_CLEANING', label: 'Nettoyage de la Cuisine' },
  { value: 'BATHROOM_CLEANING', label: 'Nettoyage des Sanitaires' },
  { value: 'PREVENTIVE_MAINTENANCE', label: 'Maintenance Préventive' },
  { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence' },
  { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique' },
  { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie' },
  { value: 'HVAC_REPAIR', label: 'Réparation Climatisation' },
  { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager' },
  { value: 'GARDENING', label: 'Jardinage' },
  { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur' },
  { value: 'PEST_CONTROL', label: 'Désinsectisation' },
  { value: 'DISINFECTION', label: 'Désinfection' },
  { value: 'RESTORATION', label: 'Remise en État' },
  { value: 'OTHER', label: 'Autre' }
];

// statuses et priorities seront générés dynamiquement avec les traductions

const getStatusColor = (status: string): ChipColor => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'AWAITING_VALIDATION': return 'warning';
    case 'AWAITING_PAYMENT': return 'warning';
    case 'SCHEDULED': return 'info';
    case 'IN_PROGRESS': return 'primary';
    case 'ON_HOLD': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'default';
  }
};

const getStatusLabel = (status: string, t: (key: string) => string) => {
  switch (status) {
    case 'PENDING': return t('interventions.statuses.PENDING');
    case 'AWAITING_VALIDATION': return t('interventions.statuses.AWAITING_VALIDATION');
    case 'AWAITING_PAYMENT': return t('interventions.statuses.AWAITING_PAYMENT');
    case 'IN_PROGRESS': return t('interventions.statuses.IN_PROGRESS');
    case 'COMPLETED': return t('interventions.statuses.COMPLETED');
    case 'CANCELLED': return t('interventions.statuses.CANCELLED');
    default: return status;
  }
};

const getPriorityColor = (priority: string): ChipColor => {
  switch (priority) {
    case 'LOW': return 'success';
    case 'NORMAL': return 'info';
    case 'HIGH': return 'warning';
    case 'URGENT': return 'error';
    default: return 'default';
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'LOW': return 'Basse';
    case 'NORMAL': return 'Normale';
    case 'HIGH': return 'Haute';
    case 'URGENT': return 'Urgente';
    default: return priority;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'CLEANING': return 'Nettoyage';
    case 'EXPRESS_CLEANING': return 'Nettoyage Express';
    case 'DEEP_CLEANING': return 'Nettoyage en Profondeur';
    case 'WINDOW_CLEANING': return 'Nettoyage des Vitres';
    case 'FLOOR_CLEANING': return 'Nettoyage des Sols';
    case 'KITCHEN_CLEANING': return 'Nettoyage de la Cuisine';
    case 'BATHROOM_CLEANING': return 'Nettoyage des Sanitaires';
    case 'PREVENTIVE_MAINTENANCE': return 'Maintenance Préventive';
    case 'EMERGENCY_REPAIR': return 'Réparation d\'Urgence';
    case 'ELECTRICAL_REPAIR': return 'Réparation Électrique';
    case 'PLUMBING_REPAIR': return 'Réparation Plomberie';
    case 'HVAC_REPAIR': return 'Réparation Climatisation';
    case 'APPLIANCE_REPAIR': return 'Réparation Électroménager';
    case 'GARDENING': return 'Jardinage';
    case 'EXTERIOR_CLEANING': return 'Nettoyage Extérieur';
    case 'PEST_CONTROL': return 'Désinsectisation';
    case 'DISINFECTION': return 'Désinfection';
    case 'RESTORATION': return 'Remise en État';
    case 'OTHER': return 'Autre';
    default: return type;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function InterventionsList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermissionAsync, isHost, isManager, isAdmin } = useAuth();
  const { t } = useTranslation();
  
  // TOUS les useState DOIVENT être déclarés AVANT les vérifications conditionnelles
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  // États pour le dialog d'assignation rapide
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignType, setAssignType] = useState<'user' | 'team'>('team');
  const [assignTargetId, setAssignTargetId] = useState<number | ''>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Vérifier les permissions pour les interventions - TOUS les useState AVANT les useEffect
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canCreateInterventions, setCanCreateInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);
  const [canDeleteInterventions, setCanDeleteInterventions] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // Vérifier toutes les permissions en une seule fois
  useEffect(() => {
    const checkAllPermissions = async () => {
      const [
        canView,
        canCreate,
        canEdit,
        canDelete
      ] = await Promise.all([
        hasPermissionAsync('interventions:view'),
        hasPermissionAsync('interventions:create'),
        hasPermissionAsync('interventions:edit'),
        hasPermissionAsync('interventions:delete')
      ]);

      setCanViewInterventions(canView);
      setCanCreateInterventions(canCreate);
      setCanEditInterventions(canEdit);
      setCanDeleteInterventions(canDelete);
      setPermissionsLoading(false);
    };

    checkAllPermissions();
  }, [hasPermissionAsync]);

  // Chargement automatique des interventions avec useEffect
  React.useEffect(() => {
    // Ne pas recharger si on a déjà une erreur 403 ou si pas de permission
    if (canViewInterventions && location.pathname === '/interventions') {
      loadInterventions();
    }
  }, [canViewInterventions, location.pathname]); // Recharger quand les permissions changent ou quand on navigue vers cette page

  // Fonction de chargement des interventions
  const loadInterventions = async () => {
    // Vérifier les permissions avant de faire l'appel API
    if (!canViewInterventions) {
      setInterventions([]);
      setError('Vous n\'avez pas les permissions nécessaires pour voir les interventions.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await interventionsApi.getAll();

      // Si c'est une page Spring Data, extraire le contenu
      if ((data as any).content && Array.isArray((data as any).content)) {
        setInterventions((data as any).content);
      } else if (Array.isArray(data)) {
        setInterventions(data);
      } else {
        setInterventions([]);
      }
    } catch (err: any) {
      setInterventions([]);
      if (err.status === 401) {
        setError('Erreur d\'authentification. Veuillez vous reconnecter.');
      } else if (err.status === 403) {
        setError('Accès interdit. Vous n\'avez pas les permissions nécessaires pour voir les interventions.');
      } else if (err.status !== 404) {
        setError(err.message || 'Erreur lors du chargement des interventions');
      }
    } finally {
      setLoading(false);
    }
  };

  // useEffect COMMENTÉ - cause l'erreur React #310
  // useEffect(() => {
  //   loadInterventions();
  // }, []);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => {
    setAnchorEl(event.currentTarget);
    setSelectedIntervention(intervention);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIntervention(null);
  };

  const handleViewDetails = () => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}`);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}/edit`);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedIntervention) return;

    try {
      await interventionsApi.delete(selectedIntervention.id);
      loadInterventions();
    } catch (err) {
    }

    handleMenuClose();
  };

  // ─── Assignation rapide ────────────────────────────────────────────
  const handleOpenAssignDialog = async () => {
    setAssignDialogOpen(true);
    setAssignType('team');
    setAssignTargetId('');
    // On ne ferme PAS le menu contextuel ici, on garde selectedIntervention
    setAnchorEl(null);

    // Charger équipes et utilisateurs en parallèle
    try {
      const [fetchedTeams, fetchedUsers] = await Promise.all([
        teamsApi.getAll(),
        usersApi.getAll(),
      ]);
      setTeams(Array.isArray(fetchedTeams) ? fetchedTeams : []);
      setAvailableUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
    } catch {
      setTeams([]);
      setAvailableUsers([]);
    }
  };

  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setSelectedIntervention(null);
  };

  const handleAssign = async () => {
    if (!selectedIntervention || assignTargetId === '') return;

    setAssignLoading(true);
    try {
      if (assignType === 'team') {
        await interventionsApi.assign(selectedIntervention.id, undefined, assignTargetId as number);
      } else {
        await interventionsApi.assign(selectedIntervention.id, assignTargetId as number, undefined);
      }
      setAssignDialogOpen(false);
      setSelectedIntervention(null);
      loadInterventions();
    } catch (err) {
      // Silently fail — l'erreur apparaîtra via la notification API
    } finally {
      setAssignLoading(false);
    }
  };

  const canModifyIntervention = (intervention: Intervention): boolean => {
    if (canEditInterventions) return true;
    
    // Vérifier que l'intervention et assignedToType existent
    if (!intervention || !intervention.assignedToType) {
      return false;
    }
    
    // Les équipes peuvent modifier les interventions assignées
    if (intervention.assignedToType === 'team') {
      // La vérification d'appartenance à l'équipe est gérée côté serveur
      return true;
    }
    
    // Les utilisateurs peuvent modifier les interventions assignées
    if (intervention.assignedToType === 'user') {
      // La vérification d'assignation utilisateur est gérée côté serveur
      return true;
    }
    
    return false;
  };

  const getFilteredInterventions = () => {
    // Vérifier que interventions est un tableau valide
    if (!Array.isArray(interventions) || interventions.length === 0) {
      return [];
    }
    
    const filtered = interventions.filter((intervention) => {
      // Vérifier que l'intervention n'est pas null et a les propriétés requises
      if (!intervention || typeof intervention !== 'object') {
        return false;
      }
      
      // Vérification plus stricte des propriétés requises
      if (!intervention.id || !intervention.title || !intervention.description || 
          !intervention.type || !intervention.status || !intervention.priority) {
        return false;
      }
      
      // Filtres basés sur le rôle de l'utilisateur
      let roleFilter = true;
      if (canEditInterventions) {
        roleFilter = true; // Voir toutes les interventions
      } else if (user?.roles?.includes('HOST')) {
        // Le filtrage par propriétés du HOST est effectué côté serveur via l'endpoint API
        roleFilter = true;
      } else {
        // Autres utilisateurs: voir seulement les interventions assignées
        // Vérifier que assignedToType existe avant de l'utiliser
        if (intervention.assignedToType) {
          roleFilter = intervention.assignedToType === 'user' || intervention.assignedToType === 'team';
        } else {
          roleFilter = false; // Si pas d'assignation, ne pas afficher
        }
      }
      
      if (!roleFilter) return false;
      
      // Filtre par recherche
      if (searchTerm && !intervention.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !intervention.description.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Filtre par type
      if (selectedType !== 'all' && intervention.type !== selectedType) {
        return false;
      }
      
      // Filtre par statut
      if (selectedStatus !== 'all' && intervention.status !== selectedStatus) {
        return false;
      }
      
      // Filtre par priorité
      if (selectedPriority !== 'all' && intervention.priority !== selectedPriority) {
        return false;
      }
      
      return true;
    });
    
    return filtered;
  };

  const filteredInterventions = getFilteredInterventions();

  const exportColumns: ExportColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'Titre' },
    { key: 'type', label: 'Type', formatter: (v: string) => getTypeLabel(v) },
    { key: 'status', label: 'Statut', formatter: (v: string) => getStatusLabel(v, t) },
    { key: 'priority', label: 'Priorité', formatter: (v: string) => getPriorityLabel(v) },
    { key: 'propertyName', label: 'Propriété' },
    { key: 'assignedToName', label: 'Assigné à' },
    { key: 'scheduledDate', label: 'Date planifiée', formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
    { key: 'estimatedDurationHours', label: 'Durée estimée (h)' },
    { key: 'progressPercentage', label: 'Progression (%)' },
  ];

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

  // Permissions en cours de chargement → spinner
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

  // Fonction pour formater la durée
  const formatDuration = (hours: number) => {
    if (hours === 1) return `1 ${t('interventions.hour')}`;
    return `${hours} ${t('interventions.hours')}`;
  };

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
    { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'Urgence' },
    { value: 'ELECTRICAL_REPAIR', label: 'Réparation Électrique' },
    { value: 'PLUMBING_REPAIR', label: 'Réparation Plomberie' },
    { value: 'HVAC_REPAIR', label: 'Réparation Climatisation' },
    { value: 'APPLIANCE_REPAIR', label: 'Réparation Électroménager' },
    { value: 'GARDENING', label: 'Jardinage' },
    { value: 'EXTERIOR_CLEANING', label: 'Nettoyage Extérieur' },
    { value: 'PEST_CONTROL', label: 'Désinsectisation' },
    { value: 'DISINFECTION', label: 'Désinfection' },
    { value: 'RESTORATION', label: 'Remise en État' },
    { value: 'OTHER', label: 'Autre' }
  ];

  // Générer les statuts avec traductions
  const statuses = [
    { value: 'all', label: t('interventions.allStatuses') },
    ...INTERVENTION_STATUS_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
  ];

  // Générer les priorités avec traductions
  const priorities = [
    { value: 'all', label: t('interventions.allPriorities') },
    ...PRIORITY_OPTIONS.map(option => ({
      value: option.value,
      label: option.label
    }))
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
            label: t('interventions.fields.priority')
          }
        }}
        counter={{
          label: t('interventions.intervention'),
          count: filteredInterventions.length,
          singular: "",
          plural: "s"
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
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.7rem', display: 'block', mb: 2 }}>
                  💡 {t('interventions.interventionsTip')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredInterventions.map((intervention) => {
            // Vérification stricte de l'intervention avant le rendu
            if (!intervention || typeof intervention !== 'object' || !intervention.id ||
                !intervention.title || !intervention.description || !intervention.type ||
                !intervention.status || !intervention.priority) {
              return null;
            }

            return (
              <Grid item xs={12} md={6} lg={4} key={intervention.id}>
                <InterventionCard
                  intervention={intervention}
                  onMenuOpen={handleMenuOpen}
                  canEdit={canModifyIntervention(intervention)}
                  t={t}
                />
              </Grid>
            );
          }).filter(Boolean)
        )}
      </Grid>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
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
        {canModifyIntervention(selectedIntervention!) && (
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

      {/* ─── Dialog d'assignation rapide ─── */}
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
