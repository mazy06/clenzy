import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '../../keycloak';
import { interventionsApi } from '../../services/api';
import { buildApiUrl } from '../../config/api';
import { interventionsKeys } from './useInterventionsList';
import {
  InterventionDetailsData,
  PropertyDetails,
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';
import { useTranslation } from '../../hooks/useTranslation';

interface UseInterventionProgressArgs {
  id: string | undefined;
  intervention: InterventionDetailsData | null;
  setIntervention: Dispatch<SetStateAction<InterventionDetailsData | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCompleting: Dispatch<SetStateAction<boolean>>;
  propertyDetails: PropertyDetails | null;
  initialLoadData: InitialLoadData | null;
  canUpdateProgressFn: boolean;
  /** Photo / step state coming from the photos hook */
  inspectionComplete: boolean;
  setInspectionComplete: Dispatch<SetStateAction<boolean>>;
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  setCompletedSteps: Dispatch<SetStateAction<Set<string>>>;
  saveCompletedSteps: (steps: Set<string>) => void;
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [validatedRooms, setValidatedRooms] = useState<Set<number>>(new Set());
  const [allRoomsValidated, setAllRoomsValidated] = useState(false);

  const isInitialLoadRef = useRef<boolean>(true);
  const isReopeningRef = useRef<boolean>(false);
  const hasHydratedRoomsRef = useRef<boolean>(false);

  // ------------------------------------------------------------------
  // Hydrate from initial load (once only)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialLoadData) return;
    // Only hydrate rooms on the FIRST initialLoadData.
    // Subsequent changes (from mutation onSuccess → queryClient.setQueryData)
    // must NOT overwrite user-initiated room selections to avoid race conditions
    // between updateRoomsMutation and updateProgressMutation running in parallel.
    if (!hasHydratedRoomsRef.current) {
      hasHydratedRoomsRef.current = true;
      setValidatedRooms(initialLoadData.validatedRooms);
      setAllRoomsValidated(initialLoadData.allRoomsValidated);
    }
    // Mark initial load done after a short delay
    const timeoutId = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [initialLoadData]);

  // ------------------------------------------------------------------
  // Room / progress helpers
  // ------------------------------------------------------------------

  const getTotalRooms = (): number => {
    if (!propertyDetails) return 0;
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    const livingRooms = propertyDetails.livingRooms ?? 1;
    const kitchens = propertyDetails.kitchens ?? 1;
    return bedrooms + bathrooms + livingRooms + kitchens;
  };

  const getRoomNames = (): string[] => {
    if (!propertyDetails) return [];
    const bedrooms = propertyDetails.bedroomCount || 0;
    const bathrooms = propertyDetails.bathroomCount || 0;
    const livingRooms = propertyDetails.livingRooms ?? 1;
    const kitchens = propertyDetails.kitchens ?? 1;
    const rooms: string[] = [];
    for (let i = 1; i <= bedrooms; i++) rooms.push(bedrooms === 1 ? t('interventions.roomNames.bedroom') : t('interventions.roomNames.bedroom_n', { n: i }));
    for (let i = 1; i <= bathrooms; i++) rooms.push(bathrooms === 1 ? t('interventions.roomNames.bathroom') : t('interventions.roomNames.bathroom_n', { n: i }));
    for (let i = 1; i <= livingRooms; i++) rooms.push(livingRooms === 1 ? t('interventions.roomNames.livingRoom') : t('interventions.roomNames.livingRoom_n', { n: i }));
    for (let i = 1; i <= kitchens; i++) rooms.push(kitchens === 1 ? t('interventions.roomNames.kitchen') : t('interventions.roomNames.kitchen_n', { n: i }));
    return rooms;
  };

  const calculateProgress = (): number => {
    // Une intervention terminée = 100% par définition
    if (intervention?.status === 'COMPLETED') return 100;

    const totalRooms = getTotalRooms();
    const totalSteps = 2 + totalRooms;
    let completed = 0;
    if (inspectionComplete && beforePhotos.length > 0) completed++;
    completed += validatedRooms.size;
    if (completedSteps.has('after_photos') && afterPhotos.length > 0) completed++;
    return totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
  };

  const areAllStepsCompleted = (): boolean => {
    if (!propertyDetails) return false;
    const totalRooms = getTotalRooms();
    const allRoomsDone = validatedRooms.size === totalRooms;
    const afterPhotosDone = completedSteps.has('after_photos') && afterPhotos.length > 0;
    return (
      inspectionComplete &&
      beforePhotos.length > 0 &&
      allRoomsDone &&
      afterPhotosDone
    );
  };

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  const updateProgressMutation = useMutation({
    mutationFn: ({ interventionId, progress }: { interventionId: number; progress: number }) =>
      interventionsApi.updateProgress(interventionId, progress),
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
    },
  });

  const updateRoomsMutation = useMutation({
    mutationFn: ({ interventionId, rooms }: { interventionId: number; rooms: string }) =>
      interventionsApi.updateValidatedRooms(interventionId, rooms),
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (interventionId: number) =>
      interventionsApi.reopen(interventionId),
    onSuccess: async (updated) => {
      // 1. Update local state first (before any query invalidation)
      setIntervention(updated);

      let shouldKeepRoomsValidated = false;
      if (updated.validatedRooms) {
        try {
          const parsedRooms = JSON.parse(updated.validatedRooms);
          if (Array.isArray(parsedRooms) && parsedRooms.length > 0) {
            setValidatedRooms(new Set(parsedRooms));

            // Check room completion synchronously using propertyDetails
            const totalRooms = getTotalRooms();
            if (parsedRooms.length === totalRooms && totalRooms > 0) {
              shouldKeepRoomsValidated = true;
              setAllRoomsValidated(true);
            }
          }
        } catch {
          // silent
        }
      }

      // 2. Clean after_photos step and persist BEFORE invalidating queries.
      //    This prevents a race condition where the query refetch returns old
      //    completedSteps (with after_photos still set), which would trigger
      //    re-hydration → progress recalc → 100% → auto-completion.
      const cleanedSteps = new Set(completedSteps);
      cleanedSteps.delete('after_photos');
      if (shouldKeepRoomsValidated) cleanedSteps.add('rooms');
      setCompletedSteps(cleanedSteps);

      // Persist synchronously using mutateAsync so it completes before refetch
      if (id && updated) {
        const json = JSON.stringify(Array.from(cleanedSteps));
        try {
          await interventionsApi.updateCompletedSteps(Number(id), json);
        } catch {
          // silent — best effort
        }
      }

      // 3. Update the detail query cache directly so navigation away/back
      //    serves the reopened version (not the stale COMPLETED one).
      //    Only invalidate list queries to refresh the list view.
      if (id) {
        queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
      }
      queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });

      setError(null);
      isInitialLoadRef.current = false;
      // Allow re-hydration on next navigation (rooms are already set above)
      hasHydratedRoomsRef.current = true;
    },
    onError: (err: Error) => {
      setError(err.message || t('interventions.detailErrors.reopening'));
    },
    onSettled: () => {
      // Delay the guard reset to let React process all state updates
      // from onSuccess before the auto-sync effect can fire
      setTimeout(() => {
        isReopeningRef.current = false;
      }, 1500);
    },
  });

  // ------------------------------------------------------------------
  // Server sync helpers
  // ------------------------------------------------------------------

  const handleUpdateProgressValue = async (progress: number) => {
    if (!id || !intervention) return;
    updateProgressMutation.mutate({ interventionId: Number(id), progress });
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleUpdateProgress = async () => {
    if (!id || !intervention) return;
    setUpdatingProgress(true);
    updateProgressMutation.mutate(
      { interventionId: Number(id), progress: progressValue },
      {
        onSuccess: () => {
          setProgressDialogOpen(false);
          setError(null);
        },
        onError: (err: Error) => {
          setError(err.message || t('interventions.detailErrors.updatingProgress'));
        },
        onSettled: () => setUpdatingProgress(false),
      },
    );
  };

  const handleRoomValidation = async (roomIndex: number) => {
    // Toggle: add if not present, remove if already validated
    setValidatedRooms(prev => {
      const newValidatedRooms = new Set(prev);
      if (newValidatedRooms.has(roomIndex)) {
        newValidatedRooms.delete(roomIndex);
      } else {
        newValidatedRooms.add(roomIndex);
      }

      const totalRooms = getTotalRooms();
      const allDone = newValidatedRooms.size === totalRooms && totalRooms > 0;
      setAllRoomsValidated(allDone);

      if (allDone) {
        const newSteps = new Set(completedSteps).add('rooms');
        setCompletedSteps(newSteps);
        saveCompletedSteps(newSteps);
      } else {
        // If a room was deselected, remove 'rooms' from completed steps
        const newSteps = new Set(completedSteps);
        newSteps.delete('rooms');
        setCompletedSteps(newSteps);
        saveCompletedSteps(newSteps);
      }

      if (id) {
        const arr = Array.from(newValidatedRooms).sort((a, b) => a - b);
        const json = JSON.stringify(arr);
        updateRoomsMutation.mutate({ interventionId: Number(id), rooms: json });
      }

      // Calculate progress using newValidatedRooms directly (not stale state)
      const totalSteps = 2 + totalRooms;
      let completedCount = 0;
      if (inspectionComplete && beforePhotos.length > 0) completedCount++;
      completedCount += newValidatedRooms.size;
      if (completedSteps.has('after_photos') && afterPhotos.length > 0) completedCount++;
      const newProgress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
      handleUpdateProgressValue(newProgress);

      return newValidatedRooms;
    });
  };

  const handleReopenIntervention = async () => {
    if (!id || !intervention) return;
    isReopeningRef.current = true;
    setCompleting(true);
    reopenMutation.mutate(Number(id), {
      onSettled: () => setCompleting(false),
    });
  };

  // ------------------------------------------------------------------
  // Auto-sync effects
  // ------------------------------------------------------------------

  // Auto-update progress when steps change (skip during reopen to avoid re-completing)
  useEffect(() => {
    if (isReopeningRef.current) return;
    if (isInitialLoadRef.current) return;
    if (!intervention || intervention.status !== 'IN_PROGRESS') return;
    if (!canUpdateProgressFn) return;
    // Don't auto-sync if property details haven't loaded — getTotalRooms() would
    // return 0, making progress 100% with just inspection + after photos
    if (!propertyDetails) return;

    const totalRooms = getTotalRooms();
    const totalSteps = 2 + totalRooms;
    let completed = 0;
    if (inspectionComplete && beforePhotos.length > 0) completed++;
    completed += validatedRooms.size;
    if (completedSteps.has('after_photos') && afterPhotos.length > 0) completed++;
    const newProgress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;

    const serverProgress = intervention.progressPercentage || 0;
    if (Math.abs(newProgress - serverProgress) > 1) {
      handleUpdateProgressValue(newProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionComplete, validatedRooms.size, afterPhotos.length, beforePhotos.length, completedSteps]);

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

  // Note: validated rooms are saved immediately in handleRoomValidation
  // No debounced auto-save needed (avoids duplicate API calls)

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
          keepalive: true,
          credentials: 'include',
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
          keepalive: true,
          credentials: 'include',
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
