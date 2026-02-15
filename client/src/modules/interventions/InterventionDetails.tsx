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
  Tooltip,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ImageList,
  ImageListItem,
  ImageListItemBar
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
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  PhotoCamera as PhotoCameraIcon,
  Comment as CommentIcon,
  Done as DoneIcon,
  Close as CloseIcon
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
  const { user, hasPermissionAsync, isTechnician, isHousekeeper, isSupervisor } = useAuth();
  
  // ÉTAPE 2 : AJOUT DES USESTATE HOOKS (maintenant typés)
  const [intervention, setIntervention] = useState<InterventionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
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
          // Initialiser les notes si elles existent
          if (data.notes) {
            setNotesValue(data.notes);
          }
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
  
  // Fonction pour démarrer une intervention
  const handleStartIntervention = async () => {
    if (!id || !intervention) return;
    
    setStarting(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/start`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        setError(null); // Effacer les erreurs précédentes
        console.log('🔍 Intervention démarrée avec succès');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors du démarrage de l\'intervention');
      }
    } catch (err) {
      console.error('🔍 Erreur lors du démarrage:', err);
      setError('Erreur lors du démarrage de l\'intervention');
    } finally {
      setStarting(false);
    }
  };

  // Fonction pour mettre à jour la progression
  const handleUpdateProgress = async () => {
    if (!id || !intervention) return;
    
    setUpdatingProgress(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/progress?progressPercentage=${progressValue}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        setProgressDialogOpen(false);
        setError(null); // Effacer les erreurs précédentes
        console.log('🔍 Progression mise à jour avec succès');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la mise à jour de la progression');
      }
    } catch (err) {
      console.error('🔍 Erreur lors de la mise à jour:', err);
      setError('Erreur lors de la mise à jour de la progression');
    } finally {
      setUpdatingProgress(false);
    }
  };

  // Vérifier si l'utilisateur peut démarrer/mettre à jour cette intervention
  const canStartOrUpdateIntervention = (): boolean => {
    if (!intervention) return false;
    // Vérifier si l'utilisateur est TECHNICIAN, HOUSEKEEPER ou SUPERVISOR
    const isOperationalUser = isTechnician() || isHousekeeper() || isSupervisor();
    if (!isOperationalUser) return false;
    
    // Vérifier que l'intervention est assignée (individuellement ou par équipe)
    return intervention.assignedToId !== undefined && intervention.assignedToId !== null;
  };

  // Vérifier si l'intervention peut être démarrée
  const canStartIntervention = (): boolean => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention() && intervention.status === 'PENDING';
  };

  // Vérifier si l'intervention peut avoir sa progression mise à jour
  const canUpdateProgress = (): boolean => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention() && intervention.status === 'IN_PROGRESS';
  };

  // Fonction pour terminer une intervention
  const handleCompleteIntervention = async () => {
    if (!id || !intervention) return;
    
    setCompleting(true);
    try {
      // Mettre la progression à 100% et le statut à COMPLETED
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/progress?progressPercentage=100`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        setError(null);
        console.log('🔍 Intervention terminée avec succès');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la finalisation de l\'intervention');
      }
    } catch (err) {
      console.error('🔍 Erreur lors de la finalisation:', err);
      setError('Erreur lors de la finalisation de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // Fonction pour mettre à jour les notes
  const handleUpdateNotes = async () => {
    if (!id || !intervention) return;
    
    setUpdatingNotes(true);
    try {
      const formData = new URLSearchParams();
      formData.append('notes', notesValue);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/notes`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        setNotesDialogOpen(false);
        setError(null);
        console.log('🔍 Notes mises à jour avec succès');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la mise à jour des notes');
      }
    } catch (err) {
      console.error('🔍 Erreur lors de la mise à jour des notes:', err);
      setError('Erreur lors de la mise à jour des notes');
    } finally {
      setUpdatingNotes(false);
    }
  };

  // Fonction pour gérer l'upload de photos
  const handlePhotoUpload = async () => {
    if (!id || !intervention || selectedPhotos.length === 0) return;
    
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      selectedPhotos.forEach((photo) => {
        formData.append('photos', photo);
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`
        },
        body: formData
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        setPhotosDialogOpen(false);
        setSelectedPhotos([]);
        setError(null);
        console.log('🔍 Photos ajoutées avec succès');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de l\'ajout des photos');
      }
    } catch (err) {
      console.error('🔍 Erreur lors de l\'upload des photos:', err);
      setError('Erreur lors de l\'ajout des photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Fonction pour ouvrir le dialogue de notes
  const handleOpenNotesDialog = () => {
    setNotesValue(intervention?.notes || '');
    setNotesDialogOpen(true);
  };

  // Fonction pour gérer la sélection de photos
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedPhotos(Array.from(event.target.files));
    }
  };

  // Parser les photos depuis la chaîne (si stockées comme JSON ou URLs séparées par des virgules)
  const parsePhotos = (photosString: string | undefined): string[] => {
    if (!photosString) return [];
    try {
      // Essayer de parser comme JSON array
      if (photosString.trim().startsWith('[')) {
        const parsed = JSON.parse(photosString);
        return Array.isArray(parsed) ? parsed : [photosString];
      } else {
        // Sinon, traiter comme une chaîne séparée par des virgules
        return photosString.split(',').filter(url => url.trim() !== '');
      }
    } catch {
      // Si le parsing échoue, traiter comme une seule URL
      return [photosString];
    }
  };
  
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
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ fontSize: '0.95rem' }}>
                        {intervention.progressPercentage}%
                      </Typography>
                      {canUpdateProgress() && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setProgressValue(intervention.progressPercentage);
                            setProgressDialogOpen(true);
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={intervention.progressPercentage}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                {/* Bouton pour démarrer l'intervention */}
                {canStartIntervention() && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PlayArrowIcon />}
                      fullWidth
                      onClick={handleStartIntervention}
                      disabled={starting}
                      sx={{ py: 1 }}
                    >
                      {starting ? 'Démarrage...' : 'Démarrer l\'intervention'}
                    </Button>
                  </Box>
                )}

                {/* Section Actions pour interventions en cours */}
                {canUpdateProgress() && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                      Actions
                    </Typography>

                    {/* Boutons d'action */}
                    <Grid container spacing={1.5} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={4}>
                        <Button
                          variant="outlined"
                          startIcon={<PhotoCameraIcon />}
                          fullWidth
                          onClick={() => setPhotosDialogOpen(true)}
                          disabled={uploadingPhotos}
                          size="small"
                        >
                          Ajouter photos
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          variant="outlined"
                          startIcon={<CommentIcon />}
                          fullWidth
                          onClick={handleOpenNotesDialog}
                          disabled={updatingNotes}
                          size="small"
                        >
                          {intervention.notes ? 'Modifier notes' : 'Ajouter notes'}
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<DoneIcon />}
                          fullWidth
                          onClick={handleCompleteIntervention}
                          disabled={completing || intervention.progressPercentage === 100 || intervention.status === 'COMPLETED'}
                          size="small"
                        >
                          {completing ? 'Finalisation...' : (intervention.status === 'COMPLETED' ? 'Terminée' : 'Terminer')}
                        </Button>
                      </Grid>
                    </Grid>

                    {/* Photos existantes */}
                    {intervention.photos && parsePhotos(intervention.photos).length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                          Photos ajoutées
                        </Typography>
                        <ImageList cols={3} gap={8}>
                          {parsePhotos(intervention.photos).map((photoUrl, index) => (
                            <ImageListItem key={index}>
                              <img
                                src={photoUrl}
                                alt={`Photo ${index + 1}`}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </ImageListItem>
                          ))}
                        </ImageList>
                      </Box>
                    )}

                    {/* Notes existantes */}
                    {intervention.notes && (
                      <Box sx={{ mb: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Notes
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={handleOpenNotesDialog}
                            sx={{ p: 0.5 }}
                          >
                            <EditIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                        <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                          {intervention.notes}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* Notes (affichage seul si pas en cours) */}
                {!canUpdateProgress() && intervention.notes && (
                  <>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                      Notes
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
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

      {/* Dialogue pour mettre à jour la progression */}
      <Dialog 
        open={progressDialogOpen} 
        onClose={() => setProgressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Mettre à jour la progression
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Définissez le pourcentage de progression de l'intervention
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={progressValue}
                onChange={(_, newValue) => setProgressValue(newValue as number)}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' }
                ]}
                valueLabelDisplay="on"
                sx={{ mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progressValue}
                sx={{ width: '100%', height: 8, borderRadius: 4 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProgressDialogOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleUpdateProgress} 
            variant="contained"
            disabled={updatingProgress}
          >
            {updatingProgress ? 'Mise à jour...' : 'Mettre à jour'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour ajouter/modifier les notes */}
      <Dialog 
        open={notesDialogOpen} 
        onClose={() => setNotesDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {intervention?.notes ? 'Modifier les notes' : 'Ajouter des notes'}
        </DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={6}
            fullWidth
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Ajoutez vos notes sur l'intervention..."
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotesDialogOpen(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleUpdateNotes} 
            variant="contained"
            disabled={updatingNotes}
          >
            {updatingNotes ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue pour ajouter des photos */}
      <Dialog 
        open={photosDialogOpen} 
        onClose={() => {
          setPhotosDialogOpen(false);
          setSelectedPhotos([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Ajouter des photos
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sélectionnez une ou plusieurs photos à ajouter à l'intervention
            </Typography>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="photo-upload"
              multiple
              type="file"
              onChange={handlePhotoSelect}
            />
            <label htmlFor="photo-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<PhotoCameraIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                Sélectionner des photos
              </Button>
            </label>
            {selectedPhotos.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {selectedPhotos.length} photo(s) sélectionnée(s)
                </Typography>
                <ImageList cols={2} gap={8}>
                  {selectedPhotos.map((photo, index) => (
                    <ImageListItem key={index}>
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={`Preview ${index + 1}`}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <ImageListItemBar
                        actionIcon={
                          <IconButton
                            sx={{ color: 'rgba(255, 255, 255, 0.54)' }}
                            onClick={() => {
                              setSelectedPhotos(selectedPhotos.filter((_, i) => i !== index));
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                        }
                      />
                    </ImageListItem>
                  ))}
                </ImageList>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPhotosDialogOpen(false);
            setSelectedPhotos([]);
          }}>
            Annuler
          </Button>
          <Button 
            onClick={handlePhotoUpload} 
            variant="contained"
            disabled={uploadingPhotos || selectedPhotos.length === 0}
          >
            {uploadingPhotos ? 'Upload...' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
