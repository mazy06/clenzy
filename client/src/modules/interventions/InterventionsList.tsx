import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Badge,
  Tooltip,
  Fab,
  ListItemIcon,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Build,
  Schedule,
  CheckCircle,
  Warning,
  Error,
  CleaningServices,
  Plumbing,
  ElectricCar,
  Healing,
  LocationOn,
  Person,
  CalendarToday,
  Timer,
  Assignment,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import FilterSearchBar from '../../components/FilterSearchBar';

interface Intervention {
  id: string;
  title: string;
  description: string;
  propertyName: string;
  propertyAddress: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'cleaning' | 'maintenance' | 'repair' | 'inspection';
  assignedTo: string;
  scheduledDate: string;
  estimatedDuration: number;
  actualDuration?: number;
  progress?: number;
  notes?: string;
}

const mockInterventions: Intervention[] = [
  {
    id: '1',
    title: 'Nettoyage complet',
    description: 'Nettoyage complet de l\'appartement après le départ des locataires',
    propertyName: 'Appartement Montmartre',
    propertyAddress: '15 rue de la Paix, Paris',
    status: 'in_progress',
    priority: 'medium',
    type: 'cleaning',
    assignedTo: 'Équipe de nettoyage A',
    scheduledDate: '2024-01-16T14:00:00Z',
    estimatedDuration: 120,
    progress: 65,
  },
  {
    id: '2',
    title: 'Réparation climatisation',
    description: 'Réparation de la climatisation dans la chambre principale',
    propertyName: 'Villa Sunshine',
    propertyAddress: '25 Promenade des Anglais, Nice',
    status: 'scheduled',
    priority: 'urgent',
    type: 'repair',
    assignedTo: 'Technicien HVAC',
    scheduledDate: '2024-01-17T09:00:00Z',
    estimatedDuration: 180,
  },
  {
    id: '3',
    title: 'Inspection de sécurité',
    description: 'Vérification des détecteurs de fumée et extincteurs',
    propertyName: 'Studio Le Marais',
    propertyAddress: '8 rue des Rosiers, Paris',
    status: 'completed',
    priority: 'low',
    type: 'inspection',
    assignedTo: 'Inspecteur Sécurité',
    scheduledDate: '2024-01-10T09:00:00Z',
    estimatedDuration: 60,
    actualDuration: 45,
    progress: 100,
  },
];

const interventionTypes = [
  { value: 'all', label: 'Tous les types', icon: <Build /> },
  { value: 'cleaning', label: 'Nettoyage', icon: <CleaningServices /> },
  { value: 'maintenance', label: 'Maintenance', icon: <Build /> },
  { value: 'repair', label: 'Réparation', icon: <Build /> },
  { value: 'inspection', label: 'Inspection', icon: <Assignment /> },
];

const statusColors = {
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'error',
} as const;

const statusLabels = {
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const priorityColors = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
} as const;

const priorityLabels = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Élevée',
  urgent: 'Urgente',
};

const typeIcons = {
  cleaning: <CleaningServices />,
  maintenance: <Build />,
  repair: <Build />,
  inspection: <Assignment />,
};

export default function InterventionsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => {
    setAnchorEl(event.currentTarget);
    setSelectedIntervention(intervention);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedIntervention(null);
  };

  const handleEdit = () => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}/edit`);
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedIntervention) {
      navigate(`/interventions/${selectedIntervention.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    // TODO: Implement delete logic
    console.log('Deleting intervention:', selectedIntervention?.id);
    setDeleteDialogOpen(false);
  };

  const filteredInterventions = mockInterventions.filter((intervention) => {
    const matchesSearch = intervention.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intervention.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intervention.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || intervention.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || intervention.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || intervention.priority === selectedPriority;
    
    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Schedule />;
      case 'in_progress':
        return <Build />;
      case 'completed':
        return <CheckCircle />;
      case 'cancelled':
        return <Error />;
      default:
        return <Build />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDurationText = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins : ''}`;
    }
    return `${mins}min`;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Interventions
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez les interventions sur vos propriétés
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/interventions/new')}
          sx={{ borderRadius: 2 }}
        >
          Nouvelle intervention
        </Button>
      </Box>

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher une intervention..."
        filters={{
          type: {
            value: selectedType,
            options: interventionTypes,
            onChange: setSelectedType,
            label: "Type"
          },
          status: {
            value: selectedStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              { value: 'scheduled', label: 'Planifiée' },
              { value: 'in_progress', label: 'En cours' },
              { value: 'completed', label: 'Terminée' },
              { value: 'cancelled', label: 'Annulée' }
            ],
            onChange: setSelectedStatus,
            label: "Statut"
          },
          priority: {
            value: selectedPriority,
            options: [
              { value: 'all', label: 'Toutes priorités' },
              { value: 'low', label: 'Faible' },
              { value: 'medium', label: 'Moyenne' },
              { value: 'high', label: 'Élevée' },
              { value: 'urgent', label: 'Urgente' }
            ],
            onChange: setSelectedPriority,
            label: "Priorité"
          }
        }}
        counter={{
          label: "intervention",
          count: filteredInterventions.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des interventions */}
      <Grid container spacing={3}>
        {filteredInterventions.map((intervention) => (
          <Grid item xs={12} md={6} lg={4} key={intervention.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {typeIcons[intervention.type]}
                    <Typography variant="h6" fontWeight={600}>
                      {intervention.title}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, intervention)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {intervention.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {intervention.propertyName}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Chip
                    label={statusLabels[intervention.status]}
                    color={statusColors[intervention.status]}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={priorityLabels[intervention.priority]}
                    color={priorityColors[intervention.priority]}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                {intervention.progress !== undefined && (
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Progression
                      </Typography>
                      <Typography variant="caption" fontWeight={500}>
                        {intervention.progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={intervention.progress}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                )}

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Assigné à
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {intervention.assignedTo}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Planifiée le
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Timer sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Durée estimée: {getDurationText(intervention.estimatedDuration)}
                  </Typography>
                </Box>

                {intervention.actualDuration && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Timer sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="body2" color="success.main" fontWeight={500}>
                      Durée réelle: {getDurationText(intervention.actualDuration)}
                    </Typography>
                  </Box>
                )}
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/interventions/${intervention.id}`)}
                  sx={{ flexGrow: 1 }}
                >
                  Voir détails
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          Voir détails
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'intervention "{selectedIntervention?.title}" ? 
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB pour ajouter rapidement */}
      <Fab
                        color="secondary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16, display: { md: 'none' } }}
        onClick={() => navigate('/interventions/new')}
      >
        <Add />
      </Fab>
    </Box>
  );
}
