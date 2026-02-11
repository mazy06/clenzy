import { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '../../services/storageService';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi, propertiesApi } from '../../services/api';
import { buildApiUrl } from '../../config/api';
import {
  InterventionDetailsData,
  PropertyDetails,
  StepNotes,
  StepType,
  parsePhotos
} from './interventionUtils';

export function useInterventionDetails(id: string | undefined) {
  const { user, hasPermissionAsync, isTechnician, isHousekeeper, isSupervisor } = useAuth();

  // State hooks
  const [intervention, setIntervention] = useState<InterventionDetailsData | null>(null);
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
  const [currentStepForNotes, setCurrentStepForNotes] = useState<StepType | null>(null);

  // Notes par etape
  const [stepNotes, setStepNotes] = useState<StepNotes>({});
  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [showSidebar, setShowSidebar] = useState(true);

  // Etats pour le systeme d'etapes de progression
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [validatedRooms, setValidatedRooms] = useState<Set<number>>(new Set());
  const [inspectionComplete, setInspectionComplete] = useState(false);
  const [allRoomsValidated, setAllRoomsValidated] = useState(false);

  // Permission states
  const [canViewInterventions, setCanViewInterventions] = useState(false);
  const [canEditInterventions, setCanEditInterventions] = useState(false);

  // References pour les timers de sauvegarde automatique
  const notesSaveTimeoutRef = useRef<number | null>(null);
  const lastSavedNotesRef = useRef<string>('');
  const isInitialLoadRef = useRef<boolean>(true);

  // ========================================================================
  // Utility / computed functions
  // ========================================================================

  // Calculer le nombre total de pieces interieures
  const getTotalRooms = (): number => {
    if (!propertyDetails) return 0;
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    // On ajoute 2 pour les pieces communes (salon + cuisine)
    return bedrooms + bathrooms + 2;
  };

  // Obtenir la liste des noms de pieces
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

    // Ajouter les pieces communes
    rooms.push('Salon');
    rooms.push('Cuisine');

    return rooms;
  };

  // Calculer la progression basee sur les etapes completees
  const calculateProgress = (): number => {
    const totalRooms = getTotalRooms();
    const totalSteps = 2 + totalRooms; // Inspection (1) + Validation pieces (N) + Photos apres (1)
    let completed = 0;

    // Etape 1: Inspection generale (photos avant)
    if (inspectionComplete && beforePhotos.length > 0) {
      completed++;
    }

    // Etape 2: Validation par piece
    completed += validatedRooms.size;

    // Etape 3: Photos apres intervention
    if (completedSteps.has('after_photos') && afterPhotos.length > 0) {
      completed++;
    }

    return totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
  };

  // Verifier si toutes les etapes sont completees
  const areAllStepsCompleted = (): boolean => {
    const totalRooms = getTotalRooms();
    const allRoomsDone = validatedRooms.size === totalRooms;
    // Accepter l'etape 3 comme completee si :
    // 1. Elle est explicitement marquee comme validee ET il y a des photos
    // 2. OU simplement s'il y a des photos (pour permettre la finalisation apres reouverture)
    const afterPhotosDone = (completedSteps.has('after_photos') && afterPhotos.length > 0) || afterPhotos.length > 0;

    const result = (
      inspectionComplete &&
      beforePhotos.length > 0 &&
      allRoomsDone &&
      afterPhotosDone
    );

    return result;
  };

  // Verifier si l'utilisateur peut demarrer/mettre a jour cette intervention
  const canStartOrUpdateIntervention = (): boolean => {
    if (!intervention) return false;
    // Verifier si l'utilisateur est TECHNICIAN, HOUSEKEEPER ou SUPERVISOR
    const isOperationalUser = isTechnician() || isHousekeeper() || isSupervisor();
    if (!isOperationalUser) return false;

    // Verifier que l'intervention est assignee (individuellement ou par equipe)
    return intervention.assignedToId !== undefined && intervention.assignedToId !== null;
  };

  // Verifier si l'intervention peut etre demarree
  const canStartIntervention = (): boolean => {
    if (!intervention) return false;
    return canStartOrUpdateIntervention() && intervention.status === 'PENDING';
  };

  // Verifier si l'intervention peut avoir sa progression mise a jour
  const canUpdateProgress = (): boolean => {
    if (!intervention) return false;
    // Permettre les modifications si l'intervention est en cours OU si elle a ete rouverte
    return canStartOrUpdateIntervention() && intervention.status === 'IN_PROGRESS';
  };

  // Logique metier pour la modification
  const canModifyIntervention = (): boolean => {
    if (canEditInterventions) return true;

    if (!intervention) return false;

    // Les equipes peuvent modifier les interventions assignees
    if (intervention.assignedToType === 'team') {
      return true;
    }

    // Les utilisateurs peuvent modifier les interventions qui leur sont assignees
    if (intervention.assignedToType === 'user') {
      return String(user?.id) === String(intervention.assignedToId);
    }

    return false;
  };

  // Fonction pour obtenir la note d'une etape
  const getStepNote = (step: StepType): string => {
    if (step === 'rooms') {
      if (stepNotes.rooms && 'general' in stepNotes.rooms) {
        return stepNotes.rooms.general || '';
      }
      return '';
    }
    const note = stepNotes[step];
    return typeof note === 'string' ? note : '';
  };

  // ========================================================================
  // Internal save helpers
  // ========================================================================

  // Fonction pour sauvegarder les etapes completees en base de donnees
  const saveCompletedSteps = async (steps: Set<string>) => {
    if (!id || !intervention) return;

    try {
      const completedStepsArray = Array.from(steps);
      const completedStepsJson = JSON.stringify(completedStepsArray);

      const updatedIntervention = await interventionsApi.updateCompletedSteps(Number(id), completedStepsJson) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);
    } catch (err) {
      // silent
    }
  };

  // Fonction pour sauvegarder les notes automatiquement (avec debounce)
  const saveNotesAuto = async (notesToSave: StepNotes, immediate: boolean = false) => {
    if (!id || !intervention) return;

    // Annuler le timer precedent si on n'est pas en mode immediat
    if (notesSaveTimeoutRef.current && !immediate) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    const saveNotes = async () => {
      try {
        const notesJson = JSON.stringify(notesToSave);

        // Eviter de sauvegarder si rien n'a change
        if (notesJson === lastSavedNotesRef.current) {
          return;
        }

        const updatedIntervention = await interventionsApi.updateNotes(Number(id), notesJson) as unknown as InterventionDetailsData;
        setIntervention(updatedIntervention);
        lastSavedNotesRef.current = notesJson;
      } catch (err) {
        // silent
      }
    };

    if (immediate) {
      await saveNotes();
    } else {
      // Debounce: sauvegarder apres 2 secondes d'inactivite
      notesSaveTimeoutRef.current = setTimeout(saveNotes, 2000) as unknown as number;
    }
  };

  // Mettre a jour la progression sur le serveur
  const handleUpdateProgressValue = async (progress: number) => {
    if (!id || !intervention) return;

    try {
      const updatedIntervention = await interventionsApi.updateProgress(Number(id), progress) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);
    } catch (err) {
      // silent
    }
  };

  // ========================================================================
  // Handler functions
  // ========================================================================

  // Fonction pour demarrer une intervention
  const handleStartIntervention = async () => {
    if (!id || !intervention) return;

    setStarting(true);
    try {
      const updatedIntervention = await interventionsApi.start(Number(id)) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du d\u00e9marrage de l\'intervention');
    } finally {
      setStarting(false);
    }
  };

  // Fonction pour mettre a jour la progression
  const handleUpdateProgress = async () => {
    if (!id || !intervention) return;

    setUpdatingProgress(true);
    try {
      const updatedIntervention = await interventionsApi.updateProgress(Number(id), progressValue) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);
      setProgressDialogOpen(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise \u00e0 jour de la progression');
    } finally {
      setUpdatingProgress(false);
    }
  };

  // Fonction pour terminer une intervention
  const handleCompleteIntervention = async () => {
    if (!id || !intervention) return;

    setCompleting(true);
    try {
      // Mettre la progression a 100% et le statut a COMPLETED
      const updatedIntervention = await interventionsApi.updateProgress(Number(id), 100) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la finalisation de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // Fonction pour rouvrir une intervention terminee
  const handleReopenIntervention = async () => {
    if (!id || !intervention) return;

    setCompleting(true);
    try {
      const updatedIntervention = await interventionsApi.reopen(Number(id)) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);

      // Restaurer d'abord l'etat des pieces validees
      let shouldKeepRoomsValidated = false;
      if (updatedIntervention.validatedRooms) {
        try {
          const parsedRooms = JSON.parse(updatedIntervention.validatedRooms);
          if (Array.isArray(parsedRooms) && parsedRooms.length > 0) {
            // Restaurer validatedRooms en premier
            setValidatedRooms(new Set(parsedRooms));

            // Verifier si toutes les pieces sont validees
            // Utiliser setTimeout pour s'assurer que propertyDetails est charge
            setTimeout(() => {
              const totalRooms = getTotalRooms();
              if (parsedRooms.length === totalRooms && totalRooms > 0) {
                setAllRoomsValidated(true);
              }
            }, 200);

            // Verifier immediatement si on doit garder l'etape 2 validee
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
          // silent
        }
      }

      // Reinitialiser UNIQUEMENT l'etat de l'etape 3 (after_photos) pour permettre a nouveau la validation
      // L'etape 2 (rooms) doit rester validee si toutes les pieces etaient validees
      setCompletedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete('after_photos'); // Retirer seulement l'etape 3
        // Garder 'rooms' si toutes les pieces sont validees
        if (shouldKeepRoomsValidated) {
          newSet.add('rooms');
        }
        return newSet;
      });

      // Recalculer la progression sans l'etape 3
      // Utiliser plusieurs setTimeout pour s'assurer que tous les etats sont bien restaures
      // Premier setTimeout pour restaurer les etats
      setTimeout(() => {
        // Deuxieme setTimeout pour recalculer apres que tous les etats soient mis a jour
        setTimeout(() => {
          const newProgress = calculateProgress();
          // Forcer la mise a jour de la progression meme si la difference est petite
          // car on sait que la progression doit etre recalculee apres reouverture
          // La progression devrait etre inferieure a 100% car l'etape 3 est reinitialisee
          if (newProgress < 100) {
            handleUpdateProgressValue(newProgress);
          } else {
            // Si la progression est toujours a 100%, forcer quand meme la mise a jour
            // car cela signifie qu'il y a un probleme de coherence
            handleUpdateProgressValue(newProgress);
          }
        }, 300);
      }, 200);

      setError(null);
      // Reinitialiser le flag de chargement initial pour permettre la sauvegarde automatique
      isInitialLoadRef.current = false;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la r\u00e9ouverture de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // Fonction pour ouvrir le dialogue de notes pour une etape specifique
  const handleOpenNotesDialog = (step: StepType, roomIndex?: number) => {
    setCurrentStepForNotes(step);
    if (step === 'rooms' && roomIndex !== undefined) {
      // Pour les notes de piece, recuperer la note existante pour cette piece
      const rooms = stepNotes.rooms;
      const roomNote = (rooms && typeof rooms === 'object' && roomIndex in rooms) ? rooms[roomIndex] : '';
      setNotesValue(roomNote as string);
    } else if (step === 'rooms') {
      // Pour les notes generales de pieces, recuperer la note generale
      const rooms = stepNotes.rooms;
      const generalNote = (rooms && typeof rooms === 'object' && 'general' in rooms) ? rooms.general || '' : '';
      setNotesValue(generalNote);
    } else {
      // Pour les autres etapes, recuperer la note existante
      const existingNote = stepNotes[step] || '';
      setNotesValue(existingNote as string);
    }
    setNotesDialogOpen(true);
  };

  // Fonction pour mettre a jour les notes d'une etape specifique
  const handleUpdateNotes = async () => {
    if (!id || !intervention || !currentStepForNotes) return;

    setUpdatingNotes(true);
    try {
      // Mettre a jour les notes par etape
      const updatedStepNotes = { ...stepNotes };

      if (currentStepForNotes === 'rooms') {
        if (!updatedStepNotes.rooms) {
          updatedStepNotes.rooms = {};
        }
        updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: notesValue };
      } else {
        updatedStepNotes[currentStepForNotes] = notesValue;
      }

      // Sauvegarder immediatement
      await saveNotesAuto(updatedStepNotes, true);

      setStepNotes(updatedStepNotes);
      setNotesDialogOpen(false);
      setNotesValue('');
      setCurrentStepForNotes(null);
      setError(null);
    } catch (err) {
      setError('Erreur lors de la mise \u00e0 jour des notes');
    } finally {
      setUpdatingNotes(false);
    }
  };

  // Fonction pour gerer l'upload de photos
  const handlePhotoUpload = async () => {
    if (!id || !intervention || selectedPhotos.length === 0) return;

    setUploadingPhotos(true);
    try {
      const updatedIntervention = await interventionsApi.uploadPhotos(Number(id), selectedPhotos, photoType) as unknown as InterventionDetailsData;
      setIntervention(updatedIntervention);

      // Utiliser les champs separes beforePhotosUrls et afterPhotosUrls
      if (photoType === 'before') {
        const newBeforePhotos = updatedIntervention.beforePhotosUrls
          ? parsePhotos(updatedIntervention.beforePhotosUrls)
          : [];
        setBeforePhotos(newBeforePhotos);
        // Si des photos avant sont ajoutees, marquer l'inspection comme complete
        if (newBeforePhotos.length > 0) {
          setInspectionComplete(true);
          setCompletedSteps(prev => {
            const newSet = new Set(prev).add('inspection');
            saveCompletedSteps(newSet);
            return newSet;
          });
        }
      } else {
        const newAfterPhotos = updatedIntervention.afterPhotosUrls
          ? parsePhotos(updatedIntervention.afterPhotosUrls)
          : [];
        setAfterPhotos(newAfterPhotos);
        // Si des photos apres sont ajoutees, marquer l'etape comme complete
        if (newAfterPhotos.length > 0) {
          setCompletedSteps(prev => {
            const newSet = new Set(prev).add('after_photos');
            saveCompletedSteps(newSet);
            return newSet;
          });
          // Mettre a jour la progression
          const newProgress = calculateProgress();
          handleUpdateProgressValue(newProgress);
        }
      }

      setPhotosDialogOpen(false);
      setSelectedPhotos([]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'ajout des photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Fonction pour gerer la selection de photos
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedPhotos(Array.from(event.target.files));
    }
  };

  // Gerer l'etape d'inspection generale
  const handleInspectionComplete = () => {
    if (beforePhotos.length > 0) {
      setCompletedSteps(prev => {
        const newSet = new Set(prev).add('inspection');
        saveCompletedSteps(newSet);
        return newSet;
      });
      // Mettre a jour la progression
      const newProgress = calculateProgress();
      handleUpdateProgressValue(newProgress);
    }
  };

  // Gerer la validation d'une piece
  const handleRoomValidation = async (roomIndex: number) => {
    const newValidatedRooms = new Set(validatedRooms);
    newValidatedRooms.add(roomIndex);
    setValidatedRooms(newValidatedRooms);

    // Verifier si toutes les pieces sont validees
    const totalRooms = getTotalRooms();
    if (newValidatedRooms.size === totalRooms && totalRooms > 0) {
      setAllRoomsValidated(true);
    }

    // Sauvegarder en base de donnees
    if (id) {
      try {
        const validatedRoomsArray = Array.from(newValidatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);

        const updatedIntervention = await interventionsApi.updateValidatedRooms(Number(id), validatedRoomsJson) as unknown as InterventionDetailsData;
        setIntervention(updatedIntervention);
      } catch (err) {
        // silent
      }
    }

    // Mettre a jour la progression
    const newProgress = calculateProgress();
    handleUpdateProgressValue(newProgress);
  };

  // Gerer les photos apres intervention
  const handleAfterPhotosComplete = () => {
    if (afterPhotos.length > 0) {
      setCompletedSteps(prev => new Set(prev).add('after_photos'));
      // Mettre a jour la progression
      const newProgress = calculateProgress();
      handleUpdateProgressValue(newProgress);
    }
  };

  // ========================================================================
  // useEffect hooks
  // ========================================================================

  // Load intervention data
  useEffect(() => {
    const loadIntervention = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Appel API reel
        const data = await interventionsApi.getById(Number(id)) as unknown as InterventionDetailsData;
        setIntervention(data);
        // Initialiser les notes si elles existent
        if (data.notes) {
          setNotesValue(data.notes);
        }

        // Charger les details de la propriete pour obtenir le nombre de pieces
        if (data.propertyId) {
          try {
            const propertyData = await propertiesApi.getById(data.propertyId) as any;
            setPropertyDetails(propertyData);

            // Apres avoir charge propertyDetails, verifier si toutes les pieces sont validees
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
                    // Marquer l'etape 2 comme completee si toutes les pieces sont validees
                    setCompletedSteps(prev => new Set(prev).add('rooms'));
                  }
                }
              } catch (err) {
                // silent
              }
            }
          } catch (err) {
            // silent
          }
        }

        // Charger les etapes completees depuis la base de donnees
        if (data.completedSteps) {
          try {
            const parsedSteps = JSON.parse(data.completedSteps);
            if (Array.isArray(parsedSteps)) {
              setCompletedSteps(new Set(parsedSteps));
              // Mettre a jour inspectionComplete si l'etape inspection est completee
              if (parsedSteps.includes('inspection')) {
                setInspectionComplete(true);
              }
            }
          } catch (err) {
            // silent
          }
        }

        // Initialiser les photos existantes en utilisant les champs separes
        if (data.beforePhotosUrls) {
          const parsedBeforePhotos = parsePhotos(data.beforePhotosUrls);
          setBeforePhotos(parsedBeforePhotos);
          // Si des photos avant existent, marquer l'inspection comme complete
          if (parsedBeforePhotos.length > 0) {
            setInspectionComplete(true);
            // Ajouter 'inspection' aux etapes completees si pas deja present
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
          const parsedAfterPhotos = parsePhotos(data.afterPhotosUrls);
          setAfterPhotos(parsedAfterPhotos);
          // Si des photos apres existent, marquer l'etape comme complete
          if (parsedAfterPhotos.length > 0) {
            // Ajouter 'after_photos' aux etapes completees si pas deja present
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

        // Parser les notes par etape depuis le champ notes (format JSON)
        if (data.notes) {
          try {
            const parsedNotes = JSON.parse(data.notes);
            if (typeof parsedNotes === 'object' && parsedNotes !== null) {
              setStepNotes(parsedNotes);
              // Marquer comme derniere version sauvegardee
              lastSavedNotesRef.current = data.notes;
            } else {
              // Si ce n'est pas un JSON valide, considerer comme note globale (ancien format)
              const initialNotes: StepNotes = { inspection: data.notes };
              setStepNotes(initialNotes);
              lastSavedNotesRef.current = JSON.stringify(initialNotes);
            }
          } catch {
            // Si le parsing echoue, considerer comme note globale (ancien format)
            const initialNotes: StepNotes = { inspection: data.notes };
            setStepNotes(initialNotes);
            lastSavedNotesRef.current = JSON.stringify(initialNotes);
          }
        }

        // Marquer que le chargement initial est termine
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 1000);

        // Charger les pieces validees depuis la base de donnees
        if (data.validatedRooms) {
          try {
            const parsedRooms = JSON.parse(data.validatedRooms);
            if (Array.isArray(parsedRooms)) {
              setValidatedRooms(new Set(parsedRooms));
              // Verifier si toutes les pieces sont validees (apres avoir charge propertyDetails)
              if (propertyDetails) {
                const totalRooms = (propertyDetails.bedrooms || 0) +
                  (propertyDetails.bathrooms || 0) +
                  (propertyDetails.livingRooms || 0) +
                  (propertyDetails.kitchens || 0);
                if (parsedRooms.length === totalRooms && totalRooms > 0) {
                  setAllRoomsValidated(true);
                  // Marquer l'etape 2 comme completee si toutes les pieces sont validees
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
            // silent
          }
        }
      } catch (err) {
        setError('Erreur lors du chargement de l\'intervention');
      } finally {
        setLoading(false);
      }
    };

    loadIntervention();
  }, [id]);

  // Permission checks - canViewInterventions
  useEffect(() => {
    const checkPermissions = async () => {
      const canViewInterventionsPermission = await hasPermissionAsync('interventions:view');
      setCanViewInterventions(canViewInterventionsPermission);
    };

    checkPermissions();
  }, [hasPermissionAsync]);

  // Permission checks - canEditInterventions
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditInterventionsPermission = await hasPermissionAsync('interventions:edit');
      setCanEditInterventions(canEditInterventionsPermission);
    };

    checkPermissions();
  }, [hasPermissionAsync]);

  // Effet pour mettre a jour la progression automatiquement quand les etapes changent
  useEffect(() => {
    if (intervention && canUpdateProgress() && intervention.status === 'IN_PROGRESS') {
      const newProgress = calculateProgress();
      // Ne mettre a jour que si la progression a vraiment change (eviter les boucles)
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
      // Ne sauvegarder que si les notes ont vraiment change
      if (notesJson !== lastSavedNotesRef.current) {
        saveNotesAuto(stepNotes, false);
      }
    }

    // Cleanup: sauvegarder immediatement avant de quitter
    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
      // Sauvegarder immediatement si on quitte avec des modifications non sauvegardees
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          saveNotesAuto(stepNotes, true);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes]);

  // Effet pour sauvegarder automatiquement les etapes completees lors des changements
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoadRef.current) {
      return;
    }

    if (completedSteps.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      // Debounce pour eviter trop de requetes
      const timeoutId = setTimeout(() => {
        saveCompletedSteps(completedSteps);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps]);

  // Effet pour sauvegarder automatiquement les pieces validees lors des changements
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoadRef.current) {
      return;
    }

    if (validatedRooms.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      // Debounce pour eviter trop de requetes
      const timeoutId = setTimeout(() => {
        const validatedRoomsArray = Array.from(validatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);

        interventionsApi.updateValidatedRooms(Number(id), validatedRoomsJson)
          .then(updatedIntervention => {
            setIntervention(updatedIntervention as unknown as InterventionDetailsData);
          })
          .catch(() => {
            // silent
          });
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedRooms]);

  // Effet pour sauvegarder toutes les modifications avant de quitter la page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Sauvegarder les notes si elles ont change
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          // Sauvegarder de maniere synchrone (navigator.sendBeacon ou fetch avec keepalive)
          const formData = new URLSearchParams();
          formData.append('notes', notesJson);

          // Note: keepalive fetch is required for beforeunload - cannot use apiClient
          const token = getAccessToken();

          fetch(buildApiUrl(`/interventions/${id}/notes`), {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            keepalive: true
          }).catch(err => {
            // silent
          });
        }
      }

      // Sauvegarder les etapes completees
      if (completedSteps.size > 0 && id && intervention) {
        const completedStepsArray = Array.from(completedSteps);
        const completedStepsJson = JSON.stringify(completedStepsArray);
        const formData = new URLSearchParams();
        formData.append('completedSteps', completedStepsJson);

        fetch(buildApiUrl(`/interventions/${id}/completed-steps`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(err => {
          // silent
        });
      }

      // Sauvegarder les pieces validees
      if (validatedRooms.size > 0 && id && intervention) {
        const validatedRoomsArray = Array.from(validatedRooms).sort((a, b) => a - b);
        const validatedRoomsJson = JSON.stringify(validatedRoomsArray);
        const formData = new URLSearchParams();
        formData.append('validatedRooms', validatedRoomsJson);

        fetch(buildApiUrl(`/interventions/${id}/validated-rooms`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(err => {
          // silent
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes, completedSteps, validatedRooms, id, intervention]);

  // ========================================================================
  // Return all state & handlers
  // ========================================================================

  return {
    // Auth-derived values
    user,
    isTechnician,
    isHousekeeper,
    isSupervisor,

    // State
    intervention,
    loading,
    error,
    starting,
    completing,
    updatingProgress,
    progressDialogOpen,
    progressValue,
    notesDialogOpen,
    notesValue,
    updatingNotes,
    currentStepForNotes,
    stepNotes,
    photosDialogOpen,
    selectedPhotos,
    uploadingPhotos,
    photoType,
    showSidebar,
    propertyDetails,
    completedSteps,
    beforePhotos,
    afterPhotos,
    validatedRooms,
    inspectionComplete,
    allRoomsValidated,
    canViewInterventions,
    canEditInterventions,

    // Setters
    setProgressDialogOpen,
    setProgressValue,
    setNotesDialogOpen,
    setNotesValue,
    setCurrentStepForNotes,
    setPhotosDialogOpen,
    setSelectedPhotos,
    setPhotoType,
    setShowSidebar,
    setError,
    setCompletedSteps,
    setAllRoomsValidated,
    setInspectionComplete,
    saveCompletedSteps,

    // Handler functions
    handleStartIntervention,
    handleUpdateProgress,
    handleCompleteIntervention,
    handleReopenIntervention,
    handleOpenNotesDialog,
    handleUpdateNotes,
    handlePhotoUpload,
    handlePhotoSelect,
    handleInspectionComplete,
    handleRoomValidation,
    handleAfterPhotosComplete,
    handleUpdateProgressValue,

    // Computed values
    canStartOrUpdateIntervention,
    canStartIntervention,
    canUpdateProgress,
    canModifyIntervention,
    areAllStepsCompleted,
    calculateProgress,
    getTotalRooms,
    getRoomNames,
    getStepNote,
  };
}
