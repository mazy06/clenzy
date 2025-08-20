import React, { useState, useEffect, useCallback } from 'react';
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
  Button
} from '@mui/material';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
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
  Build
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
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

// Les interventions sont maintenant chargées depuis la base de données
// et représentent les service requests validés par les managers/admins

// Options de filtres
const interventionTypes = [
  { value: 'all', label: 'Tous les types' },
  { value: 'CLEANING', label: 'Nettoyage' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'REPAIR', label: 'Réparation' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'EMERGENCY_REPAIR', label: 'Réparation d\'urgence' }
];

const statuses = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'SCHEDULED', label: 'Planifié' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'ON_HOLD', label: 'En attente' },
  { value: 'COMPLETED', label: 'Terminé' },
  { value: 'CANCELLED', label: 'Annulé' }
];

const priorities = [
  { value: 'all', label: 'Toutes priorités' },
  { value: 'LOW', label: 'Basse' },
  { value: 'NORMAL', label: 'Normale' },
  { value: 'HIGH', label: 'Haute' },
  { value: 'URGENT', label: 'Urgente' }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'SCHEDULED': return 'info';
    case 'IN_PROGRESS': return 'primary';
    case 'ON_HOLD': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'default';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return 'En attente';
    case 'IN_PROGRESS': return 'En cours';
    case 'COMPLETED': return 'Terminé';
    case 'CANCELLED': return 'Annulé';
    default: return status;
  }
};

const getPriorityColor = (priority: string) => {
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
    case 'INSPECTION': return 'Inspection';
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

const formatDuration = (hours: number) => {
  if (hours === 1) return '1 heure';
  return `${hours} heures`;
};

export default function InterventionsList() {
  const navigate = useNavigate();
  const { user, isAdmin, isManager } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

  const loadInterventions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 InterventionsList - Interventions chargées:', data);
        
        // Si c'est une page Spring Data, extraire le contenu
        if (data.content && Array.isArray(data.content)) {
          setInterventions(data.content);
        } else if (Array.isArray(data)) {
          setInterventions(data);
        } else {
          console.warn('🔍 InterventionsList - Format de données inattendu, tableau vide');
          setInterventions([]);
        }
      } else if (response.status === 401) {
        console.error('🔍 InterventionsList - Erreur d\'authentification (401)');
        setError('Erreur d\'authentification. Veuillez vous reconnecter.');
        // En cas d'erreur 401, tableau vide
        setInterventions([]);
      } else if (response.status === 404) {
        console.log('🔍 InterventionsList - Endpoint non trouvé, tableau vide');
        setInterventions([]);
      } else {
        console.error('🔍 InterventionsList - Erreur API:', response.status);
        setError(`Erreur ${response.status}: ${response.statusText}`);
        setInterventions([]);
      }
    } catch (err) {
      console.error('🔍 InterventionsList - Erreur chargement:', err);
      setInterventions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInterventions();
  }, []); // Dépendance vide pour éviter les re-rendus infinis

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
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${selectedIntervention.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadInterventions();
      } else {
        console.error('🔍 InterventionsList - Erreur suppression:', response.status);
      }
    } catch (err) {
      console.error('🔍 InterventionsList - Erreur suppression:', err);
    }

    handleMenuClose();
  };

  const canModifyIntervention = (intervention: Intervention): boolean => {
    if (isAdmin()) return true;
    if (isManager()) return true;
    
    // Les équipes peuvent modifier les interventions assignées
    if (intervention.assignedToType === 'team') {
      // TODO: Vérifier si l'utilisateur fait partie de l'équipe
      return true;
    }
    
    // Les utilisateurs peuvent modifier les interventions assignées
    if (intervention.assignedToType === 'user') {
      // TODO: Vérifier si l'utilisateur est assigné
      return true;
    }
    
    return false;
  };

  const getFilteredInterventions = () => {
    // Vérifier que interventions est un tableau valide
    if (!Array.isArray(interventions) || interventions.length === 0) {
      console.log('🔍 InterventionsList - Aucune intervention disponible');
      return [];
    }
    
    console.log('🔍 InterventionsList - Vérification de', interventions.length, 'interventions');
    
    const filtered = interventions.filter((intervention) => {
      // Vérifier que l'intervention n'est pas null et a les propriétés requises
      if (!intervention || typeof intervention !== 'object') {
        console.warn('🔍 InterventionsList - Intervention null ou non-objet:', intervention);
        return false;
      }
      
      // Vérification plus stricte des propriétés requises
      if (!intervention.id || !intervention.title || !intervention.description || 
          !intervention.type || !intervention.status || !intervention.priority) {
        console.warn('🔍 InterventionsList - Intervention manque des propriétés requises:', intervention);
        return false;
      }
      
      // Filtres basés sur le rôle de l'utilisateur
      let roleFilter = true;
      if (isAdmin() || isManager()) {
        roleFilter = true; // Voir toutes les interventions
      } else if (user?.roles?.includes('HOST')) {
        // TODO: Filtrer par propriétés du host
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
    
    console.log('🔍 InterventionsList - Interventions filtrées:', filtered.length);
    return filtered;
  };

  const filteredInterventions = getFilteredInterventions();

  // Protection contre les données invalides
  if (!Array.isArray(interventions)) {
    console.error('🔍 InterventionsList - Interventions n\'est pas un tableau:', interventions);
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Erreur de chargement des données. Veuillez rafraîchir la page.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Interventions"
        description="Interventions créées à partir des demandes de service validées"
        buttonText="Nouvelle intervention"
        buttonIcon={<AddIcon />}
        onButtonClick={() => navigate('/interventions/new')}
        showButton={isAdmin() || isManager()}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
            options: statuses,
            onChange: setSelectedStatus,
            label: "Statut"
          },
          priority: {
            value: selectedPriority,
            options: priorities,
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

      <Grid container spacing={3}>
        {filteredInterventions.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ textAlign: 'center', py: 4, px: 3 }}>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Build sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h5" color="text.secondary" gutterBottom>
                  Aucune intervention
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {isAdmin() || isManager() 
                    ? "Aucune demande de service n'a encore été validée pour créer des interventions."
                    : "Aucune intervention ne vous est actuellement assignée."}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Les interventions sont créées automatiquement à partir des demandes de service validées par les managers et administrateurs.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  💡 Pour créer une intervention, validez d'abord une demande de service depuis le menu "Demandes de service".
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          Array.isArray(filteredInterventions) && filteredInterventions.length > 0 ? (
            filteredInterventions.map((intervention) => {
              // Vérification stricte de l'intervention avant le rendu
              if (!intervention || typeof intervention !== 'object' || !intervention.id || 
                  !intervention.title || !intervention.description || !intervention.type || 
                  !intervention.status || !intervention.priority) {
                console.warn('🔍 InterventionsList - Intervention invalide dans le rendu:', intervention);
                return null;
              }
            
            return (
              <Grid item xs={12} md={6} lg={4} key={intervention.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" component="h2" sx={{ flex: 1, mr: 1 }}>
                      {intervention.title}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, intervention)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {intervention.description}
                  </Typography>

                  <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                    <Chip
                      label={getTypeLabel(intervention.type)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={getStatusLabel(intervention.status)}
                      size="small"
                      color={getStatusColor(intervention.status) as any}
                    />
                    <Chip
                      label={getPriorityLabel(intervention.priority)}
                      size="small"
                      color={getPriorityColor(intervention.priority) as any}
                    />
                  </Box>

                  <Box mb={2}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <LocationIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {intervention.propertyName}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ ml: 3 }}>
                      {intervention.propertyAddress}
                    </Typography>
                  </Box>

                  <Box mb={2}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        Demandeur: {intervention.requestorName}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center">
                      {intervention.assignedToType === 'team' ? (
                        <GroupIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      ) : (
                        <PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                      )}
                      <Typography variant="body2">
                        Assigné à: {intervention.assignedToName || 'Non assigné'}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        Planifié: {formatDate(intervention.scheduledDate)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Durée estimée: {formatDuration(intervention.estimatedDurationHours)}
                      </Typography>
                    </Box>
                    <Box textAlign="right">
                      <Typography variant="h6" color="primary">
                        {intervention.progressPercentage}%
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Progression
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Bouton Voir détail */}
                  <Box sx={{ mt: 'auto', pt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      onClick={() => navigate(`/interventions/${intervention.id}`)}
                      startIcon={<VisibilityIcon />}
                    >
                      Voir détail
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            );
          }).filter(Boolean)
          ) : (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  Aucune intervention trouvée
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {error || 'Aucune intervention ne correspond aux critères de recherche.'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Les interventions sont créées automatiquement à partir des demandes de service validées.
                </Typography>
              </Box>
            </Grid>
          )
        )}
      </Grid>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewDetails}>
          <VisibilityIcon sx={{ mr: 1 }} />
          Voir détails
        </MenuItem>
        {canModifyIntervention(selectedIntervention!) && (
          <MenuItem onClick={handleEdit}>
            <EditIcon sx={{ mr: 1 }} />
            Modifier
          </MenuItem>
        )}
        {isAdmin() && (
          <MenuItem onClick={handleDelete}>
            <DeleteIcon sx={{ mr: 1 }} />
            Supprimer
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
