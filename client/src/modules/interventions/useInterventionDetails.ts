import { useInterventionState } from './useInterventionState';
import { useInterventionPhotos } from './useInterventionPhotos';
import { useInterventionProgress } from './useInterventionProgress';
import { useInterventionNotes } from './useInterventionNotes';

/**
 * Thin orchestrator that composes the four focused hooks while preserving
 * the exact same public API consumed by InterventionDetails.tsx.
 */
export function useInterventionDetails(id: string | undefined) {
  // ---- 1. Core state, loading, permissions ----
  const state = useInterventionState(id);

  // ---- 2. Photos ----
  const photos = useInterventionPhotos({
    id,
    intervention: state.intervention,
    setIntervention: state.setIntervention,
    setError: state.setError,
    initialLoadData: state.initialLoadData,
  });

  // ---- 3. Progress, rooms, steps ----
  const progress = useInterventionProgress({
    id,
    intervention: state.intervention,
    setIntervention: state.setIntervention,
    setError: state.setError,
    setCompleting: state.setCompleting,
    propertyDetails: state.propertyDetails,
    initialLoadData: state.initialLoadData,
    canUpdateProgressFn: state.canUpdateProgress,
    inspectionComplete: photos.inspectionComplete,
    setInspectionComplete: photos.setInspectionComplete,
    beforePhotos: photos.beforePhotos,
    afterPhotos: photos.afterPhotos,
    completedSteps: photos.completedSteps,
    setCompletedSteps: photos.setCompletedSteps,
    saveCompletedSteps: photos.saveCompletedSteps,
  });

  // ---- 4. Notes ----
  const notes = useInterventionNotes({
    id,
    intervention: state.intervention,
    setIntervention: state.setIntervention,
    setError: state.setError,
    initialLoadData: state.initialLoadData,
  });

  // ---- Return the same flat API ----
  return {
    // Auth-derived values
    user: state.user,
    isTechnician: state.isTechnician,
    isHousekeeper: state.isHousekeeper,
    isSupervisor: state.isSupervisor,

    // State
    intervention: state.intervention,
    loading: state.loading,
    error: state.error,
    starting: state.starting,
    completing: state.completing,
    updatingProgress: progress.updatingProgress,
    progressDialogOpen: progress.progressDialogOpen,
    progressValue: progress.progressValue,
    notesDialogOpen: notes.notesDialogOpen,
    notesValue: notes.notesValue,
    updatingNotes: notes.updatingNotes,
    currentStepForNotes: notes.currentStepForNotes,
    stepNotes: notes.stepNotes,
    photosDialogOpen: photos.photosDialogOpen,
    selectedPhotos: photos.selectedPhotos,
    uploadingPhotos: photos.uploadingPhotos,
    photoType: photos.photoType,
    showSidebar: state.showSidebar,
    propertyDetails: state.propertyDetails,
    completedSteps: photos.completedSteps,
    beforePhotos: photos.beforePhotos,
    afterPhotos: photos.afterPhotos,
    validatedRooms: progress.validatedRooms,
    inspectionComplete: photos.inspectionComplete,
    allRoomsValidated: progress.allRoomsValidated,
    canViewInterventions: state.canViewInterventions,
    canEditInterventions: state.canEditInterventions,

    // Setters
    setProgressDialogOpen: progress.setProgressDialogOpen,
    setProgressValue: progress.setProgressValue,
    setNotesDialogOpen: notes.setNotesDialogOpen,
    setNotesValue: notes.setNotesValue,
    setCurrentStepForNotes: notes.setCurrentStepForNotes,
    setPhotosDialogOpen: photos.setPhotosDialogOpen,
    setSelectedPhotos: photos.setSelectedPhotos,
    setPhotoType: photos.setPhotoType,
    setShowSidebar: state.setShowSidebar,
    setError: state.setError,
    setCompletedSteps: photos.setCompletedSteps,
    setAllRoomsValidated: progress.setAllRoomsValidated,
    setInspectionComplete: photos.setInspectionComplete,
    saveCompletedSteps: photos.saveCompletedSteps,

    // Handler functions
    handleStartIntervention: state.handleStartIntervention,
    handleUpdateProgress: progress.handleUpdateProgress,
    handleCompleteIntervention: state.handleCompleteIntervention,
    handleReopenIntervention: progress.handleReopenIntervention,
    handleOpenNotesDialog: notes.handleOpenNotesDialog,
    handleUpdateNotes: notes.handleUpdateNotes,
    handlePhotoUpload: photos.handlePhotoUpload,
    handlePhotoSelect: photos.handlePhotoSelect,
    handleInspectionComplete: photos.handleInspectionComplete,
    handleRoomValidation: progress.handleRoomValidation,
    handleAfterPhotosComplete: photos.handleAfterPhotosComplete,
    handleUpdateProgressValue: progress.handleUpdateProgressValue,

    // Computed values
    canStartOrUpdateIntervention: state.canStartOrUpdateIntervention,
    canStartIntervention: state.canStartIntervention,
    canUpdateProgress: state.canUpdateProgress,
    canModifyIntervention: state.canModifyIntervention,
    areAllStepsCompleted: progress.areAllStepsCompleted,
    calculateProgress: progress.calculateProgress,
    getTotalRooms: progress.getTotalRooms,
    getRoomNames: progress.getRoomNames,
    getStepNote: notes.getStepNote,
  };
}
