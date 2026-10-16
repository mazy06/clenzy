import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { interventionsApi, getBaitlyRoomInspection, type BaitlyRoomInspection } from '../../services/api/interventionsApi';
import { interventionsKeys } from './useInterventionsList';
import { interventionExecutionScope } from './interventionExecutionScope';
import {
  InterventionDetailsData,
  parsePhotos
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';
import { useTranslation } from '../../hooks/useTranslation';

/** Parse a JSON array of numbers, e.g. "[1,2,3]" → [1,2,3] */
const parsePhotoIds = (json: string | undefined): number[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
};

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [photosDialogOpen, setPhotosDialogOpen] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [inspectionRoom, setInspectionRoom] = useState<string | null>(null);
  const cleaning = intervention?.type?.toUpperCase().includes('CLEANING') === true;
  const roomKey = ['baitly-room-inspection', id];
  const roomQuery = useQuery({ queryKey: roomKey, queryFn: () => getBaitlyRoomInspection(Number(id)), enabled: !!id && cleaning, retry: false });
  const allRoomPhotos = (work?: BaitlyRoomInspection) => !!work?.rooms?.length && work.rooms.every(room => (work.stepPhotoCounts?.[`inspection_${room.id}`] ?? 0) > 0);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [beforePhotoIds, setBeforePhotoIds] = useState<number[]>([]);
  const [afterPhotoIds, setAfterPhotoIds] = useState<number[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [inspectionComplete, setInspectionComplete] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const hydratedMission = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!cleaning) return;
    const complete = allRoomPhotos(roomQuery.data);
    setInspectionComplete(complete);
    setCompletedSteps(previous => {
      if (previous.has('inspection') === complete) return previous;
      const next = new Set(previous); complete ? next.add('inspection') : next.delete('inspection'); return next;
    });
  }, [cleaning, roomQuery.data, initialLoadData]);

  // ------------------------------------------------------------------
  // Hydrate from initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialLoadData || hydratedMission.current === id) return;
    hydratedMission.current = id;
    setBeforePhotos(initialLoadData.beforePhotos);
    setAfterPhotos(initialLoadData.afterPhotos);
    setInspectionComplete(cleaning ? allRoomPhotos(roomQuery.data) : initialLoadData.inspectionComplete);
    const initialSteps = new Set(initialLoadData.completedSteps);
    if(cleaning && !allRoomPhotos(roomQuery.data)) initialSteps.delete('inspection');
    setCompletedSteps(initialSteps);
  }, [id, initialLoadData]);

  // Sync photo IDs from intervention data
  useEffect(() => {
    if (!intervention) return;
    setBeforePhotoIds(parsePhotoIds(intervention.beforePhotoIds));
    setAfterPhotoIds(parsePhotoIds(intervention.afterPhotoIds));
  }, [intervention?.beforePhotoIds, intervention?.afterPhotoIds]);

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------

  const saveStepsMutation = useMutation({
    scope: interventionExecutionScope(id),
    mutationFn: ({ interventionId, steps }: { interventionId: number; steps: string }) =>
      interventionsApi.updateCompletedSteps(interventionId, steps),
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
    },
    onError: () => setError(t('interventions.detailErrors.savingSteps', 'Les étapes n’ont pas été enregistrées. Réessayez avant de terminer.')),
  });

  const uploadPhotosMutation = useMutation({
    scope: interventionExecutionScope(id),
    mutationFn: ({ interventionId, photos, type }: { interventionId: number; photos: File[]; type: 'before' | 'after' }) =>
      interventionsApi.uploadPhotos(interventionId, photos, type),
    onSuccess: async (updated, variables) => {
      const roomWork = cleaning ? await getBaitlyRoomInspection(variables.interventionId) : undefined;
      if (roomWork) queryClient.setQueryData(roomKey, roomWork);
      setIntervention(updated);
      // Update detail cache so navigation away/back serves fresh data
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
      queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });

      if (variables.type === 'before') {
        const newBeforePhotos = updated.beforePhotosUrls
          ? parsePhotos(updated.beforePhotosUrls)
          : [];
        setBeforePhotos(newBeforePhotos);
        if (newBeforePhotos.length > 0 && (!cleaning || allRoomPhotos(roomWork))) {
          setInspectionComplete(true);
          setCompletedSteps(prev => {
            const newSteps = new Set(prev).add('inspection');
            return newSteps;
          });
          onBeforePhotosChange?.(newBeforePhotos, completedSteps);
        }
      } else {
        const newAfterPhotos = updated.afterPhotosUrls
          ? parsePhotos(updated.afterPhotosUrls)
          : [];
        setAfterPhotos(newAfterPhotos);
        if (newAfterPhotos.length > 0) {
          setCompletedSteps(prev => {
            const newSteps = new Set(prev).add('after_photos');
            return newSteps;
          });
          onAfterPhotosChange?.(newAfterPhotos, completedSteps);
        }
      }

      setPhotosDialogOpen(false);
      setSelectedPhotos([]);
      // Keep this write inside the upload's serial scope. Awaiting another
      // scoped mutation here would deadlock behind the upload itself.
      try {
        const storedSteps: unknown = JSON.parse(updated.completedSteps || '[]');
        const steps = new Set<string>(Array.isArray(storedSteps) ? storedSteps.filter((step): step is string => typeof step === 'string') : []);
        if (parsePhotos(updated.beforePhotosUrls).length > 0 && (!cleaning || allRoomPhotos(roomWork))) steps.add('inspection');
        else if (cleaning) steps.delete('inspection');
        if (variables.type === 'after' && parsePhotos(updated.afterPhotosUrls).length > 0) steps.add('after_photos');
        const persisted = await interventionsApi.updateCompletedSteps(variables.interventionId, JSON.stringify([...steps]));
        setIntervention(persisted);
        if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), persisted);
        setError(null);
      } catch {
        // The photo is already stored: keep it visible and retry the steps at
        // completion, without requiring a duplicate file upload.
        setError(t('interventions.detailErrors.savingSteps', 'Les étapes n’ont pas été enregistrées. Réessayez avant de terminer.'));
      }
    },
    onError: (err: Error) => {
      setError(err.message || t('interventions.detailErrors.addingPhotos'));
    },
  });

  const deletePhotoMutation = useMutation({
    scope: interventionExecutionScope(id),
    mutationFn: ({ interventionId, photoId }: { interventionId: number; photoId: number }) =>
      interventionsApi.deletePhoto(interventionId, photoId),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: roomKey });
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(String(id)), updated);
      queryClient.invalidateQueries({ queryKey: interventionsKeys.lists() });

      // Refresh local photo arrays from the updated intervention
      const newBefore = updated.beforePhotosUrls ? parsePhotos(updated.beforePhotosUrls) : [];
      const newAfter = updated.afterPhotosUrls ? parsePhotos(updated.afterPhotosUrls) : [];
      setBeforePhotos(newBefore);
      setAfterPhotos(newAfter);

      // Revoke inspection step if all before photos were deleted
      if (newBefore.length === 0) {
        setInspectionComplete(false);
        setCompletedSteps(prev => {
          const next = new Set(prev);
          next.delete('inspection');
          saveCompletedSteps(next);
          return next;
        });
      }

      // Revoke after_photos step if all after photos were deleted
      if (newAfter.length === 0) {
        setCompletedSteps(prev => {
          const next = new Set(prev);
          next.delete('after_photos');
          saveCompletedSteps(next);
          return next;
        });
      }

      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || t('interventions.detailErrors.deletingPhoto'));
    },
    onSettled: () => {
      setDeletingPhotoId(null);
    },
  });

  // ------------------------------------------------------------------
  // Save completed steps helper
  // ------------------------------------------------------------------
  const saveCompletedSteps = (steps: Set<string>) => {
    if (!id || !intervention) return;
    const json = JSON.stringify(Array.from(steps));
    saveStepsMutation.mutate({ interventionId: Number(id), steps: json });
  };

  // Completion must wait for the final step selection to reach the server.
  const persistCompletedSteps = async (steps: Set<string>) => {
    if (!id || !intervention) throw new Error('Intervention unavailable');
    return saveStepsMutation.mutateAsync({ interventionId: Number(id), steps: JSON.stringify(Array.from(steps)) });
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handlePhotoUpload = async () => {
    if (cleaning && photoType === 'after' && !inspectionComplete) {
      setError(t('interventions.detailErrors.mustUploadBeforePhotosFirst'));
      return;
    }
    if (!id || !intervention || selectedPhotos.length === 0) return;
    if (cleaning && photoType === 'before' && !inspectionRoom) { setError(t('interventions.progressSteps.inspectionTitle')); return; }
    const files = cleaning && photoType === 'before' ? selectedPhotos.map((file, index) => new File([file],
      `baitly-${id}-step-inspection_${inspectionRoom}-${Date.now()}-${index}.${file.name.split('.').pop() || 'jpg'}`, { type: file.type })) : photoType === 'before' ? selectedPhotos.slice(0, 1) : selectedPhotos;

    setUploadingPhotos(true);
    uploadPhotosMutation.mutate(
      { interventionId: Number(id), photos: files, type: photoType },
      { onSettled: () => setUploadingPhotos(false) },
    );
  };

  const handleDeletePhoto = (photoId: number) => {
    if (!id || !intervention || uploadingPhotos) return;
    setDeletingPhotoId(photoId);
    deletePhotoMutation.mutate({ interventionId: Number(id), photoId });
  };

  return {
    photosDialogOpen,
    setPhotosDialogOpen,
    selectedPhotos,
    setSelectedPhotos,
    uploadingPhotos,
    photoType,
    setPhotoType,
    inspectionRooms: roomQuery.data?.rooms ?? [],
    inspectionRoomCounts: roomQuery.data?.stepPhotoCounts ?? {},
    setInspectionRoom,
    beforePhotos,
    setBeforePhotos,
    afterPhotos,
    setAfterPhotos,
    beforePhotoIds,
    afterPhotoIds,
    deletingPhotoId,
    inspectionComplete,
    setInspectionComplete,
    completedSteps,
    setCompletedSteps,
    saveCompletedSteps,
    persistCompletedSteps,

    handlePhotoUpload,
    handleDeletePhoto,
  };
}
