import React, { useState } from 'react';
import {
  Box, Typography, LinearProgress, Button, Divider, Chip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  PlayArrow as PlayArrowIcon,
  Replay as ReplayIcon,
  RocketLaunch as RocketIcon,
  PhotoCamera as PhotoCameraIcon,
  Comment as CommentIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Room as RoomIcon,
  Done as DoneIcon,
  Summarize as SummarizeIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import type { InterventionDetailsData, PropertyDetails } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Styles ─────────────────────────────────────────────────────────────────

const roomChipSx = (validated: boolean) => ({
  height: 32,
  fontSize: '0.8125rem',
  fontWeight: 500,
  borderRadius: '16px',
  transition: 'all 0.15s ease',
  ...(!validated && {
    cursor: 'pointer',
    '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' },
  }),
});

const noteBoxSx = {
  p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5,
  border: '1px solid', borderColor: 'grey.200',
};

const actionBtnSx = { textTransform: 'none', fontSize: '0.8125rem', borderRadius: 1.5 };

// ─── Stepper header ─────────────────────────────────────────────────────────

type StepId = 0 | 1 | 2 | 3;

interface StepDef {
  id: StepId;
  label: string;
  completed: boolean;
  active: boolean;
  locked: boolean;
}

const StepperHeader: React.FC<{
  steps: StepDef[];
  activeStep: StepId;
  onStepClick: (id: StepId) => void;
}> = ({ steps, activeStep, onStepClick }) => (
  <Box sx={{
    display: 'flex', alignItems: 'flex-start',
    gap: 0, mb: 2, position: 'relative',
  }}>
    {steps.map((step, idx) => {
      const isActive = activeStep === step.id;
      return (
        <React.Fragment key={step.id}>
          {idx > 0 && (
            <Box sx={{
              flex: 1, height: 2, mt: 1.75,
              bgcolor: step.completed ? 'success.main' : 'grey.200',
              transition: 'background-color 0.3s',
            }} />
          )}
          <Box
            onClick={() => !step.locked && onStepClick(step.id)}
            sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: step.locked ? 'default' : 'pointer',
              opacity: step.locked ? 0.4 : 1,
              minWidth: 80, maxWidth: 120,
              transition: 'opacity 0.2s',
            }}
          >
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: step.completed ? 'success.main' : isActive ? 'primary.main' : 'grey.200',
              color: step.completed || isActive ? 'white' : 'text.secondary',
              transition: 'all 0.2s',
              mb: 0.5,
              ...(isActive && !step.completed && {
                boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.2)',
              }),
            }}>
              {step.completed ? (
                <CheckCircleIcon sx={{ fontSize: 18 }} />
              ) : step.locked ? (
                <LockIcon sx={{ fontSize: 14 }} />
              ) : (
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                  {step.id + 1}
                </Typography>
              )}
            </Box>
            <Typography
              variant="caption"
              fontWeight={isActive ? 700 : 500}
              color={isActive ? 'primary.main' : step.completed ? 'success.main' : 'text.secondary'}
              sx={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.2, px: 0.25 }}
            >
              {step.label}
            </Typography>
          </Box>
        </React.Fragment>
      );
    })}
  </Box>
);

// ─── Component ──────────────────────────────────────────────────────────────

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
  const isComplete = progress === 100;

  // Auto-select the current active step
  const getDefaultStep = (): StepId => {
    if (isComplete) return 3;
    if (allRoomsValidated) return 2;
    if (inspectionComplete) return 1;
    return 0;
  };
  const [activeStep, setActiveStep] = useState<StepId>(getDefaultStep);

  const totalRooms = getTotalRooms();
  const roomNames = getRoomNames();

  const steps: StepDef[] = [
    { id: 0, label: 'Inspection', completed: inspectionComplete, active: !inspectionComplete, locked: false },
    { id: 1, label: 'Pièces', completed: allRoomsValidated, active: inspectionComplete && !allRoomsValidated, locked: !inspectionComplete },
    { id: 2, label: 'Photos', completed: completedSteps.has('after_photos'), active: allRoomsValidated && !completedSteps.has('after_photos'), locked: !allRoomsValidated },
    { id: 3, label: 'Récap', completed: isComplete, active: false, locked: !areAllStepsCompleted },
  ];

  // ── Step content renderers ────────────────────────────────────────────

  const renderInspection = () => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        Inspection générale
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Vérifiez l'état des lieux et prenez des photos avant l'intervention.
      </Typography>

      {beforePhotos.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16, color: inspectionComplete ? 'success.main' : 'text.secondary' }} />
            {beforePhotos.length} photo(s) avant intervention
          </Typography>
          <PhotoGallery photos={beforePhotos} columns={4} />
        </Box>
      )}

      {getStepNote('inspection') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>Notes</Typography>
          <Box sx={noteBoxSx}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('inspection')}
            </Typography>
          </Box>
        </Box>
      )}

      {!inspectionComplete && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} sx={actionBtnSx}
            onClick={() => { setPhotoType('before'); setPhotosDialogOpen(true); }}>
            Ajouter photos
          </Button>
          <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
            onClick={() => handleOpenNotesDialog('inspection')}>
            {getStepNote('inspection') ? 'Modifier note' : 'Ajouter note'}
          </Button>
          {beforePhotos.length > 0 && (
            <Button variant="contained" size="small" startIcon={<CheckCircleOutlineIcon />} sx={{
              ...actionBtnSx,
              animation: 'pulse 2s infinite',
              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
            }}
            onClick={() => {
              setInspectionComplete(true);
              setCompletedSteps(prev => new Set(prev).add('inspection'));
              handleUpdateProgressValue(calculateProgress());
              setActiveStep(1);
            }}>
              Valider l'inspection
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

  const renderRooms = () => (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="body2" fontWeight={600}>
          Validation des pièces
        </Typography>
        {totalRooms > 0 && (
          <Chip label={`${validatedRooms.size}/${totalRooms}`} size="small"
            color={allRoomsValidated ? 'success' : 'primary'} variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cliquez sur chaque pièce pour la marquer comme nettoyée.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
        {roomNames.map((name, idx) => (
          <Chip key={idx}
            icon={validatedRooms.has(idx) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
            label={name} size="small"
            color={validatedRooms.has(idx) ? 'success' : 'primary'}
            variant={validatedRooms.has(idx) ? 'filled' : 'outlined'}
            onClick={validatedRooms.has(idx) ? undefined : () => handleRoomValidation(idx)}
            disabled={validatedRooms.has(idx)}
            sx={roomChipSx(validatedRooms.has(idx))}
          />
        ))}
      </Box>

      {getStepNote('rooms') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>Notes</Typography>
          <Box sx={noteBoxSx}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('rooms')}
            </Typography>
          </Box>
        </Box>
      )}

      <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
        onClick={() => handleOpenNotesDialog('rooms')}>
        {getStepNote('rooms') ? 'Modifier note' : 'Ajouter note'}
      </Button>
    </Box>
  );

  const renderPhotos = () => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        Photos après intervention
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Prenez des photos des pièces après l'intervention pour finaliser.
      </Typography>

      {afterPhotos.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
            {afterPhotos.length} photo(s) après intervention
          </Typography>
          <PhotoGallery photos={afterPhotos} columns={4} />
        </Box>
      )}

      {getStepNote('after_photos') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>Notes</Typography>
          <Box sx={noteBoxSx}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('after_photos')}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} sx={actionBtnSx}
          onClick={() => { setPhotoType('after'); setPhotosDialogOpen(true); }}>
          Ajouter photos
        </Button>
        <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
          onClick={() => handleOpenNotesDialog('after_photos')}>
          {getStepNote('after_photos') ? 'Modifier note' : 'Ajouter note'}
        </Button>
        <Button variant="contained" color="success" size="small" startIcon={<DoneIcon />}
          onClick={handleCompleteIntervention}
          disabled={!areAllStepsCompleted || completing || intervention.status === 'COMPLETED'}
          sx={{
            ...actionBtnSx,
            ...(areAllStepsCompleted && !completing && intervention.status !== 'COMPLETED' ? {
              animation: 'pulse 2s infinite',
              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
            } : {}),
          }}>
          {completing ? 'Finalisation...' : 'Terminer l\'intervention'}
        </Button>
      </Box>
    </Box>
  );

  const renderRecap = () => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 2 }}>
        Récapitulatif de l'intervention
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
        {/* Inspection */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(46, 125, 50, 0.04)', border: '1px solid', borderColor: 'success.light' }}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>Inspection</Typography>
          </Box>
          {beforePhotos.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {beforePhotos.length} photo(s) avant
            </Typography>
          )}
          {getStepNote('inspection') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
              "{getStepNote('inspection').substring(0, 60)}{getStepNote('inspection').length > 60 ? '...' : ''}"
            </Typography>
          )}
          {beforePhotos.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <PhotoGallery photos={beforePhotos} columns={3} />
            </Box>
          )}
        </Box>

        {/* Rooms */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(46, 125, 50, 0.04)', border: '1px solid', borderColor: 'success.light' }}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>Pièces ({validatedRooms.size}/{totalRooms})</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {roomNames.map((name, idx) => (
              validatedRooms.has(idx) && (
                <Chip key={idx} icon={<CheckCircleOutlineIcon />} label={name} size="small"
                  color="success" variant="filled" sx={{ height: 26, fontSize: '0.75rem' }} />
              )
            ))}
          </Box>
          {getStepNote('rooms') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              "{getStepNote('rooms').substring(0, 60)}{getStepNote('rooms').length > 60 ? '...' : ''}"
            </Typography>
          )}
        </Box>

        {/* Photos */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(46, 125, 50, 0.04)', border: '1px solid', borderColor: 'success.light' }}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>Photos après</Typography>
          </Box>
          {afterPhotos.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {afterPhotos.length} photo(s) après
              </Typography>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </>
          )}
          {getStepNote('after_photos') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
              "{getStepNote('after_photos').substring(0, 60)}{getStepNote('after_photos').length > 60 ? '...' : ''}"
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );

  const renderStepContent = () => {
    switch (activeStep) {
      case 0: return renderInspection();
      case 1: return renderRooms();
      case 2: return renderPhotos();
      case 3: return renderRecap();
      default: return null;
    }
  };

  return (
    <>
      <Divider sx={{ my: 2 }} />

      {/* ── Progress bar ─────────────────────────────────────────── */}
      <Box sx={{ mb: 2.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
          <Typography variant="body2" fontWeight={600}>Progression</Typography>
          <Box sx={{
            px: 1.25, py: 0.25, borderRadius: '12px',
            bgcolor: isComplete ? 'rgba(46, 125, 50, 0.1)' : 'rgba(25, 118, 210, 0.1)',
          }}>
            <Typography variant="body2" fontWeight={700}
              color={isComplete ? 'success.main' : 'primary.main'}
              sx={{ fontSize: '0.8125rem' }}>
              {progress}%
            </Typography>
          </Box>
        </Box>
        <LinearProgress variant="determinate" value={progress}
          color={isComplete ? 'success' : 'primary'}
          sx={{
            height: 8, borderRadius: 4, bgcolor: 'grey.100',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: isComplete
                ? 'linear-gradient(90deg, #43a047, #66bb6a)'
                : 'linear-gradient(90deg, #1976d2, #42a5f5)',
            },
          }}
        />
      </Box>

      {/* ── Stepper + Content ────────────────────────────────────── */}
      {canUpdateProgress && propertyDetails && (
        <>
          <StepperHeader steps={steps} activeStep={activeStep} onStepClick={(id) => setActiveStep(id)} />

          <Box sx={{
            p: 2.5, borderRadius: 2,
            border: '1px solid', borderColor: 'grey.200',
            bgcolor: 'background.paper',
            minHeight: 120,
          }}>
            {renderStepContent()}
          </Box>
        </>
      )}

      {/* ── Start CTA ────────────────────────────────────────────── */}
      {canStartIntervention && (
        <Box sx={{
          mt: 2, p: 2.5, borderRadius: 2,
          bgcolor: 'rgba(25, 118, 210, 0.04)',
          border: '1px solid', borderColor: 'rgba(25, 118, 210, 0.15)',
          textAlign: 'center',
        }}>
          <RocketIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Démarrez l'intervention pour accéder aux étapes de progression.
            Un bon d'intervention sera automatiquement envoyé par email.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />}
            onClick={handleStartIntervention} disabled={starting}
            sx={{
              py: 1.25, px: 4, textTransform: 'none', fontWeight: 600,
              fontSize: '0.875rem', borderRadius: 2,
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
            }}>
            {starting ? 'Démarrage...' : 'Démarrer l\'intervention'}
          </Button>
        </Box>
      )}

      {/* ── Reopen CTA ───────────────────────────────────────────── */}
      {intervention?.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <Box sx={{
          mt: 2, p: 2, borderRadius: 2,
          bgcolor: 'rgba(237, 108, 2, 0.04)',
          border: '1px solid', borderColor: 'rgba(237, 108, 2, 0.15)',
          display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' }, gap: 2,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%', bgcolor: 'success.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CheckCircleIcon sx={{ fontSize: 20, color: 'white' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Intervention terminée. Vous pouvez la rouvrir pour effectuer des modifications.
            </Typography>
          </Box>
          <Button variant="contained" color="warning" startIcon={<ReplayIcon />}
            onClick={handleReopenIntervention} disabled={completing}
            sx={{
              py: 1.25, px: 3, fontWeight: 600, textTransform: 'none',
              fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 2,
            }}>
            {completing ? 'Réouverture...' : 'Réouvrir'}
          </Button>
        </Box>
      )}

      {/* ── Photos avant standalone ──────────────────────────────── */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && activeStep !== 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Photos avant intervention</Typography>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </Box>
      )}
    </>
  );
};

export default InterventionProgressSteps;
