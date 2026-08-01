import React, { useState, useCallback, useRef } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import { LinearProgress, Stepper, Step, StepLabel, StepContent, Checkbox, FormControlLabel } from '@mui/material';
import {
  PlayArrow,
  CheckCircle,
  CameraAlt,
  MeetingRoom,
  Search as InspectIcon,
} from '../../../icons';
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

  // Hooks must run unconditionally in the same order every render (rules-of-hooks):
  // they are declared before the early return below.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const numericId = intervention?.id;

  const handleStart = useCallback(async () => {
    if (!onStartIntervention || numericId == null) return;
    setLoading(true);
    setError(null);
    const result = await onStartIntervention(numericId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [numericId, onStartIntervention]);

  const handleComplete = useCallback(async () => {
    if (!onCompleteIntervention || numericId == null) return;
    setLoading(true);
    setError(null);
    const result = await onCompleteIntervention(numericId);
    if (!result.success) setError(result.error);
    setLoading(false);
  }, [numericId, onCompleteIntervention]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    if (!e.target.files?.length || !onUploadPhotos || numericId == null) return;
    setLoading(true);
    setError(null);
    const result = await onUploadPhotos(numericId, Array.from(e.target.files), type);
    if (!result.success) setError(result.error);
    setLoading(false);
    e.target.value = '';
  }, [numericId, onUploadPhotos]);

  if (!intervention) {
    return (
      <Alert variant="info" className="text-[0.75rem]">
        <Info />
        <AlertDescription>Aucune donnée d'intervention disponible</AlertDescription>
      </Alert>
    );
  }

  const completedSteps = parseCompletedSteps(intervention.completedSteps);
  const validatedRooms = parseValidatedRooms(intervention.validatedRooms);

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

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-0.5">
          <p className="cn-text-body1 text-[0.75rem] font-bold">Progression</p>
          {(() => { const c = progress === 100 ? '#4A9B8E' : progress > 0 ? '#0288d1' : '#757575'; return (
          <StatusChip size="sm" tokens={{ color: c, bg: `${c}18` }} label={`${progress}%`} className="h-[20px]" />
          ); })()}
        </div>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </div>

      {/* Start button */}
      {!isStarted && (
        <Button
          variant="default"
          size="sm"
          className="w-full mb-3 shrink"
          onClick={handleStart}
          disabled={loading || !onStartIntervention}
        >
          {loading ? <Spinner className="size-3.5" /> : <PlayArrow size={16} strokeWidth={1.75} />}
          Démarrer l'intervention
        </Button>
      )}

      {error && <Alert variant="destructive" className="text-[0.6875rem] mb-2">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      {/* Vertical stepper */}
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}>
        {/* Step 1: Inspection */}
        <Step completed={inspectionDone}>
          <StepLabel
            StepIconProps={{ sx: { fontSize: 20 } }}
            icon={inspectionDone ? <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={20} strokeWidth={1.75} /></span> : <InspectIcon size={20} strokeWidth={1.75} />}
          >
            Inspection
          </StepLabel>
          <StepContent>
            <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground mb-1.5">
              Prenez les photos avant intervention et notez les observations.
            </p>
            <input
              ref={beforeInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e, 'before')}
            />
            <Button
              variant="outline"
              size="xs"
              className="mb-[3px]"
              onClick={() => beforeInputRef.current?.click()}
              disabled={loading || !onUploadPhotos}
            >
              <CameraAlt size={14} strokeWidth={1.75} />
              Photos avant
            </Button>
          </StepContent>
        </Step>

        {/* Step 2: Room validation */}
        <Step completed={roomsDone}>
          <StepLabel
            icon={roomsDone ? <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={20} strokeWidth={1.75} /></span> : <MeetingRoom size={20} strokeWidth={1.75} />}
          >
            <div className="flex items-center gap-0.5">
              Validation pièces
              {(() => { const c = validatedRooms.size === totalRooms ? '#4A9B8E' : '#757575'; return (
              <StatusChip size="sm" tokens={{ color: c, bg: `${c}18` }} label={`${validatedRooms.size}/${totalRooms}`} className="text-[0.5625rem]" />
              ); })()}
            </div>
          </StepLabel>
          <StepContent>
            <div className="flex flex-col gap-0">
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
                  label={<p className="cn-text-body1 text-[0.6875rem]">{name}</p>}
                  sx={{ ml: 0, mr: 0 }}
                />
              ))}
            </div>
          </StepContent>
        </Step>

        {/* Step 3: After photos */}
        <Step completed={photosDone}>
          <StepLabel
            icon={photosDone ? <span className="inline-flex text-[var(--bui-success-ink)]"><CheckCircle size={20} strokeWidth={1.75} /></span> : <CameraAlt size={20} strokeWidth={1.75} />}
          >
            Photos après & finalisation
          </StepLabel>
          <StepContent>
            <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground mb-1.5">
              Prenez les photos après intervention, puis finalisez.
            </p>
            <input
              ref={afterInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFileUpload(e, 'after')}
            />
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => afterInputRef.current?.click()}
                disabled={loading || !onUploadPhotos}
              >
                <CameraAlt size={14} strokeWidth={1.75} />
                Photos après
              </Button>
              {/* Action qui cloture l'etape : elle garde l'encre pleine face au
                  bouton photo qui l'accompagne. Le kit n'a pas de variante succes,
                  la teinte verte de MUI n'est donc pas reportee. */}
              <Button
                variant="default"
                size="xs"
                onClick={handleComplete}
                disabled={loading || !onCompleteIntervention || isCompleted}
              >
                {loading ? <Spinner className="size-3.5" /> : <CheckCircle size={14} strokeWidth={1.75} />}
                Terminer
              </Button>
            </div>
          </StepContent>
        </Step>
      </Stepper>

      {/* Completed banner */}
      {isCompleted && (
        <Alert variant="success" className="mt-3 text-[0.6875rem]">
          <CircleCheck />
          <AlertDescription>Intervention terminée — en attente de validation</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default PanelInterventionProgress;
