import React from 'react';
import {
  Box, Typography, LinearProgress, Button, Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Replay as ReplayIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import type { InterventionDetailsData, PropertyDetails } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';
import ProgressStepInspection from './ProgressStepInspection';
import ProgressStepRooms from './ProgressStepRooms';
import ProgressStepPhotos from './ProgressStepPhotos';

// ─── Props ───────────────────────────────────────────────────────────────────

interface InterventionProgressStepsProps {
  intervention: InterventionDetailsData;
  calculateProgress: () => number;
  canUpdateProgress: boolean;
  canStartIntervention: boolean;
  canStartOrUpdateIntervention: boolean;
  propertyDetails: PropertyDetails | null;
  getTotalRooms: () => number;
  getRoomNames: () => string[];
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  inspectionComplete: boolean;
  beforePhotos: string[];
  afterPhotos: string[];
  completedSteps: Set<string>;
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  handleStartIntervention: () => void;
  handleCompleteIntervention: () => void;
  handleReopenIntervention: () => void;
  handleRoomValidation: (roomIndex: number) => void;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
  handleUpdateProgressValue: (progress: number) => void;
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
  setInspectionComplete: (value: boolean) => void;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  starting: boolean;
  completing: boolean;
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
  starting,
  completing,
  areAllStepsCompleted,
}) => {
  const progress = calculateProgress();

  return (
    <>
      {/* ── Barre de progression ────────────────────────────────────────── */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.75}>
          <Typography variant="body2" fontWeight={600}>
            Progression
          </Typography>
          <Typography
            variant="body2"
            fontWeight={700}
            color={progress === 100 ? 'success.main' : 'primary.main'}
          >
            {progress}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={progress === 100 ? 'success' : 'primary'}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* ── Étapes de progression ───────────────────────────────────────── */}
      {canUpdateProgress && propertyDetails && (
        <Box mb={2}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
            Étapes de progression
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>

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

          <ProgressStepRooms
            inspectionComplete={inspectionComplete}
            validatedRooms={validatedRooms}
            allRoomsValidated={allRoomsValidated}
            getTotalRooms={getTotalRooms}
            getRoomNames={getRoomNames}
            getStepNote={getStepNote}
            handleRoomValidation={handleRoomValidation}
            handleOpenNotesDialog={handleOpenNotesDialog}
          />

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

          </Box>{/* end grid */}
        </Box>
      )}

      {/* ── Bouton démarrer ─────────────────────────────────────────────── */}
      {canStartIntervention && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            fullWidth
            onClick={handleStartIntervention}
            disabled={starting}
            sx={{ py: 1.25, textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' }}
          >
            {starting ? 'Démarrage...' : 'Démarrer l\'intervention'}
          </Button>
          <Alert
            severity="info"
            icon={<DescriptionIcon sx={{ fontSize: 18 }} />}
            sx={{ mt: 1.5, py: 0.5 }}
          >
            <Typography variant="body2">
              Un bon d'intervention sera automatiquement généré et envoyé par email au démarrage.
            </Typography>
          </Alert>
        </Box>
      )}

      {/* ── Bouton réouvrir ─────────────────────────────────────────────── */}
      {intervention?.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: 'rgba(237, 108, 2, 0.04)',
            border: '1px solid',
            borderColor: 'warning.light',
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 20, color: 'white' }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                Intervention terminée. Vous pouvez la rouvrir pour effectuer des modifications.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="warning"
              startIcon={<ReplayIcon />}
              onClick={handleReopenIntervention}
              disabled={completing}
              sx={{
                py: 1.25,
                px: 3,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {completing ? 'Réouverture...' : 'Réouvrir'}
            </Button>
          </Box>
        </Box>
      )}

      {/* ── Message avant démarrage ─────────────────────────────────────── */}
      {canStartIntervention && (
        <Alert severity="warning" sx={{ mt: 2, py: 0.5 }}>
          <Typography variant="body2">
            Les photos et étapes ne seront disponibles qu'après le démarrage.
          </Typography>
        </Alert>
      )}

      {/* ── Photos avant (standalone, avant validation étape 1) ─────────── */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            Photos avant intervention
          </Typography>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </Box>
      )}
    </>
  );
};

export default InterventionProgressSteps;
