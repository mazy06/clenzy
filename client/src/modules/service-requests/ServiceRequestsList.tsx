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
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  Assignment,
  PriorityHigh,
  Schedule,
  CheckCircle,
  Warning,
  Error,
  Build,
  CleaningServices,
  Plumbing,
  ElectricCar,
  Healing,
  LocationOn,
  Person,
  CalendarToday,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import FilterSearchBar, { FilterOption } from '../../components/FilterSearchBar';

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  propertyName: string;
  propertyAddress: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'cleaning' | 'maintenance' | 'repair' | 'inspection';
  requestedBy: string;
  assignedTo?: string;
  createdAt: string;
  dueDate?: string;
  completedAt?: string;
  estimatedDuration?: number;
  actualDuration?: number;
}

const mockServiceRequests: ServiceRequest[] = [
  {
    id: '1',
    title: 'Nettoyage après départ',
    description: 'Nettoyage complet de l\'appartement après le départ des locataires',
    propertyName: 'Appartement Montmartre',
    propertyAddress: '15 rue de la Paix, Paris',
    status: 'pending',
    priority: 'medium',
    type: 'cleaning',
    requestedBy: 'Marie Dupont',
    createdAt: '2024-01-15T10:00:00Z',
    dueDate: '2024-01-16T14:00:00Z',
    estimatedDuration: 120,
  },
  {
    id: '2',
    title: 'Réparation climatisation',
    description: 'La climatisation ne fonctionne plus dans la chambre principale',
    propertyName: 'Villa Sunshine',
    propertyAddress: '25 Promenade des Anglais, Nice',
    status: 'in_progress',
    priority: 'urgent',
    type: 'repair',
    requestedBy: 'Jean Martin',
    assignedTo: 'Technicien HVAC',
    createdAt: '2024-01-14T08:00:00Z',
    dueDate: '2024-01-15T18:00:00Z',
    estimatedDuration: 180,
    actualDuration: 90,
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
    requestedBy: 'Sophie Bernard',
    assignedTo: 'Inspecteur Sécurité',
    createdAt: '2024-01-10T09:00:00Z',
    completedAt: '2024-01-10T11:00:00Z',
    estimatedDuration: 60,
    actualDuration: 45,
  },
];

const requestTypes = [
  { value: 'all', label: 'Tous les types', icon: <Assignment /> },
  { value: 'cleaning', label: 'Nettoyage', icon: <CleaningServices /> },
  { value: 'maintenance', label: 'Maintenance', icon: <Build /> },
  { value: 'repair', label: 'Réparation', icon: <Build /> },
  { value: 'inspection', label: 'Inspection', icon: <Assignment /> },
];

const statusColors = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
} as const;

const statusLabels = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
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

export default function ServiceRequestsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, request: ServiceRequest) => {
    setAnchorEl(event.currentTarget);
    setSelectedRequest(request);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRequest(null);
  };

  const handleEdit = () => {
    if (selectedRequest) {
      navigate(`/service-requests/${selectedRequest.id}/edit`);
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedRequest) {
      navigate(`/service-requests/${selectedRequest.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    // TODO: Implement delete logic
    console.log('Deleting service request:', selectedRequest?.id);
    setDeleteDialogOpen(false);
  };

  const filteredRequests = mockServiceRequests.filter((request) => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || request.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || request.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || request.priority === selectedPriority;
    
    return matchesSearch && matchesType && matchesStatus && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Schedule />;
      case 'in_progress':
        return <Build />;
      case 'completed':
        return <CheckCircle />;
      case 'cancelled':
        return <Error />;
      default:
        return <Assignment />;
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
            Demandes de service
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez les demandes de service de vos propriétés
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/service-requests/new')}
          sx={{ borderRadius: 2 }}
        >
          Nouvelle demande
        </Button>
      </Box>

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher une demande..."
        filters={{
          type: {
            value: selectedType,
            options: requestTypes,
            onChange: setSelectedType,
            label: "Type"
          },
          status: {
            value: selectedStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              { value: 'pending', label: 'En attente' },
              { value: 'in_progress', label: 'En cours' },
              { value: 'completed', label: 'Terminé' },
              { value: 'cancelled', label: 'Annulé' }
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
          label: "demande",
          count: filteredRequests.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des demandes */}
      <Grid container spacing={3}>
        {filteredRequests.map((request) => (
          <Grid item xs={12} md={6} lg={4} key={request.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {typeIcons[request.type]}
                    <Typography variant="h6" fontWeight={600}>
                      {request.title}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, request)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {request.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {request.propertyName}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Chip
                    label={statusLabels[request.status]}
                    color={statusColors[request.status]}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={priorityLabels[request.priority]}
                    color={priorityColors[request.priority]}
                    size="small"
                    variant="outlined"
                    icon={request.priority === 'urgent' ? <PriorityHigh /> : undefined}
                  />
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Demandé par
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {request.requestedBy}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Créé le
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {formatDate(request.createdAt)}
                    </Typography>
                  </Grid>
                </Grid>

                {request.dueDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Échéance: {formatDate(request.dueDate)}
                    </Typography>
                  </Box>
                )}

                {request.estimatedDuration && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Durée estimée: {getDurationText(request.estimatedDuration)}
                    </Typography>
                  </Box>
                )}

                {request.assignedTo && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Assigné à: {request.assignedTo}
                    </Typography>
                  </Box>
                )}
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/service-requests/${request.id}`)}
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
            Êtes-vous sûr de vouloir supprimer la demande "{selectedRequest?.title}" ? 
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
        onClick={() => navigate('/service-requests/new')}
      >
        <Add />
      </Fab>
    </Box>
  );
}
