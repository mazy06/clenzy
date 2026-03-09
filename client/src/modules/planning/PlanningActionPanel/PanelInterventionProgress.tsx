import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Checkbox,
  FormControlLabel,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  CameraAlt,
  MeetingRoom,
  Search as InspectIcon,
} from '@mui/icons-material';
import type { PlanningEvent } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; error: string | null };

interface PanelInterventionProgressProps {
  event: PlanningEvent;
  onStartIntervention?: (interventionId: number) => Promise<ActionResult>;
  onCompleteIntervention?: (interventionId: number) => Promise<ActionResult>;
  onUploadPhotos?: (interventionId: number, photos: File[], type: 'before' | 'after') => Promise<ActionResult>;
  onUpdateInterventionProgress?: (interventionId: number, progress: number) => Promise<ActionResult>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseCompletedSteps = (steps?: string): Set<string> => {
  if (!steps) return new Set();
  return new Set(steps.split(',').filter(Boolean));
};

const parseValidatedRooms = (rooms?: string): Set<number> => {
  if (!rooms) return new Set();
  return new Set(rooms.split(',').filter(Boolean).map(Number));
};

// ─── Component ──────────────────────────────────────────────────────────────

const PanelInterventionProgress: React.FC<PanelInterventionProgressProps> = ({
  event,
  onStartIntervention,
  onCompleteIntervention,
  onUploadPhotos,
  onUpdateInterventionProgress,
}) => {
  const intervention = event.intervention;
  if (!intervention) {
    return (
      <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
        Aucune donnée d'intervention disponible
      </Alert>
    );
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const completedSteps = parseCompletedSteps(intervention.completedSteps);
  const validatedRooms = parseValidatedRooms(intervention.validatedRooms);
  const numericId = intervention.id;

  const isStarted = ['in_progress', 'awaiting_validation', 'completed'].includes(intervention.status);
  const isCompleted = ['completed', 'awaiting_validation'].includes(intervention.status);

  const inspectionDone = completedSteps.has('inspection');
  const roomsDone = completedSteps.has('rooms');
  const photosDone = completedSteps.has('after_photos');

  // Calculate progress
  let progress = 0;
  if (inspectionDone) progress += 33;
  if (roomsDone) progress += 33;
  if (photosDone) progress += 34;

  // Active step index
  const activeStep = photosDone ? 3 : roomsDone ? 2 : inspectionDone ? 1 : 0;

  // Room names (mock)
  const totalRooms = (intervention as any).totalRooms || 5;
  const roomNames = Array.from({ length: totalRooms }, (_, i) =>
    i === 0 ? 'Salon / Séjour'
      : i === totalRooms - 1 ? 'Cuisine'
        : i <= 2 ? `Chambre ${i}`
          : `Salle de bain ${i - 2}`
  );

  const handleStart = useCallback(async () => {
    if (!onStartIntervention) return;
    setLoading(true);
    setError(null);
    const result = await onStartIntervention(numericId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [numericId, onStartIntervention]);

  const handleComplete = useCallback(async () => {
    if (!onCompleteIntervention) return;
    setLoading(true);
    setError(null);
    const result = await onCompleteIntervention(numericId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [numericId, onCompleteIntervention]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    if (!e.target.files?.length || !onUploadPhotos) return;
    setLoading(true);
    setError(null);
    const result = await onUploadPhotos(numericId, Array.from(e.target.files), type);
    if (!result.success) setError(result.error);
    setLoading(false);
    e.target.value = '';
  }, [numericId, onUploadPhotos]);

  return (
    <Box>
      {/* Progress bar */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>Progression</Typography>
          {(() => { const c = progress === 100 ? '#4A9B8E' : progress > 0 ? '#0288d1' : '#757575'; return (
          <Chip
            label={`${progress}%`}
            size="small"
            sx={{ fontSize: '0.625rem', height: 20, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
          />
          ); })()}
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* Start button */}
      {!isStarted && (
        <Button
          variant="contained"
          fullWidth
          size="small"
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrow sx={{ fontSize: 16 }} />}
          onClick={handleStart}
          disabled={loading || !onStartIntervention}
          sx={{ mb: 2, textTransform: 'none', fontSize: '0.75rem' }}
        >
          Démarrer l'intervention
        </Button>
      )}

      {error && <Alert severity="error" sx={{ fontSize: '0.6875rem', mb: 1.5 }}>{error}</Alert>}

      {/* Vertical stepper */}
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}>
        {/* Step 1: Inspection */}
        <Step completed={inspectionDone}>
          <StepLabel
            StepIconProps={{ sx: { fontSize: 20 } }}
            icon={inspectionDone ? <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} /> : <InspectIcon sx={{ fontSize: 20 }} />}
          >
            Inspection
          </StepLabel>
          <StepContent>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 1 }}>
              Prenez les photos avant intervention et notez les observations.
            </Typography>
            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e, 'before')}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<CameraAlt sx={{ fontSize: 14 }} />}
              onClick={() => beforeInputRef.current?.click()}
              disabled={loading || !onUploadPhotos}
              sx={{ textTransform: 'none', fontSize: '0.6875rem', mb: 0.5 }}
            >
              Photos avant
            </Button>
          </StepContent>
        </Step>

        {/* Step 2: Room validation */}
        <Step completed={roomsDone}>
          <StepLabel
            icon={roomsDone ? <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} /> : <MeetingRoom sx={{ fontSize: 20 }} />}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Validation pièces
              {(() => { const c = validatedRooms.size === totalRooms ? '#4A9B8E' : '#757575'; return (
              <Chip
                label={`${validatedRooms.size}/${totalRooms}`}
                size="small"
                sx={{ fontSize: '0.5625rem', height: 18, fontWeight: 600, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px', '& .MuiChip-label': { px: 0.75 } }}
              />
              ); })()}
            </Box>
          </StepLabel>
          <StepContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {roomNames.map((name, i) => (
                <FormControlLabel
                  key={i}
                  control={
                    <Checkbox
                      checked={validatedRooms.has(i)}
                      size="small"
                      disabled={!isStarted}
                      sx={{ p: 0.25 }}
                    />
                  }
                  label={<Typography sx={{ fontSize: '0.6875rem' }}>{name}</Typography>}
                  sx={{ ml: 0, mr: 0 }}
                />
              ))}
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: After photos */}
        <Step completed={photosDone}>
          <StepLabel
            icon={photosDone ? <CheckCircle sx={{ fontSize: 20, color: 'success.main' }} /> : <CameraAlt sx={{ fontSize: 20 }} />}
          >
            Photos après & finalisation
          </StepLabel>
          <StepContent>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 1 }}>
              Prenez les photos après intervention, puis finalisez.
            </Typography>
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e, 'after')}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CameraAlt sx={{ fontSize: 14 }} />}
                onClick={() => afterInputRef.current?.click()}
                disabled={loading || !onUploadPhotos}
                sx={{ textTransform: 'none', fontSize: '0.6875rem' }}
              >
                Photos après
              </Button>
              <Button
                variant="contained"
                size="small"
                color="success"
                startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 14 }} />}
                onClick={handleComplete}
                disabled={loading || !onCompleteIntervention || isCompleted}
                sx={{ textTransform: 'none', fontSize: '0.6875rem' }}
              >
                Terminer
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>

      {/* Completed banner */}
      {isCompleted && (
        <Alert severity="success" sx={{ mt: 2, fontSize: '0.6875rem' }}>
          Intervention terminée — en attente de validation
        </Alert>
      )}
    </Box>
  );
};

export default PanelInterventionProgress;
