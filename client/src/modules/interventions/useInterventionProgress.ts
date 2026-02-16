import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { getAccessToken } from '../../services/storageService';
import { interventionsApi } from '../../services/api';
import { buildApiUrl } from '../../config/api';
import {
  InterventionDetailsData,
  PropertyDetails,
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';

interface UseInterventionProgressArgs {
  id: string | undefined;
  intervention: InterventionDetailsData | null;
  setIntervention: Dispatch<SetStateAction<InterventionDetailsData | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCompleting: Dispatch<SetStateAction<boolean>>;
  propertyDetails: PropertyDetails | null;
  initialLoadData: InitialLoadData | null;
  canUpdateProgressFn: () => boolean;
  /** Photo / step state coming from the photos hook */
  inspectionComplete: boolean;
  setInspectionComplete: Dispatch<SetStateAction<boolean>>;
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  setCompletedSteps: Dispatch<SetStateAction<Set<string>>>;
  saveCompletedSteps: (steps: Set<string>) => Promise<void>;
}

export function useInterventionProgress({
  id,
  intervention,
  setIntervention,
  setError,
  setCompleting,
  propertyDetails,
  initialLoadData,
  canUpdateProgressFn,
  inspectionComplete,
  setInspectionComplete,
  beforePhotos,
  afterPhotos,
  completedSteps,
  setCompletedSteps,
  saveCompletedSteps,
}: UseInterventionProgressArgs) {
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [validatedRooms, setValidatedRooms] = useState<Set<number>>(new Set());
  const [allRoomsValidated, setAllRoomsValidated] = useState(false);

  const isInitialLoadRef = useRef<boolean>(true);

  // ------------------------------------------------------------------
  // Hydrate from initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialLoadData) return;
    setValidatedRooms(initialLoadData.validatedRooms);
    setAllRoomsValidated(initialLoadData.allRoomsValidated);
    // Mark initial load done after a short delay
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1000);
  }, [initialLoadData]);

  // ------------------------------------------------------------------
  // Room / progress helpers
  // ------------------------------------------------------------------

  const getTotalRooms = (): number => {
    if (!propertyDetails) return 0;
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    return bedrooms + bathrooms + 2;
  };

  const getRoomNames = (): string[] => {
    if (!propertyDetails) return [];
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    const rooms: string[] = [];
    for (let i = 1; i <= bedrooms; i++) rooms.push(`Chambre ${i}`);
    for (let i = 1; i <= bathrooms; i++) rooms.push(`Salle de bain ${i}`);
    rooms.push('Salon');
    rooms.push('Cuisine');
    return rooms;
  };

  const calculateProgress = (): number => {
    const totalRooms = getTotalRooms();
    const totalSteps = 2 + totalRooms;
    let completed = 0;
    if (inspectionComplete && beforePhotos.length > 0) completed++;
    completed += validatedRooms.size;
    if (completedSteps.has('after_photos') && afterPhotos.length > 0) completed++;
    return totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
  };

  const areAllStepsCompleted = (): boolean => {
    const totalRooms = getTotalRooms();
    const allRoomsDone = validatedRooms.size === totalRooms;
    const afterPhotosDone =
      (completedSteps.has('after_photos') && afterPhotos.length > 0) || afterPhotos.length > 0;
    return (
      inspectionComplete &&
      beforePhotos.length > 0 &&
      allRoomsDone &&
      afterPhotosDone
    );
  };

  // ------------------------------------------------------------------
  // Server sync helpers
  // ------------------------------------------------------------------

  const handleUpdateProgressValue = async (progress: number) => {
    if (!id || !intervention) return;
    try {
      const updated = await interventionsApi.updateProgress(Number(id), progress) as unknown as InterventionDetailsData;
      setIntervention(updated);
    } catch {
      // silent
    }
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleUpdateProgress = async () => {
    if (!id || !intervention) return;
    setUpdatingProgress(true);
    try {
      const updated = await interventionsApi.updateProgress(Number(id), progressValue) as unknown as InterventionDetailsData;
      setIntervention(updated);
      setProgressDialogOpen(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise \u00e0 jour de la progression');
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleRoomValidation = async (roomIndex: number) => {
    const newValidatedRooms = new Set(validatedRooms);
    newValidatedRooms.add(roomIndex);
    setValidatedRooms(newValidatedRooms);

    const totalRooms = getTotalRooms();
    if (newValidatedRooms.size === totalRooms && totalRooms > 0) {
      setAllRoomsValidated(true);
    }

    if (id) {
      try {
        const arr = Array.from(newValidatedRooms).sort((a, b) => a - b);
        const json = JSON.stringify(arr);
        const updated = await interventionsApi.updateValidatedRooms(Number(id), json) as unknown as InterventionDetailsData;
        setIntervention(updated);
      } catch {
        // silent
      }
    }

    const newProgress = calculateProgress();
    handleUpdateProgressValue(newProgress);
  };

  const handleReopenIntervention = async () => {
    if (!id || !intervention) return;
    setCompleting(true);
    try {
      const updated = await interventionsApi.reopen(Number(id)) as unknown as InterventionDetailsData;
      setIntervention(updated);

      let shouldKeepRoomsValidated = false;
      if (updated.validatedRooms) {
        try {
          const parsedRooms = JSON.parse(updated.validatedRooms);
          if (Array.isArray(parsedRooms) && parsedRooms.length > 0) {
            setValidatedRooms(new Set(parsedRooms));
            setTimeout(() => {
              const totalRooms = getTotalRooms();
              if (parsedRooms.length === totalRooms && totalRooms > 0) {
                setAllRoomsValidated(true);
              }
            }, 200);

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
        } catch {
          // silent
        }
      }

      setCompletedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete('after_photos');
        if (shouldKeepRoomsValidated) newSet.add('rooms');
        return newSet;
      });

      setTimeout(() => {
        setTimeout(() => {
          const newProgress = calculateProgress();
          handleUpdateProgressValue(newProgress);
        }, 300);
      }, 200);

      setError(null);
      isInitialLoadRef.current = false;
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la r\u00e9ouverture de l\'intervention');
    } finally {
      setCompleting(false);
    }
  };

  // ------------------------------------------------------------------
  // Auto-sync effects
  // ------------------------------------------------------------------

  // Auto-update progress when steps change
  useEffect(() => {
    if (intervention && canUpdateProgressFn() && intervention.status === 'IN_PROGRESS') {
      const newProgress = calculateProgress();
      if (Math.abs(newProgress - (intervention.progressPercentage || 0)) > 1) {
        handleUpdateProgressValue(newProgress);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionComplete, validatedRooms.size, afterPhotos.length, beforePhotos.length]);

  // Auto-save completed steps
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (completedSteps.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      const timeoutId = setTimeout(() => {
        saveCompletedSteps(completedSteps);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps]);

  // Auto-save validated rooms
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (validatedRooms.size > 0 && id && intervention && intervention.status === 'IN_PROGRESS') {
      const timeoutId = setTimeout(() => {
        const arr = Array.from(validatedRooms).sort((a, b) => a - b);
        const json = JSON.stringify(arr);
        interventionsApi.updateValidatedRooms(Number(id), json)
          .then(updated => {
            setIntervention(updated as unknown as InterventionDetailsData);
          })
          .catch(() => { /* silent */ });
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedRooms]);

  // Save before unload — completed steps + validated rooms
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (completedSteps.size > 0 && id && intervention) {
        const json = JSON.stringify(Array.from(completedSteps));
        const formData = new URLSearchParams();
        formData.append('completedSteps', json);
        fetch(buildApiUrl(`/interventions/${id}/completed-steps`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(() => { /* silent */ });
      }

      if (validatedRooms.size > 0 && id && intervention) {
        const arr = Array.from(validatedRooms).sort((a, b) => a - b);
        const json = JSON.stringify(arr);
        const formData = new URLSearchParams();
        formData.append('validatedRooms', json);
        fetch(buildApiUrl(`/interventions/${id}/validated-rooms`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData.toString(),
          keepalive: true
        }).catch(() => { /* silent */ });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedSteps, validatedRooms, id, intervention]);

  return {
    updatingProgress,
    progressDialogOpen,
    setProgressDialogOpen,
    progressValue,
    setProgressValue,
    validatedRooms,
    allRoomsValidated,
    setAllRoomsValidated,

    // Handlers
    handleUpdateProgress,
    handleRoomValidation,
    handleReopenIntervention,
    handleUpdateProgressValue,

    // Computed
    calculateProgress,
    areAllStepsCompleted,
    getTotalRooms,
    getRoomNames,
  };
}
