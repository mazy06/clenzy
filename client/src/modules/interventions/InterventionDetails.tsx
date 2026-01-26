import React, { useState, useEffect, useRef } from 'react';
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
  ImageListItemBar,
  Accordion,
  AccordionSummary,
  AccordionDetails
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
  Close as CloseIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  StopCircle as StopCircleIcon,
  Autorenew as AutorenewIcon,
  HourglassEmpty as HourglassEmptyIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Room as RoomIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ExpandMore as ExpandMoreIcon,
  Replay as ReplayIcon
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
  startTime?: string;
  endTime?: string;
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
  const iconSx = { fontSize: 20 };
  switch (status) {
    case 'PENDING': 
      return <WarningIcon sx={{ color: 'warning.main', ...iconSx }} />;
    case 'IN_PROGRESS': 
      return (
        <AutorenewIcon 
          sx={{ 
            color: 'info.main',
            fontSize: 20,
            animation: 'spin 2s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }} 
        />
      );
    case 'COMPLETED': 
      return <CheckCircleIcon sx={{ color: 'success.main', ...iconSx }} />;
    case 'CANCELLED': 
      return <ErrorIcon sx={{ color: 'error.main', ...iconSx }} />;
    default: 
      return <InfoIcon sx={{ color: 'info.main', ...iconSx }} />;
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
  const [currentStepForNotes, setCurrentStepForNotes] = useState<'inspection' | 'rooms' | 'after_photos' | null>(null);
  
  // Notes par étape
  const [stepNotes, setStepNotes] = useState<{
    inspection?: string;
    rooms?: { [key: number]: string; general?: string };
    after_photos?: string;
  }>({});
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [showSidebar, setShowSidebar] = useState(true);
  
  // États pour le système d'étapes de progression
  const [propertyDetails, setPropertyDetails] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [validatedRooms, setValidatedRooms] = useState<Set<number>>(new Set());
  const [inspectionComplete, setInspectionComplete] = useState(false);
  const [allRoomsValidated, setAllRoomsValidated] = useState(false);
  
  // Références pour les timers de sauvegarde automatique
  const notesSaveTimeoutRef = useRef<number | null>(null);
  const lastSavedNotesRef = useRef<string>('');
  const isInitialLoadRef = useRef<boolean>(true);
  
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
          
          // Charger les détails de la propriété pour obtenir le nombre de pièces
          if (data.propertyId) {
            try {
              const propertyResponse = await fetch(`${API_CONFIG.BASE_URL}/api/properties/${data.propertyId}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
                  'Content-Type': 'application/json'
                }
              });
              if (propertyResponse.ok) {
                const propertyData = await propertyResponse.json();
                setPropertyDetails(propertyData);
                
                // Après avoir chargé propertyDetails, vérifier si toutes les pièces sont validées
                if (data.validatedRooms) {
                  try {
                    const parsedRooms = JSON.parse(data.validatedRooms);
                    if (Array.isArray(parsedRooms)) {
                      const totalRooms = (propertyData.bedrooms || 0) + 
                        (propertyData.bathrooms || 0) + 
                        (propertyData.livingRooms || 0) + 
                        (propertyData.kitchens || 0);
                      if (parsedRooms.length === totalRooms && totalRooms > 0) {
                        setAllRoomsValidated(true);
                        // Marquer l'étape 2 comme complétée si toutes les pièces sont validées
                        setCompletedSteps(prev => new Set(prev).add('rooms'));
                      }
                    }
                  } catch (err) {
                    console.error('Erreur lors du parsing des pièces validées:', err);
                  }
                }
              }
            } catch (err) {
              console.error('Erreur lors du chargement de la propriété:', err);
            }
          }
          
          // Charger les étapes complétées depuis la base de données
          if (data.completedSteps) {
            try {
              const parsedSteps = JSON.parse(data.completedSteps);
              if (Array.isArray(parsedSteps)) {
                setCompletedSteps(new Set(parsedSteps));
                // Mettre à jour inspectionComplete si l'étape inspection est complétée
                if (parsedSteps.includes('inspection')) {
                  setInspectionComplete(true);
                }
              }
            } catch (err) {
              console.error('Erreur lors du parsing des étapes complétées:', err);
            }
          }
          
          // Initialiser les photos existantes en utilisant les champs séparés
          if (data.beforePhotosUrls) {
            const beforePhotos = parsePhotos(data.beforePhotosUrls);
            setBeforePhotos(beforePhotos);
            // Si des photos avant existent, marquer l'inspection comme complète
            if (beforePhotos.length > 0) {
              setInspectionComplete(true);
              // Ajouter 'inspection' aux étapes complétées si pas déjà présent
              setCompletedSteps(prev => {
                if (!prev.has('inspection')) {
                  const newSet = new Set(prev).add('inspection');
                  saveCompletedSteps(newSet);
                  return newSet;
                }
                return prev;
              });
            }
          } else {
            setBeforePhotos([]);
          }
          
          if (data.afterPhotosUrls) {
            const afterPhotos = parsePhotos(data.afterPhotosUrls);
            setAfterPhotos(afterPhotos);
            // Si des photos après existent, marquer l'étape comme complète
            if (afterPhotos.length > 0) {
              // Ajouter 'after_photos' aux étapes complétées si pas déjà présent
              setCompletedSteps(prev => {
                if (!prev.has('after_photos')) {
                  const newSet = new Set(prev).add('after_photos');
                  saveCompletedSteps(newSet);
                  return newSet;
                }
                return prev;
              });
            }
          } else {
            setAfterPhotos([]);
          }
          
          // Parser les notes par étape depuis le champ notes (format JSON)
          if (data.notes) {
            try {
              const parsedNotes = JSON.parse(data.notes);
              if (typeof parsedNotes === 'object' && parsedNotes !== null) {
                setStepNotes(parsedNotes);
                // Marquer comme dernière version sauvegardée
                lastSavedNotesRef.current = data.notes;
              } else {
                // Si ce n'est pas un JSON valide, considérer comme note globale (ancien format)
                // On peut la mettre dans l'étape d'inspection par défaut
                const initialNotes = { inspection: data.notes };
                setStepNotes(initialNotes);
                lastSavedNotesRef.current = JSON.stringify(initialNotes);
              }
            } catch {
              // Si le parsing échoue, considérer comme note globale (ancien format)
              const initialNotes = { inspection: data.notes };
              setStepNotes(initialNotes);
              lastSavedNotesRef.current = JSON.stringify(initialNotes);
            }
          }
          
          // Marquer que le chargement initial est terminé
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 1000);
          
          // Charger les pièces validées depuis la base de données
          if (data.validatedRooms) {
            try {
              const parsedRooms = JSON.parse(data.validatedRooms);
              if (Array.isArray(parsedRooms)) {
                setValidatedRooms(new Set(parsedRooms));
                // Vérifier si toutes les pièces sont validées (après avoir chargé propertyDetails)
                if (propertyDetails) {
                  const totalRooms = (propertyDetails.bedrooms || 0) + 
                    (propertyDetails.bathrooms || 0) + 
                    (propertyDetails.livingRooms || 0) + 
                    (propertyDetails.kitchens || 0);
                  if (parsedRooms.length === totalRooms && totalRooms > 0) {
                    setAllRoomsValidated(true);
                    // Marquer l'étape 2 comme complétée si toutes les pièces sont validées
                    setCompletedSteps(prev => {
                      if (!prev.has('rooms')) {
                        const newSet = new Set(prev).add('rooms');
                        saveCompletedSteps(newSet);
                        return newSet;
                      }
                      return prev;
                    });
                  }
                }
              }
            } catch (err) {
              console.error('Erreur lors du parsing des pièces validées:', err);
            }
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
    // Permettre les modifications si l'intervention est en cours OU si elle a été rouverte (était terminée mais maintenant en cours)
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

  // Fonction pour rouvrir une intervention terminée
  const handleReopenIntervention = async () => {
    if (!id || !intervention) return;
    
    setCompleting(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/reopen`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        
        // Restaurer d'abord l'état des pièces validées
        let shouldKeepRoomsValidated = false;
        if (updatedIntervention.validatedRooms) {
          try {
            const parsedRooms = JSON.parse(updatedIntervention.validatedRooms);
            if (Array.isArray(parsedRooms) && parsedRooms.length > 0) {
              // Restaurer validatedRooms en premier
              setValidatedRooms(new Set(parsedRooms));
              
              // Vérifier si toutes les pièces sont validées
              // Utiliser setTimeout pour s'assurer que propertyDetails est chargé
              setTimeout(() => {
                const totalRooms = getTotalRooms();
                if (parsedRooms.length === totalRooms && totalRooms > 0) {
                  setAllRoomsValidated(true);
                  console.log('🔍 Étape 2 restaurée comme validée après réouverture');
                }
              }, 200);
              
              // Vérifier immédiatement si on doit garder l'étape 2 validée
              if (propertyDetails) {
                const totalRooms = (propertyDetails.bedrooms || 0) + 
                  (propertyDetails.bathrooms || 0) + 
                  (propertyDetails.livingRooms || 0) + 
                  (propertyDetails.kitchens || 0);
                if (parsedRooms.length === totalRooms && totalRooms > 0) {
                  shouldKeepRoomsValidated = true;
                  setAllRoomsValidated(true);
                }
              }
            }
          } catch (err) {
            console.error('Erreur lors du parsing des pièces validées:', err);
          }
        }
        
        // Réinitialiser UNIQUEMENT l'état de l'étape 3 (after_photos) pour permettre à nouveau la validation
        // L'étape 2 (rooms) doit rester validée si toutes les pièces étaient validées
        setCompletedSteps(prev => {
          const newSet = new Set(prev);
          newSet.delete('after_photos'); // Retirer seulement l'étape 3
          // Garder 'rooms' si toutes les pièces sont validées
          if (shouldKeepRoomsValidated) {
            newSet.add('rooms');
          }
          return newSet;
        });
        
        // Recalculer la progression sans l'étape 3
        // Utiliser plusieurs setTimeout pour s'assurer que tous les états sont bien restaurés
        // Premier setTimeout pour restaurer les états
        setTimeout(() => {
          // Deuxième setTimeout pour recalculer après que tous les états soient mis à jour
          setTimeout(() => {
            const newProgress = calculateProgress();
            console.log('🔍 Progression recalculée après réouverture:', newProgress, 'vs progression actuelle:', updatedIntervention.progressPercentage);
            // Forcer la mise à jour de la progression même si la différence est petite
            // car on sait que la progression doit être recalculée après réouverture
            // La progression devrait être inférieure à 100% car l'étape 3 est réinitialisée
            if (newProgress < 100) {
              handleUpdateProgressValue(newProgress);
            } else {
              // Si la progression est toujours à 100%, forcer quand même la mise à jour
              // car cela signifie qu'il y a un problème de cohérence
              console.warn('🔍 Progression toujours à 100% après réouverture, forcer la mise à jour');
              handleUpdateProgressValue(newProgress);
            }
          }, 300);
        }, 200);
        
        setError(null);
        // Réinitialiser le flag de chargement initial pour permettre la sauvegarde automatique
        isInitialLoadRef.current = false;
        console.log('🔍 Intervention rouverte avec succès - Étape 3 réinitialisée, étape 2 conservée');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de la réouverture de l\'intervention');
      }
    } catch (err) {
      console.error('🔍 Erreur lors de la réouverture:', err);
      setError('Erreur lors de la réouverture de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // Fonction pour ouvrir le dialogue de notes pour une étape spécifique
  const handleOpenNotesDialog = (step: 'inspection' | 'rooms' | 'after_photos', roomIndex?: number) => {
    setCurrentStepForNotes(step);
    if (step === 'rooms' && roomIndex !== undefined) {
      // Pour les notes de pièce, récupérer la note existante pour cette pièce
      const rooms = stepNotes.rooms;
      const roomNote = (rooms && typeof rooms === 'object' && roomIndex in rooms) ? rooms[roomIndex] : '';
      setNotesValue(roomNote);
    } else if (step === 'rooms') {
      // Pour les notes générales de pièces, récupérer la note générale
      const rooms = stepNotes.rooms;
      const generalNote = (rooms && typeof rooms === 'object' && 'general' in rooms) ? rooms.general || '' : '';
      setNotesValue(generalNote);
    } else {
      // Pour les autres étapes, récupérer la note existante
      const existingNote = stepNotes[step] || '';
      setNotesValue(existingNote);
    }
    setNotesDialogOpen(true);
  };

  // Fonction pour sauvegarder les étapes complétées en base de données
  const saveCompletedSteps = async (steps: Set<string>) => {
    if (!id || !intervention) return;
    
    try {
      const completedStepsArray = Array.from(steps);
      const completedStepsJson = JSON.stringify(completedStepsArray);
      
      const formData = new URLSearchParams();
      formData.append('completedSteps', completedStepsJson);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/completed-steps`, {
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
        console.log('🔍 Étapes complétées sauvegardées avec succès');
      } else {
        console.error('Erreur lors de la sauvegarde des étapes complétées');
      }
    } catch (err) {
      console.error('Erreur lors de la sauvegarde des étapes complétées:', err);
    }
  };

  // Fonction pour sauvegarder les notes automatiquement (avec debounce)
  const saveNotesAuto = async (notesToSave: typeof stepNotes, immediate: boolean = false) => {
    if (!id || !intervention) return;
    
    // Annuler le timer précédent si on n'est pas en mode immédiat
    if (notesSaveTimeoutRef.current && !immediate) {
      clearTimeout(notesSaveTimeoutRef.current);
    }
    
    const saveNotes = async () => {
      try {
        const notesJson = JSON.stringify(notesToSave);
        
        // Éviter de sauvegarder si rien n'a changé
        if (notesJson === lastSavedNotesRef.current) {
          return;
        }
        
        const formData = new URLSearchParams();
        formData.append('notes', notesJson);

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
          lastSavedNotesRef.current = notesJson;
          console.log('🔍 Notes sauvegardées automatiquement');
        } else {
          console.error('Erreur lors de la sauvegarde automatique des notes');
        }
      } catch (err) {
        console.error('Erreur lors de la sauvegarde automatique des notes:', err);
      }
    };
    
    if (immediate) {
      await saveNotes();
    } else {
      // Debounce: sauvegarder après 2 secondes d'inactivité
      notesSaveTimeoutRef.current = setTimeout(saveNotes, 2000);
    }
  };

  // Fonction pour mettre à jour les notes d'une étape spécifique
  const handleUpdateNotes = async () => {
    if (!id || !intervention || !currentStepForNotes) return;
    
    setUpdatingNotes(true);
    try {
      // Mettre à jour les notes par étape
      const updatedStepNotes = { ...stepNotes };
      
      if (currentStepForNotes === 'rooms') {
        // Pour les notes de pièce, on doit avoir un roomIndex
        // Pour l'instant, on va stocker dans une structure générale
        // On pourrait améliorer cela en passant roomIndex dans le state
        if (!updatedStepNotes.rooms) {
          updatedStepNotes.rooms = {};
        }
        // Note: on pourrait améliorer en stockant la note dans une pièce spécifique
        // Pour l'instant, on stocke comme note générale pour les pièces
        if (!updatedStepNotes.rooms) {
          updatedStepNotes.rooms = {};
        }
        updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: notesValue };
      } else {
        updatedStepNotes[currentStepForNotes] = notesValue;
      }
      
      // Sauvegarder immédiatement
      await saveNotesAuto(updatedStepNotes, true);
      
      setStepNotes(updatedStepNotes);
      setNotesDialogOpen(false);
      setNotesValue('');
      setCurrentStepForNotes(null);
      setError(null);
      console.log('🔍 Notes mises à jour avec succès');
    } catch (err) {
      console.error('🔍 Erreur lors de la mise à jour des notes:', err);
      setError('Erreur lors de la mise à jour des notes');
    } finally {
      setUpdatingNotes(false);
    }
  };
  
  // Fonction réutilisable pour afficher les photos
  const renderPhotosGallery = (photos: string[], title: string, photoType: 'before' | 'after') => {
    if (photos.length === 0) return null;
    
    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
            {photos.length} photo(s) ajoutée(s)
            {completedSteps.has(photoType === 'before' ? 'inspection' : 'after_photos') && (
              <Chip 
                label="Validée" 
                size="small" 
                color="success" 
                sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} 
              />
            )}
          </Typography>
        </Box>
        
        <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1, fontSize: '0.85rem' }}>
          {title}
        </Typography>
        <ImageList cols={4} gap={4} sx={{ width: '100%', height: 'auto' }}>
          {photos.map((photoUrl, index) => (
            <ImageListItem key={`${photoType}-${index}`} sx={{ height: 120 }}>
              <img
                src={photoUrl}
                alt={`${title} ${index + 1}`}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </ImageListItem>
          ))}
        </ImageList>
      </Box>
    );
  };

  // Fonction pour obtenir la note d'une étape
  const getStepNote = (step: 'inspection' | 'rooms' | 'after_photos'): string => {
    if (step === 'rooms') {
      if (stepNotes.rooms && 'general' in stepNotes.rooms) {
        return stepNotes.rooms.general || '';
      }
      return '';
    }
    const note = stepNotes[step];
    return typeof note === 'string' ? note : '';
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
      // Ajouter le type de photo (before ou after)
      formData.append('photoType', photoType);

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
        
        // Utiliser les champs séparés beforePhotosUrls et afterPhotosUrls
        if (photoType === 'before') {
          const beforePhotos = updatedIntervention.beforePhotosUrls 
            ? parsePhotos(updatedIntervention.beforePhotosUrls) 
            : [];
          setBeforePhotos(beforePhotos);
          // Si des photos avant sont ajoutées, marquer l'inspection comme complète
          if (beforePhotos.length > 0) {
            setInspectionComplete(true);
            setCompletedSteps(prev => {
              const newSet = new Set(prev).add('inspection');
              saveCompletedSteps(newSet);
              return newSet;
            });
          }
        } else {
          const afterPhotos = updatedIntervention.afterPhotosUrls 
            ? parsePhotos(updatedIntervention.afterPhotosUrls) 
            : [];
          setAfterPhotos(afterPhotos);
          // Si des photos après sont ajoutées, marquer l'étape comme complète
          if (afterPhotos.length > 0) {
            setCompletedSteps(prev => {
              const newSet = new Set(prev).add('after_photos');
              saveCompletedSteps(newSet);
              return newSet;
            });
            // Mettre à jour la progression
            const newProgress = calculateProgress();
            handleUpdateProgressValue(newProgress);
          }
        }
        
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
  
  // Calculer le nombre total de pièces intérieures
  const getTotalRooms = (): number => {
    if (!propertyDetails) return 0;
    // Chambres + salles de bain + pièces communes (salon, cuisine, etc.)
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    // On ajoute 2 pour les pièces communes (salon + cuisine)
    return bedrooms + bathrooms + 2;
  };
  
  // Obtenir la liste des noms de pièces
  const getRoomNames = (): string[] => {
    if (!propertyDetails) return [];
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    const rooms: string[] = [];
    
    // Ajouter les chambres
    for (let i = 1; i <= bedrooms; i++) {
      rooms.push(`Chambre ${i}`);
    }
    
    // Ajouter les salles de bain
    for (let i = 1; i <= bathrooms; i++) {
      rooms.push(`Salle de bain ${i}`);
    }
    
    // Ajouter les pièces communes
    rooms.push('Salon');
    rooms.push('Cuisine');
    
    return rooms;
  };
  
  // Calculer la progression basée sur les étapes complétées
  const calculateProgress = (): number => {
    const totalRooms = getTotalRooms();
    const totalSteps = 2 + totalRooms; // Inspection (1) + Validation pièces (N) + Photos après (1)
    let completed = 0;
    
    // Étape 1: Inspection générale (photos avant)
    if (inspectionComplete && beforePhotos.length > 0) {
      completed++;
    }
    
    // Étape 2: Validation par pièce
    completed += validatedRooms.size;
    
    // Étape 3: Photos après intervention
    if (completedSteps.has('after_photos') && afterPhotos.length > 0) {
      completed++;
    }
    
    return totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
  };
  
  // Vérifier si toutes les étapes sont complétées
  const areAllStepsCompleted = (): boolean => {
    const totalRooms = getTotalRooms();
    const allRoomsDone = validatedRooms.size === totalRooms;
    // Accepter l'étape 3 comme complétée si :
    // 1. Elle est explicitement marquée comme validée ET il y a des photos
    // 2. OU simplement s'il y a des photos (pour permettre la finalisation après réouverture)
    const afterPhotosDone = (completedSteps.has('after_photos') && afterPhotos.length > 0) || afterPhotos.length > 0;
    
    const result = (
      inspectionComplete &&
      beforePhotos.length > 0 &&
      allRoomsDone &&
      afterPhotosDone
    );
    
    // Log de débogage pour identifier quelle condition n'est pas remplie
    if (!result) {
      console.log('🔍 Conditions pour terminer l\'intervention:');
      console.log('  - inspectionComplete:', inspectionComplete);
      console.log('  - beforePhotos.length > 0:', beforePhotos.length > 0, `(${beforePhotos.length} photos)`);
      console.log('  - allRoomsDone:', allRoomsDone, `(${validatedRooms.size}/${totalRooms} pièces validées)`);
      console.log('  - afterPhotosDone:', afterPhotosDone, `(completedSteps.has('after_photos'): ${completedSteps.has('after_photos')}, afterPhotos.length: ${afterPhotos.length})`);
    }
    
    return result;
  };
  
  // Gérer l'étape d'inspection générale
  const handleInspectionComplete = () => {
    if (beforePhotos.length > 0) {
      setCompletedSteps(prev => {
        const newSet = new Set(prev).add('inspection');
        saveCompletedSteps(newSet);
        return newSet;
      });
      // Mettre à jour la progression
      const newProgress = calculateProgress();
      handleUpdateProgressValue(newProgress);
    }
  };
  
  // Gérer la validation d'une pièce
  const handleRoomValidation = async (roomIndex: number) => {
    const newValidatedRooms = new Set(validatedRooms);
    newValidatedRooms.add(roomIndex);
    setValidatedRooms(newValidatedRooms);
    
    // Vérifier si toutes les pièces sont validées
    const totalRooms = getTotalRooms();
    if (newValidatedRooms.size === totalRooms && totalRooms > 0) {
      setAllRoomsValidated(true);
    }
    
    // Sauvegarder en base de données
    if (id) {
      try {
        const validatedRoomsArray = Array.from(newValidatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);
        
        const formData = new URLSearchParams();
        formData.append('validatedRooms', validatedRoomsJson);
        
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/validated-rooms`, {
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
          console.log('🔍 Pièces validées sauvegardées avec succès');
        } else {
          console.error('Erreur lors de la sauvegarde des pièces validées');
        }
      } catch (err) {
        console.error('Erreur lors de la sauvegarde des pièces validées:', err);
      }
    }
    
    // Mettre à jour la progression
    const newProgress = calculateProgress();
    handleUpdateProgressValue(newProgress);
  };
  
  // Gérer les photos après intervention
  const handleAfterPhotosComplete = () => {
    if (afterPhotos.length > 0) {
      setCompletedSteps(prev => new Set(prev).add('after_photos'));
      // Mettre à jour la progression
      const newProgress = calculateProgress();
      handleUpdateProgressValue(newProgress);
    }
  };
  
  // Mettre à jour la progression sur le serveur
  const handleUpdateProgressValue = async (progress: number) => {
    if (!id || !intervention) return;
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/progress?progressPercentage=${progress}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const updatedIntervention = await response.json();
        setIntervention(updatedIntervention);
        console.log('🔍 Progression mise à jour en base de données:', progress, '%');
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la mise à jour de la progression:', errorData);
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la progression:', err);
    }
  };
  
  // Effet pour mettre à jour la progression automatiquement quand les étapes changent
  useEffect(() => {
    if (intervention && canUpdateProgress() && intervention.status === 'IN_PROGRESS') {
      const newProgress = calculateProgress();
      // Ne mettre à jour que si la progression a vraiment changé (éviter les boucles)
      if (Math.abs(newProgress - (intervention.progressPercentage || 0)) > 1) {
        handleUpdateProgressValue(newProgress);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionComplete, validatedRooms.size, afterPhotos.length, beforePhotos.length]);
  
  // Effet pour sauvegarder automatiquement les notes lors des changements (avec debounce)
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoadRef.current) {
      return;
    }
    
    if (Object.keys(stepNotes).length > 0) {
      const notesJson = JSON.stringify(stepNotes);
      // Ne sauvegarder que si les notes ont vraiment changé
      if (notesJson !== lastSavedNotesRef.current) {
        saveNotesAuto(stepNotes, false);
      }
    }
    
    // Cleanup: sauvegarder immédiatement avant de quitter
    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
      // Sauvegarder immédiatement si on quitte avec des modifications non sauvegardées
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          saveNotesAuto(stepNotes, true);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes]);
  
  // Effet pour sauvegarder automatiquement les étapes complétées lors des changements
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoadRef.current) {
      return;
    }
    
    if (completedSteps.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      // Debounce pour éviter trop de requêtes
      const timeoutId = setTimeout(() => {
        saveCompletedSteps(completedSteps);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps]);
  
  // Effet pour sauvegarder automatiquement les pièces validées lors des changements
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoadRef.current) {
      return;
    }
    
    if (validatedRooms.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      // Debounce pour éviter trop de requêtes
      const timeoutId = setTimeout(() => {
        const validatedRoomsArray = Array.from(validatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);
        
        const formData = new URLSearchParams();
        formData.append('validatedRooms', validatedRoomsJson);
        
        fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/validated-rooms`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString()
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Erreur lors de la sauvegarde');
        })
        .then(updatedIntervention => {
          setIntervention(updatedIntervention);
          console.log('🔍 Pièces validées sauvegardées automatiquement');
        })
        .catch(err => {
          console.error('Erreur lors de la sauvegarde automatique des pièces validées:', err);
        });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedRooms]);
  
  // Effet pour sauvegarder toutes les modifications avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Sauvegarder les notes si elles ont changé
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          // Sauvegarder de manière synchrone (navigator.sendBeacon ou fetch avec keepalive)
          const formData = new URLSearchParams();
          formData.append('notes', notesJson);
          
          // Utiliser sendBeacon pour une sauvegarde fiable même si la page se ferme
          const blob = new Blob([formData.toString()], { type: 'application/x-www-form-urlencoded' });
          const url = `${API_CONFIG.BASE_URL}/api/interventions/${id}/notes`;
          const token = localStorage.getItem('kc_access_token');
          
          // Note: sendBeacon ne supporte pas les headers personnalisés facilement
          // On va utiliser fetch avec keepalive à la place
          fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            keepalive: true
          }).catch(err => {
            console.error('Erreur lors de la sauvegarde avant fermeture:', err);
          });
        }
      }
      
      // Sauvegarder les étapes complétées
      if (completedSteps.size > 0 && id && intervention) {
        const completedStepsArray = Array.from(completedSteps);
        const completedStepsJson = JSON.stringify(completedStepsArray);
        const formData = new URLSearchParams();
        formData.append('completedSteps', completedStepsJson);
        
        fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/completed-steps`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(err => {
          console.error('Erreur lors de la sauvegarde des étapes avant fermeture:', err);
        });
      }
      
      // Sauvegarder les pièces validées
      if (validatedRooms.size > 0 && id && intervention) {
        const validatedRoomsArray = Array.from(validatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);
        const formData = new URLSearchParams();
        formData.append('validatedRooms', validatedRoomsJson);
        
        fetch(`${API_CONFIG.BASE_URL}/api/interventions/${id}/validated-rooms`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(err => {
          console.error('Erreur lors de la sauvegarde des pièces avant fermeture:', err);
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes, completedSteps, validatedRooms, id, intervention]);
  
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
            <IconButton
              onClick={() => setShowSidebar(!showSidebar)}
              size="small"
              sx={{ mr: 1, border: '1px solid', borderColor: 'divider' }}
              title={showSidebar ? "Masquer les détails" : "Afficher les détails"}
            >
              {showSidebar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
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
          <Grid item xs={12} md={showSidebar ? 8 : 12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph sx={{ fontSize: '0.85rem' }}>
                  {intervention.description}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {/* Layout responsive avec flexbox */}
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 2,
                    '& > *': {
                      flex: '1 1 auto',
                      minWidth: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' },
                      maxWidth: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' }
                    }
                  }}
                >
                  {/* Type */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                      sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        flexShrink: 0
                      }}
                    >
                      <BuildIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Type:
                    </Typography>
                    <Chip
                      label={getTypeLabel(intervention.type)}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Box>

                  {/* Statut */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                      sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        flexShrink: 0
                      }}
                    >
                      {getStatusIcon(intervention.status)}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Statut:
                    </Typography>
                    <Chip
                      label={getStatusLabel(intervention.status)}
                      color={getStatusColor(intervention.status) as any}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Box>

                  {/* Priorité */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                      sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        flexShrink: 0
                      }}
                    >
                      <PriorityHighIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Priorité:
                    </Typography>
                    <Chip
                      label={getPriorityLabel(intervention.priority)}
                      color={getPriorityColor(intervention.priority) as any}
                      size="small"
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Box>

                  {/* Planifié */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box 
                      sx={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 20,
                        height: 20,
                        flexShrink: 0
                      }}
                    >
                      <ScheduleIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                      Planifié:
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </Box>

                  {/* Date et heure de début */}
                  {intervention.startTime && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          flexShrink: 0
                        }}
                      >
                        <PlayCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Début:
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {formatDate(intervention.startTime)}
                      </Typography>
                    </Box>
                  )}

                  {/* Date de fin */}
                  {intervention.endTime && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          flexShrink: 0
                        }}
                      >
                        <StopCircleIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
                        Fin:
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {formatDate(intervention.endTime)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Progression */}
                <Box mb={1.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                      Progression
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ fontSize: '0.95rem' }}>
                      {calculateProgress()}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={calculateProgress()}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                {/* Étapes de progression */}
                {canUpdateProgress() && propertyDetails && (
                  <Box mb={2}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5, fontSize: '0.95rem' }}>
                      Étapes de progression
                    </Typography>
                    
                    {/* Étape 3: Photos après intervention - LA PLUS RÉCENTE (en haut) */}
                    {/* Afficher seulement si l'étape 2 est validée (étape suivante) OU si l'étape 3 est validée */}
                    {allRoomsValidated && (
                      (completedSteps.has('after_photos') && afterPhotos.length > 0) ? (
                        <Accordion 
                        defaultExpanded={false}
                        sx={{ 
                          mb: 1.5,
                          border: '1px solid',
                          borderColor: 'success.main',
                          bgcolor: 'success.50',
                          '&:before': { display: 'none' },
                          boxShadow: 'none'
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            '& .MuiAccordionSummary-content': {
                              alignItems: 'center',
                              gap: 1
                            }
                          }}
                        >
                          <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            Étape 3: Photos après intervention
                          </Typography>
                          <Box sx={{ ml: 'auto', mr: 2 }}>
                            <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                ✓ Toutes les étapes sont complétées ! Vous pouvez maintenant terminer l'intervention.
                              </Typography>
                            </Alert>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ pt: 1 }}>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                              Prendre des photos des pièces après l'intervention pour finaliser
                            </Typography>
                            
                            {/* Notes pour les photos après intervention - Afficher seulement si une note existe - AU-DESSUS des photos */}
                            {getStepNote('after_photos') && (
                              <Box sx={{ mt: 1.5, mb: 1.5 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                  Notes finales
                                </Typography>
                                <Box 
                                  sx={{ 
                                    p: 1, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                    {getStepNote('after_photos')}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Affichage des photos après intervention - Utilisation du composant réutilisable - EN DESSOUS des notes */}
                            {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after')}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ) : (
                      <Box 
                        sx={{ 
                          mb: 1.5, 
                          p: 1.5, 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                              Étape 3: Photos après intervention
                            </Typography>
                          </Box>
                          
                          {allRoomsValidated && (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PhotoCameraIcon />}
                                onClick={() => {
                                  setPhotoType('after');
                                  setPhotosDialogOpen(true);
                                }}
                              >
                                Ajouter photos après
                              </Button>
                              
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CommentIcon />}
                                onClick={() => handleOpenNotesDialog('after_photos')}
                              >
                                {getStepNote('after_photos') ? 'Modifier note' : 'Ajouter note'}
                              </Button>
                              
                              {/* Bouton Terminer - Toujours visible dans l'étape 3 mais désactivé si les conditions ne sont pas remplies */}
                              <Button
                                variant="contained"
                                color="success"
                                size="small"
                                startIcon={<DoneIcon />}
                                onClick={handleCompleteIntervention}
                                disabled={!areAllStepsCompleted() || completing || intervention.status === 'COMPLETED'}
                                sx={{ 
                                  ...(areAllStepsCompleted() && !completing && intervention.status !== 'COMPLETED' ? {
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                      '0%, 100%': { opacity: 1 },
                                      '50%': { opacity: 0.7 }
                                    }
                                  } : {})
                                }}
                              >
                                {completing ? 'Finalisation...' : (intervention.status === 'COMPLETED' ? 'Terminée' : 'Terminer')}
                              </Button>
                            </Box>
                          )}
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
                          Prendre des photos des pièces après l'intervention pour finaliser
                        </Typography>
                          
                          {allRoomsValidated ? (
                            <>
                              
                              {/* Notes pour les photos après intervention - Afficher seulement si une note existe - AU-DESSUS des photos */}
                              {getStepNote('after_photos') && (
                                <Box sx={{ ml: 4, mt: 1.5, mb: 1.5 }}>
                                  <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                    Notes finales
                                  </Typography>
                                  <Box 
                                    sx={{ 
                                      p: 1, 
                                      bgcolor: 'grey.50', 
                                      borderRadius: 1, 
                                      border: '1px solid',
                                      borderColor: 'divider'
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                      {getStepNote('after_photos')}
                                    </Typography>
                                  </Box>
                                </Box>
                              )}
                              
                              {/* Affichage des photos après intervention - Utilisation du composant réutilisable - EN DESSOUS des notes */}
                              <Box sx={{ ml: 4 }}>
                                {renderPhotosGallery(afterPhotos, 'Photos après intervention', 'after')}
                              </Box>
                            </>
                          ) : (
                            <Alert severity="info" sx={{ ml: 4, mt: 1, py: 0.5 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                ⓘ Cette étape sera disponible après la validation de toutes les pièces.
                              </Typography>
                            </Alert>
                          )}
                        </Box>
                      )
                    )}

                    {/* Étape 2: Validation par pièce */}
                    {/* Afficher seulement si l'étape 1 est validée */}
                    {inspectionComplete && (
                      allRoomsValidated ? (
                        <Accordion 
                        defaultExpanded={false}
                        sx={{ 
                          mb: 1.5,
                          border: '1px solid',
                          borderColor: 'success.main',
                          bgcolor: 'success.50',
                          '&:before': { display: 'none' },
                          boxShadow: 'none'
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            '& .MuiAccordionSummary-content': {
                              alignItems: 'center',
                              gap: 1
                            }
                          }}
                        >
                          <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            Étape 2: Validation des pièces ({validatedRooms.size}/{getTotalRooms()})
                          </Typography>
                          <Box sx={{ ml: 'auto', mr: 2 }}>
                            <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                ✓ Toutes les pièces sont validées ! Vous pouvez maintenant prendre les photos après intervention.
                              </Typography>
                            </Alert>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ pt: 1 }}>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                              Cliquez sur chaque pièce pour la valider après nettoyage
                            </Typography>
                            
                            {/* Afficher les pièces validées */}
                            {validatedRooms.size > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                  <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                  {validatedRooms.size} pièce(s) validée(s)
                                </Typography>
                                <Grid container spacing={1}>
                                  {getRoomNames().map((roomName, index) => (
                                    validatedRooms.has(index) && (
                                      <Grid item xs="auto" key={index}>
                                        <Button
                                          variant="contained"
                                          color="success"
                                          size="small"
                                          startIcon={<CheckCircleOutlineIcon />}
                                          disabled
                                          sx={{ 
                                            fontSize: '0.75rem',
                                            minWidth: 'auto',
                                            px: 2,
                                          }}
                                        >
                                          {roomName} ✓
                                        </Button>
                                      </Grid>
                                    )
                                  ))}
                                </Grid>
                              </Box>
                            )}
                            
                            {/* Notes pour la validation des pièces - Afficher seulement si une note existe */}
                            {getStepNote('rooms') && (
                              <Box sx={{ mt: 1.5, mb: 1.5 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                  Notes de validation
                                </Typography>
                                <Box 
                                  sx={{ 
                                    p: 1, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                    {getStepNote('rooms')}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ) : (
                      <Box 
                        sx={{ 
                          mb: 1.5, 
                          p: 1.5, 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                              Étape 2: Validation des pièces ({validatedRooms.size}/{getTotalRooms()})
                            </Typography>
                          </Box>
                          
                          {inspectionComplete && (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CommentIcon />}
                                onClick={() => handleOpenNotesDialog('rooms')}
                              >
                                {getStepNote('rooms') ? 'Modifier note' : 'Ajouter note'}
                              </Button>
                              
                              {/* Bouton "Valider cette étape" - Afficher seulement quand toutes les pièces sont validées */}
                              {validatedRooms.size === getTotalRooms() && !allRoomsValidated && (
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  startIcon={<CheckCircleOutlineIcon />}
                                  onClick={() => {
                                    setAllRoomsValidated(true);
                                    setCompletedSteps(prev => {
                                      const newSet = new Set(prev).add('rooms');
                                      saveCompletedSteps(newSet);
                                      return newSet;
                                    });
                                    const newProgress = calculateProgress();
                                    handleUpdateProgressValue(newProgress);
                                  }}
                                  sx={{ 
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                      '0%, 100%': { opacity: 1 },
                                      '50%': { opacity: 0.7 }
                                    }
                                  }}
                                >
                                  Valider cette étape
                                </Button>
                              )}
                            </Box>
                          )}
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
                          Cliquez sur chaque pièce pour la valider après nettoyage
                        </Typography>
                        
                        {inspectionComplete ? (
                          <>
                            
                            <Box sx={{ ml: 4, mt: 1 }}>
                              <Grid container spacing={1}>
                                {getRoomNames().map((roomName, index) => (
                                  <Grid item xs="auto" key={index}>
                                    <Button
                                      variant={validatedRooms.has(index) ? "contained" : "outlined"}
                                      color={validatedRooms.has(index) ? "success" : "primary"}
                                      size="small"
                                      startIcon={validatedRooms.has(index) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
                                      onClick={() => handleRoomValidation(index)}
                                      sx={{ 
                                        fontSize: '0.75rem',
                                        transition: 'all 0.3s ease',
                                        minWidth: 'auto',
                                        px: 2,
                                        '&:hover': {
                                          transform: 'scale(1.05)'
                                        }
                                      }}
                                      disabled={validatedRooms.has(index)}
                                    >
                                      {roomName}
                                      {validatedRooms.has(index) && ' ✓'}
                                    </Button>
                                  </Grid>
                                ))}
                              </Grid>
                            {validatedRooms.size > 0 && validatedRooms.size < getTotalRooms() && (
                              <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                  {validatedRooms.size} sur {getTotalRooms()} pièces validées. Continuez à valider les pièces restantes.
                                </Typography>
                              </Alert>
                            )}
                            
                            {/* Notes pour la validation des pièces - Afficher seulement si une note existe */}
                            {getStepNote('rooms') && (
                              <Box sx={{ mt: 1.5 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                  Notes de validation
                                </Typography>
                                <Box 
                                  sx={{ 
                                    p: 1, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                    {getStepNote('rooms')}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            </Box>
                          </>
                        ) : (
                          <Alert severity="info" sx={{ ml: 4, mt: 1, py: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                              ⓘ Cette étape sera disponible après la validation de l'inspection générale.
                            </Typography>
                          </Alert>
                        )}
                        </Box>
                      )
                    )}

                    {/* Étape 1: Inspection générale - LA PLUS ANCIENNE (en bas) */}
                    {/* Toujours afficher l'étape 1 */}
                    {inspectionComplete ? (
                      <Accordion
                        defaultExpanded={false}
                        sx={{ 
                          mb: 1.5,
                          border: '1px solid',
                          borderColor: 'success.main',
                          bgcolor: 'success.50',
                          '&:before': { display: 'none' },
                          boxShadow: 'none'
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            '& .MuiAccordionSummary-content': {
                              alignItems: 'center',
                              gap: 1
                            }
                          }}
                        >
                          <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            Étape 1: Inspection générale
                          </Typography>
                          <Box sx={{ ml: 'auto', mr: 2 }}>
                            <Alert severity="success" sx={{ py: 0.5, mb: 0 }}>
                              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                                ✓ Étape validée ! Vous pouvez maintenant passer à la validation des pièces.
                              </Typography>
                            </Alert>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Box sx={{ pt: 1 }}>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'block', mb: 1 }}>
                              Vérifier qu'il n'y a aucune casse et prendre des photos des pièces avant l'intervention
                            </Typography>
                            
                            {/* Notes pour l'étape d'inspection - Afficher seulement si une note existe - AU-DESSUS des photos */}
                            {getStepNote('inspection') && (
                              <Box sx={{ mb: 1.5 }}>
                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                                  Notes de l'inspection
                                </Typography>
                                <Box 
                                  sx={{ 
                                    p: 1, 
                                    bgcolor: 'grey.50', 
                                    borderRadius: 1, 
                                    border: '1px solid',
                                    borderColor: 'divider'
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                    {getStepNote('inspection')}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                            
                            {/* Affichage des photos avant intervention - Utilisation du composant réutilisable */}
                            {renderPhotosGallery(beforePhotos, 'Photos avant intervention', 'before')}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    ) : (
                      <Box 
                        sx={{ 
                          mb: 1.5, 
                          p: 1.5, 
                          borderRadius: 1, 
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper'
                        }}
                      >
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                              Étape 1: Inspection générale
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<PhotoCameraIcon />}
                              onClick={() => {
                                setPhotoType('before');
                                setPhotosDialogOpen(true);
                              }}
                            >
                              Ajouter photos avant
                            </Button>
                            
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<CommentIcon />}
                              onClick={() => handleOpenNotesDialog('inspection')}
                            >
                              {getStepNote('inspection') ? 'Modifier note' : 'Ajouter note'}
                            </Button>
                            
                            {beforePhotos.length > 0 && (
                              <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                startIcon={<CheckCircleOutlineIcon />}
                                onClick={() => {
                                  setInspectionComplete(true);
                                  setCompletedSteps(prev => new Set(prev).add('inspection'));
                                  const newProgress = calculateProgress();
                                  handleUpdateProgressValue(newProgress);
                                }}
                                sx={{ 
                                  animation: 'pulse 2s infinite',
                                  '@keyframes pulse': {
                                    '0%, 100%': { opacity: 1 },
                                    '50%': { opacity: 0.7 }
                                  }
                                }}
                              >
                                Valider cette étape
                              </Button>
                            )}
                          </Box>
                        </Box>
                        <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', ml: 4, display: 'block', mb: 1 }}>
                          Vérifier qu'il n'y a aucune casse et prendre des photos des pièces avant l'intervention
                        </Typography>
                        
                        {beforePhotos.length > 0 && (
                          <Box sx={{ ml: 4, mt: 1 }}>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              {beforePhotos.length} photo(s) ajoutée(s)
                            </Typography>
                          </Box>
                        )}
                        
                        {/* Notes pour l'étape d'inspection - Afficher seulement si une note existe */}
                        {getStepNote('inspection') && (
                          <Box sx={{ ml: 4, mt: 1.5 }}>
                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem', display: 'block', mb: 0.5 }}>
                              Notes de l'inspection
                            </Typography>
                            <Box 
                              sx={{ 
                                p: 1, 
                                bgcolor: 'grey.50', 
                                borderRadius: 1, 
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <Typography variant="caption" sx={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                                {getStepNote('inspection')}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}

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

                {/* Bouton pour rouvrir une intervention terminée */}
                {intervention && intervention.status === 'COMPLETED' && canStartOrUpdateIntervention() && (
                  <Box 
                    sx={{ 
                      mt: 3,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 2
                      }}
                    >
                      <Alert 
                        severity="info" 
                        sx={{ 
                          flex: { xs: '1 1 auto', sm: '1 1 60%' },
                          mb: { xs: 0, sm: 0 },
                          '& .MuiAlert-message': {
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center'
                          }
                        }}
                        icon={false}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              bgcolor: 'info.main',
                              flexShrink: 0
                            }}
                          >
                            <CheckCircleIcon 
                              sx={{ 
                                fontSize: 20, 
                                color: 'white'
                              }} 
                            />
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6, flex: 1 }}>
                            Cette intervention est terminée. Vous pouvez la rouvrir pour effectuer des modifications ou corriger des oublis.
                          </Typography>
                        </Box>
                      </Alert>
                      <Box 
                        sx={{ 
                          flex: { xs: '1 1 auto', sm: '0 0 auto' },
                          minWidth: { xs: '100%', sm: '200px' },
                          maxWidth: { xs: '100%', sm: '250px' }
                        }}
                      >
                        <Button
                          variant="contained"
                          color="warning"
                          startIcon={<ReplayIcon />}
                          fullWidth
                          onClick={handleReopenIntervention}
                          disabled={completing}
                          sx={{ 
                            py: 1.5,
                            fontWeight: 600,
                            textTransform: 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            '&:hover': {
                              boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                            }
                          }}
                        >
                          {completing ? 'Réouverture...' : 'Réouvrir l\'intervention'}
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Photos avant intervention - Afficher seulement si l'étape n'est pas validée */}
                {canUpdateProgress() && beforePhotos.length > 0 && !inspectionComplete && (
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
                      Photos avant intervention
                    </Typography>
                    <ImageList cols={3} gap={8}>
                      {beforePhotos.map((photoUrl, index) => (
                        <ImageListItem key={`before-${index}`}>
                          <img
                            src={photoUrl}
                            alt={`Photo avant ${index + 1}`}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </ImageListItem>
                      ))}
                    </ImageList>
                  </Box>
                )}


              </CardContent>
            </Card>
          </Grid>

          {/* Informations secondaires - Carte consolidée */}
          {showSidebar && (
            <Grid item xs={12} md={4}>
              <Card 
                sx={{ 
                  position: 'sticky',
                  top: 16,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  borderRadius: 2
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography 
                    variant="h6" 
                    fontWeight={700} 
                    gutterBottom 
                    sx={{ 
                      mb: 3,
                      fontSize: '1.1rem',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <AssignmentIcon sx={{ fontSize: 24 }} />
                    Informations de l'intervention
                  </Typography>

                  {/* Section Propriété */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <LocationIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        Propriété
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4 }}>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.9rem', mb: 0.5, color: 'text.primary' }}>
                        {intervention.propertyName}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
                        {intervention.propertyAddress}, {intervention.propertyCity} {intervention.propertyPostalCode}, {intervention.propertyCountry}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  {/* Section Personnes */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        Demandeur
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                        {intervention.requestorName}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  {/* Section Assignation */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      {intervention.assignedToType === 'team' ? (
                        <GroupIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      ) : (
                        <PersonIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      )}
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        Assignation
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4 }}>
                      <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.85rem', mb: 0.25, color: 'text.primary' }}>
                        {intervention.assignedToName}
                      </Typography>
                      <Chip 
                        label={intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          height: 20, 
                          fontSize: '0.65rem',
                          mt: 0.5
                        }} 
                      />
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  {/* Section Détails techniques */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <BuildIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        Détails techniques
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <ScheduleIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Box>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block' }}>
                            Durée estimée
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                            {formatDuration(intervention.estimatedDurationHours)}
                          </Typography>
                        </Box>
                      </Box>
                      {intervention.estimatedCost && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <PriorityHighIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block' }}>
                              Coût estimé
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                              {formatCurrency(intervention.estimatedCost)}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2.5 }} />

                  {/* Section Informations temporelles */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <ScheduleIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.9rem', color: 'text.primary' }}>
                        Informations temporelles
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4 }}>
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Créée le
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                          {formatDate(intervention.createdAt)}
                        </Typography>
                      </Box>
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Dernière mise à jour
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                          {intervention.updatedAt ? formatDate(intervention.updatedAt) : 'Aucune'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Terminée le
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.primary' }}>
                          {intervention.completedAt ? formatDate(intervention.completedAt) : 'Non terminée'}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
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

      {/* Dialogue pour ajouter/modifier les notes par étape */}
      <Dialog 
        open={notesDialogOpen} 
        onClose={() => {
          setNotesDialogOpen(false);
          setNotesValue('');
          setCurrentStepForNotes(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentStepForNotes === 'inspection' && 'Notes de l\'inspection générale'}
          {currentStepForNotes === 'rooms' && 'Notes de validation des pièces'}
          {currentStepForNotes === 'after_photos' && 'Notes finales (après intervention)'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              {currentStepForNotes === 'inspection' && 'Ajoutez des notes sur l\'état de l\'appartement avant l\'intervention (casses, problèmes détectés, etc.)'}
              {currentStepForNotes === 'rooms' && 'Ajoutez des notes sur la validation des pièces (problèmes rencontrés, points d\'attention, etc.)'}
              {currentStepForNotes === 'after_photos' && 'Ajoutez des notes finales sur l\'intervention (remarques, points à suivre, etc.)'}
            </Typography>
          </Alert>
          <TextField
            multiline
            rows={6}
            fullWidth
            value={notesValue}
            onChange={(e) => {
              setNotesValue(e.target.value);
              // Mettre à jour les notes localement pour la sauvegarde automatique
              if (currentStepForNotes) {
                const updatedStepNotes = { ...stepNotes };
                if (currentStepForNotes === 'rooms') {
                  if (!updatedStepNotes.rooms) {
                    updatedStepNotes.rooms = {};
                  }
                  updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: e.target.value };
                } else {
                  updatedStepNotes[currentStepForNotes] = e.target.value;
                }
                setStepNotes(updatedStepNotes);
              }
            }}
            placeholder={
              currentStepForNotes === 'inspection' 
                ? 'Ex: Aucune casse détectée, appartement en bon état général...'
                : currentStepForNotes === 'rooms'
                ? 'Ex: Toutes les pièces nettoyées, quelques taches difficiles dans la salle de bain...'
                : 'Ex: Intervention terminée avec succès, client satisfait...'
            }
            sx={{ mt: 1 }}
          />
          <Alert severity="info" sx={{ mt: 1, py: 0.5 }}>
            <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
              💾 Les modifications sont sauvegardées automatiquement après 2 secondes d'inactivité.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNotesDialogOpen(false);
            setNotesValue('');
            setCurrentStepForNotes(null);
          }}>
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
          <Box display="flex" alignItems="center" gap={1}>
            <PhotoCameraIcon color={photoType === 'before' ? 'primary' : 'success'} />
            <Typography variant="h6">
              Photos {photoType === 'before' ? 'avant' : 'après'} l'intervention
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert 
              severity={photoType === 'before' ? 'info' : 'success'} 
              sx={{ mb: 2 }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                {photoType === 'before' 
                  ? '📸 Prenez des photos de toutes les pièces pour vérifier qu\'il n\'y a aucune casse avant de commencer l\'intervention.'
                  : '📸 Prenez des photos de toutes les pièces après le nettoyage pour finaliser l\'intervention.'}
              </Typography>
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.85rem' }}>
              {photoType === 'before' 
                ? 'Ces photos serviront de référence pour l\'inspection générale.'
                : 'Ces photos confirmeront que l\'intervention est terminée.'}
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
