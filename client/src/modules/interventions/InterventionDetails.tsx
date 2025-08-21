import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon,
  Schedule as ScheduleIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Build as BuildIcon,
  PriorityHigh as PriorityHighIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { API_CONFIG } from '../../config/api';

// ÉTAPE 5 : AJOUT DE L'INTERFACE TYPESCRIPT
interface InterventionDetails {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode: string;
  propertyCountry: string;
  requestorId: number;
  requestorName: string;
  assignedToId: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  actualDurationMinutes: number;
  estimatedCost: number;
  actualCost: number;
  notes: string;
  photos: string;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
}

// ÉTAPE 3 : AJOUT DES FONCTIONS UTILITAIRES
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'IN_PROGRESS': return 'info';
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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'PENDING': return <WarningIcon />;
    case 'IN_PROGRESS': return <InfoIcon />;
    case 'COMPLETED': return <CheckCircleIcon />;
    case 'CANCELLED': return <ErrorIcon />;
    default: return <InfoIcon />;
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export default function InterventionDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  
  // ÉTAPE 2 : AJOUT DES USESTATE HOOKS (maintenant typés)
  const [intervention, setIntervention] = useState<InterventionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ÉTAPE 4 : AJOUT DU USEEFFECT POUR CHARGER LES DONNÉES
  useEffect(() => {
    const loadIntervention = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        console.log('🔍 InterventionDetails - Chargement de l\'intervention:', id);
        
        // Appel API réel
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 InterventionDetails - Intervention chargée:', data);
          setIntervention(data);
        } else {
          console.error('🔍 InterventionDetails - Erreur API:', response.status);
          setError('Erreur lors du chargement de l\'intervention');
        }
      } catch (err) {
        console.error('🔍 InterventionDetails - Erreur chargement:', err);
        setError('Erreur lors du chargement de l\'intervention');
      } finally {
        setLoading(false);
      }
    };

    loadIntervention();
  }, [id]);
  
  // ÉTAPE 5 : AJOUT DE LA LOGIQUE MÉTIER
  const canModifyIntervention = (): boolean => {
    if (hasPermission('interventions:edit')) return true;
    
    if (!intervention) return false;
    
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
  
  // Vérifier la permission de visualisation d'interventions
  const canViewInterventions = hasPermission('interventions:view');
  const canEditInterventions = hasPermission('interventions:edit');
  
  // Si l'utilisateur n'a pas la permission de voir les interventions, afficher un message informatif
  if (!canViewInterventions) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour visualiser les détails des interventions.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // COMPOSANT SIMPLIFIÉ - ÉTAPE 6
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <PageHeader
        title="Détails de l'intervention"
        subtitle="Consultation et gestion des informations de l'intervention"
        backPath="/interventions"
        backLabel="Retour aux interventions"
        actions={
          <>
            {canEditInterventions && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/interventions/${id}/edit`)}
              >
                Modifier
              </Button>
            )}
          </>
        }
        showBackButton={false}
        showBackButtonWithActions={true}
      />

      {/* ÉTAPE 6 : AFFICHAGE AVEC MATERIAL-UI */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {intervention && !loading && (
        <Grid container spacing={3}>
          {/* Informations principales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" color="textSecondary" paragraph>
                  {intervention.description}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <BuildIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="textSecondary">
                        Type:
                      </Typography>
                    </Box>
                    <Chip
                      label={getTypeLabel(intervention.type)}
                      color="primary"
                      variant="outlined"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={1}>
                      {getStatusIcon(intervention.status)}
                      <Typography variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                        Statut:
                      </Typography>
                    </Box>
                    <Chip
                      label={getStatusLabel(intervention.status)}
                      color={getStatusColor(intervention.status) as any}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <PriorityHighIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="textSecondary">
                        Priorité:
                      </Typography>
                    </Box>
                    <Chip
                      label={getPriorityLabel(intervention.priority)}
                      color={getPriorityColor(intervention.priority) as any}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <ScheduleIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2" color="textSecondary">
                        Planifié:
                      </Typography>
                    </Box>
                    <Typography variant="body1">
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {/* Progression */}
                <Box mb={2}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">
                      Progression
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {intervention.progressPercentage}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={intervention.progressPercentage}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                {/* Notes */}
                {intervention.notes && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1" color="textSecondary">
                      {intervention.notes}
                    </Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Informations secondaires */}
          <Grid item xs={12} md={4}>
            {/* Propriété */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Propriété
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <LocationIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={intervention.propertyName}
                      secondary={`${intervention.propertyAddress}, ${intervention.propertyCity} ${intervention.propertyPostalCode}, ${intervention.propertyCountry}`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Demandeur */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Demandeur
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary={intervention.requestorName} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Assignation */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assignation
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {intervention.assignedToType === 'team' ? <GroupIcon /> : <PersonIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={intervention.assignedToName}
                      secondary={intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Détails techniques */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Détails techniques
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <ScheduleIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Durée estimée"
                      secondary={formatDuration(intervention.estimatedDurationHours)}
                    />
                  </ListItem>
                  {intervention.estimatedCost && (
                    <ListItem>
                      <ListItemIcon>
                        <PriorityHighIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Coût estimé"
                        secondary={formatCurrency(intervention.estimatedCost)}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Informations temporelles */}
      {intervention && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Informations temporelles
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">
                  Créée le
                </Typography>
                <Typography variant="body1">
                  {formatDate(intervention.createdAt)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">
                  Dernière mise à jour
                </Typography>
                <Typography variant="body1">
                  {intervention.updatedAt ? formatDate(intervention.updatedAt) : 'Aucune'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="textSecondary">
                  Terminée le
                </Typography>
                <Typography variant="body1">
                  {intervention.completedAt ? formatDate(intervention.completedAt) : 'Non terminée'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
