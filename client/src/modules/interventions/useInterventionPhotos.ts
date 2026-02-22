import { useState, useEffect, type Dispatch, type SetStateAction, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api';
import { interventionsKeys } from './useInterventionsList';
import {
  InterventionDetailsData,
  parsePhotos
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';

interface UseInterventionPhotosArgs {
  id: string | undefined;
  intervention: InterventionDetailsData | null;
  setIntervention: Dispatch<SetStateAction<InterventionDetailsData | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  initialLoadData: InitialLoadData | null;
  /** Callback invoked when photos change — lets the progress hook react */
  onBeforePhotosChange?: (photos: string[], completedSteps: Set<string>) => void;
  onAfterPhotosChange?: (photos: string[], completedSteps: Set<string>) => void;
}

export function useInterventionPhotos({
  id,
  intervention,
  setIntervention,
  setError,
  initialLoadData,
  onBeforePhotosChange,
  onAfterPhotosChange,
}: UseInterventionPhotosArgs) {
  const queryClient = useQueryClient();

  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [inspectionComplete, setInspectionComplete] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // ------------------------------------------------------------------
  // Hydrate from initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialLoadData) return;
    setBeforePhotos(initialLoadData.beforePhotos);
    setAfterPhotos(initialLoadData.afterPhotos);
    setInspectionComplete(initialLoadData.inspectionComplete);
    setCompletedSteps(initialLoadData.completedSteps);
  }, [initialLoadData]);

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  const saveStepsMutation = useMutation({
    mutationFn: ({ interventionId, steps }: { interventionId: number; steps: string }) =>
      interventionsApi.updateCompletedSteps(interventionId, steps) as unknown as Promise<InterventionDetailsData>,
    onSuccess: (updated) => {
      setIntervention(updated);
    },
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: ({ interventionId, photos, type }: { interventionId: number; photos: File[]; type: 'before' | 'after' }) =>
      interventionsApi.uploadPhotos(interventionId, photos, type) as unknown as Promise<InterventionDetailsData>,
    onSuccess: (updated, variables) => {
      setIntervention(updated);
      queryClient.invalidateQueries({ queryKey: interventionsKeys.detail(id ?? '') });

      if (variables.type === 'before') {
        const newBeforePhotos = updated.beforePhotosUrls
          ? parsePhotos(updated.beforePhotosUrls)
          : [];
        setBeforePhotos(newBeforePhotos);
        if (newBeforePhotos.length > 0) {
          setInspectionComplete(true);
          setCompletedSteps(prev => {
            const newSet = new Set(prev).add('inspection');
            saveCompletedSteps(newSet);
            onBeforePhotosChange?.(newBeforePhotos, newSet);
            return newSet;
          });
        }
      } else {
        const newAfterPhotos = updated.afterPhotosUrls
          ? parsePhotos(updated.afterPhotosUrls)
          : [];
        setAfterPhotos(newAfterPhotos);
        if (newAfterPhotos.length > 0) {
          setCompletedSteps(prev => {
            const newSet = new Set(prev).add('after_photos');
            saveCompletedSteps(newSet);
            onAfterPhotosChange?.(newAfterPhotos, newSet);
            return newSet;
          });
        }
      }

      setPhotosDialogOpen(false);
      setSelectedPhotos([]);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Erreur lors de l\'ajout des photos');
    },
  });

  // ------------------------------------------------------------------
  // Save completed steps helper
  // ------------------------------------------------------------------
  const saveCompletedSteps = async (steps: Set<string>) => {
    if (!id || !intervention) return;
    const json = JSON.stringify(Array.from(steps));
    saveStepsMutation.mutate({ interventionId: Number(id), steps: json });
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handlePhotoUpload = async () => {
    if (!id || !intervention || selectedPhotos.length === 0) return;

    setUploadingPhotos(true);
    uploadPhotosMutation.mutate(
      { interventionId: Number(id), photos: selectedPhotos, type: photoType },
      { onSettled: () => setUploadingPhotos(false) },
    );
  };

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedPhotos(Array.from(event.target.files));
    }
  };

  const handleInspectionComplete = () => {
    if (beforePhotos.length > 0) {
      setCompletedSteps(prev => {
        const newSet = new Set(prev).add('inspection');
        saveCompletedSteps(newSet);
        onBeforePhotosChange?.(beforePhotos, newSet);
        return newSet;
      });
    }
  };

  const handleAfterPhotosComplete = () => {
    if (afterPhotos.length > 0) {
      setCompletedSteps(prev => {
        const newSet = new Set(prev).add('after_photos');
        onAfterPhotosChange?.(afterPhotos, newSet);
        return newSet;
      });
    }
  };

  return {
    photosDialogOpen,
    setPhotosDialogOpen,
    selectedPhotos,
    setSelectedPhotos,
    uploadingPhotos,
    photoType,
    setPhotoType,
    beforePhotos,
    setBeforePhotos,
    afterPhotos,
    setAfterPhotos,
    inspectionComplete,
    setInspectionComplete,
    completedSteps,
    setCompletedSteps,
    saveCompletedSteps,

    handlePhotoUpload,
    handlePhotoSelect,
    handleInspectionComplete,
    handleAfterPhotosComplete,
  };
}
