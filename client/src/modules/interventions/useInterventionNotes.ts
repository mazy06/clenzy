import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { getAccessToken } from '../../services/storageService';
import { interventionsApi } from '../../services/api';
import { buildApiUrl } from '../../config/api';
import {
  InterventionDetailsData,
  StepNotes,
  StepType,
} from './interventionUtils';
import type { InitialLoadData } from './useInterventionState';

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
    // Also set the raw notesValue from the intervention for backward compat
    if (initialLoadData.intervention.notes) {
      setNotesValue(initialLoadData.intervention.notes);
    }
    // Mark initial load done after delay
    setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1000);
  }, [initialLoadData]);

  // ------------------------------------------------------------------
  // Internal save helper
  // ------------------------------------------------------------------

  const saveNotesAuto = async (notesToSave: StepNotes, immediate: boolean = false) => {
    if (!id || !intervention) return;

    if (notesSaveTimeoutRef.current && !immediate) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    const saveNotes = async () => {
      try {
        const notesJson = JSON.stringify(notesToSave);
        if (notesJson === lastSavedNotesRef.current) return;
        const updated = await interventionsApi.updateNotes(Number(id), notesJson) as unknown as InterventionDetailsData;
        setIntervention(updated);
        lastSavedNotesRef.current = notesJson;
      } catch {
        // silent
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
    if (!id || !intervention || !currentStepForNotes) return;

    setUpdatingNotes(true);
    try {
      const updatedStepNotes = { ...stepNotes };
      if (currentStepForNotes === 'rooms') {
        if (!updatedStepNotes.rooms) updatedStepNotes.rooms = {};
        updatedStepNotes.rooms = { ...updatedStepNotes.rooms, general: notesValue };
      } else {
        updatedStepNotes[currentStepForNotes] = notesValue;
      }

      await saveNotesAuto(updatedStepNotes, true);

      setStepNotes(updatedStepNotes);
      setNotesDialogOpen(false);
      setNotesValue('');
      setCurrentStepForNotes(null);
      setError(null);
    } catch {
      setError('Erreur lors de la mise \u00e0 jour des notes');
    } finally {
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
          const token = getAccessToken();
          fetch(buildApiUrl(`/interventions/${id}/notes`), {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString(),
            keepalive: true
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
