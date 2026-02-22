import React from 'react';
import {
  Box, Typography, LinearProgress, Button, Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import type { InterventionDetailsData, PropertyDetails } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';
import ProgressStepInspection from './ProgressStepInspection';
import ProgressStepRooms from './ProgressStepRooms';
import ProgressStepPhotos from './ProgressStepPhotos';

// ─── Props ───────────────────────────────────────────────────────────────────

interface InterventionProgressStepsProps {
  intervention: InterventionDetailsData;
  // Progression
  calculateProgress: () => number;
  canUpdateProgress: boolean;
  canStartIntervention: boolean;
  canStartOrUpdateIntervention: boolean;
  // Property & rooms
  propertyDetails: PropertyDetails | null;
  getTotalRooms: () => number;
  getRoomNames: () => string[];
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  inspectionComplete: boolean;
  // Photos
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  // Notes
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  // Handlers
  handleStartIntervention: () => void;
  handleCompleteIntervention: () => void;
  handleReopenIntervention: () => void;
  handleRoomValidation: (roomIndex: number) => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  // State setters
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  setInspectionComplete: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAllRoomsValidated: (value: boolean) => void;
  saveCompletedSteps: (steps: Set<string>) => void;
  // Loading states
  starting: boolean;
  completing: boolean;
  // All steps completed check
  areAllStepsCompleted: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const InterventionProgressSteps: React.FC<InterventionProgressStepsProps> = ({
  intervention,
  calculateProgress,
  canUpdateProgress,
  canStartIntervention,
  canStartOrUpdateIntervention,
  propertyDetails,
  getTotalRooms,
  getRoomNames,
  validatedRooms,
  allRoomsValidated,
  inspectionComplete,
  beforePhotos,
  afterPhotos,
  completedSteps,
  getStepNote,
  handleStartIntervention,
  handleCompleteIntervention,
  handleReopenIntervention,
  handleRoomValidation,
  handleOpenNotesDialog,
  handleUpdateProgressValue,
  setPhotoType,
  setPhotosDialogOpen,
  setInspectionComplete,
  setCompletedSteps,
  setAllRoomsValidated,
  saveCompletedSteps,
  starting,
  completing,
  areAllStepsCompleted,
}) => {
  return (
    <>
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
      {canUpdateProgress && propertyDetails && (
        <Box mb={2}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5, fontSize: '0.95rem' }}>
            Étapes de progression
          </Typography>

          {/* Étape 3 — Photos après intervention (most recent, shown on top) */}
          {allRoomsValidated && (
            <ProgressStepPhotos
              intervention={intervention}
              allRoomsValidated={allRoomsValidated}
              afterPhotos={afterPhotos}
              completedSteps={completedSteps}
              getStepNote={getStepNote}
              handleCompleteIntervention={handleCompleteIntervention}
              handleOpenNotesDialog={handleOpenNotesDialog}
              setPhotoType={setPhotoType}
              setPhotosDialogOpen={setPhotosDialogOpen}
              completing={completing}
              areAllStepsCompleted={areAllStepsCompleted}
            />
          )}

          {/* Étape 2 — Validation par pièce */}
          {inspectionComplete && (
            <ProgressStepRooms
              inspectionComplete={inspectionComplete}
              validatedRooms={validatedRooms}
              allRoomsValidated={allRoomsValidated}
              getTotalRooms={getTotalRooms}
              getRoomNames={getRoomNames}
              getStepNote={getStepNote}
              handleRoomValidation={handleRoomValidation}
              handleOpenNotesDialog={handleOpenNotesDialog}
              handleUpdateProgressValue={handleUpdateProgressValue}
              setAllRoomsValidated={setAllRoomsValidated}
              setCompletedSteps={setCompletedSteps}
              saveCompletedSteps={saveCompletedSteps}
              calculateProgress={calculateProgress}
            />
          )}

          {/* Étape 1 — Inspection générale (oldest, shown at bottom) */}
          <ProgressStepInspection
            inspectionComplete={inspectionComplete}
            beforePhotos={beforePhotos}
            completedSteps={completedSteps}
            getStepNote={getStepNote}
            handleOpenNotesDialog={handleOpenNotesDialog}
            handleUpdateProgressValue={handleUpdateProgressValue}
            setPhotoType={setPhotoType}
            setPhotosDialogOpen={setPhotosDialogOpen}
            setInspectionComplete={setInspectionComplete}
            setCompletedSteps={setCompletedSteps}
            calculateProgress={calculateProgress}
          />
        </Box>
      )}

      {/* Bouton pour démarrer l'intervention */}
      {canStartIntervention && (
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
      {intervention && intervention.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 2,
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
                  alignItems: 'center',
                },
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
                    flexShrink: 0,
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 20, color: 'white' }} />
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
                maxWidth: { xs: '100%', sm: '250px' },
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
                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                  },
                }}
              >
                {completing ? 'Réouverture...' : 'Réouvrir l\'intervention'}
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Photos avant intervention — standalone (only when step not yet validated) */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && (
        <Box sx={{ mb: 2, mt: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 1 }}>
            Photos avant intervention
          </Typography>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </Box>
      )}
    </>
  );
};

export default InterventionProgressSteps;
