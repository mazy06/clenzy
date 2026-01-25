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
  const { user, hasPermissionAsync } = useAuth();
  
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
    if (canEditInterventions) return true;
    
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
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canViewInterventionsPermission = await hasPermissionAsync('interventions:view');
      setCanViewInterventions(canViewInterventionsPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;
  const [canEditInterventions, setCanEditInterventions] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditInterventionsPermission = await hasPermissionAsync('interventions:edit');
      setCanEditInterventions(canEditInterventionsPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;
  
  // Si l'utilisateur n'a pas la permission de voir les interventions, afficher un message informatif
  if (!canViewInterventions) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
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
    <Box sx={{ p: 2 }}>
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
                size="small"
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
          <CircularProgress size={32} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {intervention && !loading && (
        <Grid container spacing={2}>
          {/* Informations principales */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph sx={{ fontSize: '0.85rem' }}>
                  {intervention.description}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={0.75}>
                      <BuildIcon sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Type:
                      </Typography>
                    </Box>
                    <Chip
                      label={getTypeLabel(intervention.type)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={0.75}>
                      <Box sx={{ fontSize: 18, mr: 0.75 }}>{getStatusIcon(intervention.status)}</Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Statut:
                      </Typography>
                    </Box>
                    <Chip
                      label={getStatusLabel(intervention.status)}
                      color={getStatusColor(intervention.status) as any}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={0.75}>
                      <PriorityHighIcon sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Priorité:
                      </Typography>
                    </Box>
                    <Chip
                      label={getPriorityLabel(intervention.priority)}
                      color={getPriorityColor(intervention.priority) as any}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box display="flex" alignItems="center" mb={0.75}>
                      <ScheduleIcon sx={{ mr: 0.75, color: 'text.secondary', fontSize: 18 }} />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Planifié:
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 1.5 }} />

                {/* Progression */}
                <Box mb={1.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                      Progression
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ fontSize: '0.95rem' }}>
                      {intervention.progressPercentage}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={intervention.progressPercentage}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                {/* Notes */}
                {intervention.notes && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                      Notes
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.85rem' }}>
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
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                  Propriété
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <LocationIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{intervention.propertyName}</Typography>}
                      secondary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{`${intervention.propertyAddress}, ${intervention.propertyCity} ${intervention.propertyPostalCode}, ${intervention.propertyCountry}`}</Typography>}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Demandeur */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                  Demandeur
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <PersonIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText primary={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{intervention.requestorName}</Typography>} />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Assignation */}
            <Card sx={{ mb: 1.5 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                  Assignation
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {intervention.assignedToType === 'team' ? <GroupIcon sx={{ fontSize: 18 }} /> : <PersonIcon sx={{ fontSize: 18 }} />}
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{intervention.assignedToName}</Typography>}
                      secondary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}</Typography>}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>

            {/* Détails techniques */}
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                  Détails techniques
                </Typography>
                <List dense>
                  <ListItem sx={{ px: 0, py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <ScheduleIcon sx={{ fontSize: 18 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Durée estimée</Typography>}
                      secondary={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{formatDuration(intervention.estimatedDurationHours)}</Typography>}
                    />
                  </ListItem>
                  {intervention.estimatedCost && (
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <PriorityHighIcon sx={{ fontSize: 18 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Coût estimé</Typography>}
                        secondary={<Typography variant="body2" sx={{ fontSize: '0.85rem' }}>{formatCurrency(intervention.estimatedCost)}</Typography>}
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
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
              Informations temporelles
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                  Créée le
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {formatDate(intervention.createdAt)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                  Dernière mise à jour
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                  {intervention.updatedAt ? formatDate(intervention.updatedAt) : 'Aucune'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                  Terminée le
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
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
