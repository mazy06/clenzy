import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { interventionsKeys } from './useInterventionsList';
import { getAccessToken } from '../../keycloak';
import { interventionsApi } from '../../services/api/interventionsApi';
import { buildApiUrl } from '../../config/api';
import { interventionExecutionScope } from './interventionExecutionScope';
import {
  InterventionDetailsData,
  StepNotes,
  StepType,
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';
import { useTranslation } from '../../hooks/useTranslation';

interface UseInterventionNotesArgs {
  id: string | undefined;
  intervention: InterventionDetailsData | null;
  setIntervention: Dispatch<SetStateAction<InterventionDetailsData | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  initialLoadData: InitialLoadData | null;
}

export function useInterventionNotes({
  id,
  intervention,
  setIntervention,
  setError,
  initialLoadData,
}: UseInterventionNotesArgs) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const savingRef = useRef(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [currentStepForNotes, setCurrentStepForNotes] = useState<StepType | null>(null);
  const [stepNotes, setStepNotes] = useState<StepNotes>({});

  // References for auto-save timers
  const notesSaveTimeoutRef = useRef<number | null>(null);
  const lastSavedNotesRef = useRef<string>('');
  const isInitialLoadRef = useRef<boolean>(true);

  // ------------------------------------------------------------------
  // Hydrate from initial load
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!initialLoadData) return;
    setStepNotes(initialLoadData.stepNotes);
    lastSavedNotesRef.current = initialLoadData.lastSavedNotes;
    // Le brouillon du dialogue appartient à l'utilisateur. Une actualisation
    // de la fiche ne doit pas le remplacer par le JSON de toutes les étapes.
    // Mark initial load done after delay
    const timeoutId = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [initialLoadData]);

  // ------------------------------------------------------------------
  // Mutation
  // ------------------------------------------------------------------

  const updateNotesMutation = useMutation({
    scope: interventionExecutionScope(id),
    mutationFn: async ({ interventionId, notes }: { interventionId: number; notes: string }) => {
      try {
        return await interventionsApi.updateNotes(interventionId, notes);
      } catch (error) {
        // Une réponse perdue ne prouve pas que l'écriture a échoué. Relire
        // avant de proposer un nouvel envoi, sans rejouer la modification.
        const persisted = await interventionsApi.getById(interventionId).catch(() => null);
        if (persisted?.notes === notes) return persisted;
        throw error;
      }
    },
    onSuccess: (updated) => {
      setIntervention(updated);
      if (id) queryClient.setQueryData(interventionsKeys.detail(id), updated);
    },
  });

  // ------------------------------------------------------------------
  // Internal save helper
  // ------------------------------------------------------------------

  const saveNotesAuto = async (notesToSave: StepNotes, immediate: boolean = false, requireConfirmation = false) => {
    if (!id || !intervention) return;

    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    const saveNotes = async () => {
      try {
        const notesJson = JSON.stringify(notesToSave);
        if (notesJson === lastSavedNotesRef.current) return;
        await updateNotesMutation.mutateAsync({ interventionId: Number(id), notes: notesJson });
        lastSavedNotesRef.current = notesJson;
      } catch {
        if (requireConfirmation) throw new Error('Notes not saved');
        setError(t('interventions.detailErrors.updatingNotes'));
      }
    };

    if (immediate) {
      await saveNotes();
    } else {
      notesSaveTimeoutRef.current = setTimeout(saveNotes, 2000) as unknown as number;
    }
  };

  // ------------------------------------------------------------------
  // Computed
  // ------------------------------------------------------------------

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

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleOpenNotesDialog = (step: StepType, roomIndex?: number) => {
    setCurrentStepForNotes(step);
    if (step === 'rooms' && roomIndex !== undefined) {
      const rooms = stepNotes.rooms;
      const roomNote = (rooms && typeof rooms === 'object' && roomIndex in rooms) ? rooms[roomIndex] : '';
      setNotesValue(roomNote as string);
    } else if (step === 'rooms') {
      const rooms = stepNotes.rooms;
      const generalNote = (rooms && typeof rooms === 'object' && 'general' in rooms) ? rooms.general || '' : '';
      setNotesValue(generalNote);
    } else {
      const existingNote = stepNotes[step] || '';
      setNotesValue(existingNote as string);
    }
    setNotesDialogOpen(true);
  };

  const handleUpdateNotes = async () => {
    if (!id || !intervention || !currentStepForNotes || savingRef.current) return;

    savingRef.current = true;
    setUpdatingNotes(true);
    try {
      const updatedStepNotes = { ...stepNotes };
      if (currentStepForNotes === 'rooms') {
        if (!updatedStepNotes.rooms) updatedStepNotes.rooms = {};
        updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: notesValue };
      } else {
        updatedStepNotes[currentStepForNotes] = notesValue;
      }

      await saveNotesAuto(updatedStepNotes, true, true);

      setStepNotes(updatedStepNotes);
      setNotesDialogOpen(false);
      setNotesValue('');
      setCurrentStepForNotes(null);
      setError(null);
    } catch {
      setError(t('interventions.detailErrors.updatingNotes'));
    } finally {
      savingRef.current = false;
      setUpdatingNotes(false);
    }
  };

  // ------------------------------------------------------------------
  // Auto-save effects
  // ------------------------------------------------------------------

  // Auto-save notes on change (debounced)
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    if (Object.keys(stepNotes).length > 0) {
      const notesJson = JSON.stringify(stepNotes);
      if (notesJson !== lastSavedNotesRef.current) {
        saveNotesAuto(stepNotes, false);
      }
    }

    return () => {
      if (notesSaveTimeoutRef.current) {
        clearTimeout(notesSaveTimeoutRef.current);
      }
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          saveNotesAuto(stepNotes, true);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes]);

  // Save before unload — notes
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (Object.keys(stepNotes).length > 0) {
        const notesJson = JSON.stringify(stepNotes);
        if (notesJson !== lastSavedNotesRef.current && id && intervention) {
          const formData = new URLSearchParams();
          formData.append('notes', notesJson);
          // Header conditionnel : sans token JS (session restauree via le
          // cookie HttpOnly), "Bearer null" court-circuiterait le repli cookie.
          const token = getAccessToken();
          fetch(buildApiUrl(`/interventions/${id}/notes`), {
            method: 'PUT',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            keepalive: true,
            credentials: 'include',
          }).catch(() => { /* silent */ });
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepNotes, id, intervention]);

  return {
    notesDialogOpen,
    setNotesDialogOpen,
    notesValue,
    setNotesValue,
    updatingNotes,
    currentStepForNotes,
    setCurrentStepForNotes,
    stepNotes,

    // Computed
    getStepNote,

    // Handlers
    handleOpenNotesDialog,
    handleUpdateNotes,
  };
}
