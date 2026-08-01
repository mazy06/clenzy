import React, { useState, useCallback, useRef } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert, CircleCheck } from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import { Checkbox, Field, FieldLabel, Progress } from '../../../components/ui';
import { Stepper, Step, StepLabel } from '../../../components/ui';
import {
  PlayArrow,
  CheckCircle,
  CameraAlt,
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

// Le <Step> du kit clone ses enfants pour leur injecter `index` : ce conteneur
// l'absorbe, sinon l'attribut atterrirait tel quel sur le DOM. Il remplace le
// StepContent de MUI, decale sous la pastille de l'etape.
const StepBody: React.FC<{ index?: number; children: React.ReactNode }> = ({ children }) => (
  <div className="ms-[30px] mb-1.5">{children}</div>
);

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
        <Progress value={progress} className="h-1.5 rounded-full" />
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
      {/* Les icones metier des etapes disparaissent : la pastille du kit porte
          deja le numero, et la coche quand l'etape est franchie. */}
      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 1: Inspection */}
        <Step>
          <StepLabel>Inspection</StepLabel>
          <StepBody>
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
          </StepBody>
        </Step>

        {/* Step 2: Room validation */}
        <Step>
          <StepLabel>
            <span className="inline-flex items-center gap-0.5">
              Validation pièces
              {(() => { const c = validatedRooms.size === totalRooms ? '#4A9B8E' : '#757575'; return (
              <StatusChip size="sm" tokens={{ color: c, bg: `${c}18` }} label={`${validatedRooms.size}/${totalRooms}`} className="text-[0.5625rem]" />
              ); })()}
            </span>
          </StepLabel>
          <StepBody>
            <div className="flex flex-col gap-1">
              {roomNames.map((name, i) => (
                <Field key={i} orientation="horizontal" className="w-auto gap-2">
                  <Checkbox
                    id={`room-validated-${i}`}
                    checked={validatedRooms.has(i)}
                    disabled={!isStarted}
                  />
                  <FieldLabel htmlFor={`room-validated-${i}`} className="flex-none font-normal text-[0.6875rem]">
                    {name}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </StepBody>
        </Step>

        {/* Step 3: After photos */}
        <Step>
          <StepLabel>Photos après &amp; finalisation</StepLabel>
          <StepBody>
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
          </StepBody>
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
