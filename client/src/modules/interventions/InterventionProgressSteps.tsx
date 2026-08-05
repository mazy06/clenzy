import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Badge, Button, Item } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
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
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  CheckCircle as EmailSentIcon,
  ErrorOutline as EmailFailedIcon,
} from '../../icons';
import type { InterventionDetailsData, PropertyDetails } from './interventionUtils';
import PhotoGallery from '../../components/PhotoGallery';
import { useTranslation } from '../../hooks/useTranslation';
import { useGenerationsByReference } from '../documents/hooks/useDocuments';
import { documentsApi, type DocumentGeneration } from '../../services/api/documentsApi';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PhotoProps {
  beforePhotos: string[];
  afterPhotos: string[];
  beforePhotoIds: number[];
  afterPhotoIds: number[];
  deletingPhotoId: number | null;
  handleDeletePhoto: (photoId: number) => void;
  setPhotoType: (type: 'before' | 'after') => void;
  setPhotosDialogOpen: (open: boolean) => void;
}

interface RoomProps {
  propertyDetails: PropertyDetails | null;
  getTotalRooms: () => number;
  getRoomNames: () => string[];
  validatedRooms: Set<number>;
  allRoomsValidated: boolean;
  handleRoomValidation: (roomIndex: number) => void;
}

interface StepProps {
  inspectionComplete: boolean;
  setInspectionComplete: (value: boolean) => void;
  completedSteps: Set<string>;
  setCompletedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
  getStepNote: (step: 'inspection' | 'rooms' | 'after_photos') => string;
  handleOpenNotesDialog: (step: 'inspection' | 'rooms' | 'after_photos') => void;
}

interface ProgressProps {
  calculateProgress: () => number;
  areAllStepsCompleted: boolean;
  canUpdateProgress: boolean;
  handleUpdateProgressValue: (progress: number) => void;
}

interface InterventionProgressStepsProps {
  intervention: InterventionDetailsData;
  photos: PhotoProps;
  rooms: RoomProps;
  steps: StepProps;
  progress: ProgressProps;
  handleStartIntervention: () => void;
  handleCompleteIntervention: () => void;
  handleReopenIntervention: () => void;
  starting: boolean;
  completing: boolean;
  canStartIntervention: boolean;
  canStartOrUpdateIntervention: boolean;
  isBeforeScheduledDate: boolean;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const roomChipClass = [
  'h-8 text-[0.8125rem] font-medium',
  'transition-all duration-150 hover:-translate-y-px hover:shadow-sm',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ');

/** Note d'étape : encart en retrait DANS la carte d'étape, d'où le fond sourd. */
const noteBoxClass = 'p-[9px] bg-muted/50 rounded-lg border border-solid border-border';

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
  <div className="flex items-start gap-0 mb-3 relative">
    {steps.map((step, idx) => {
      const isActive = activeStep === step.id;
      return (
        <React.Fragment key={step.id}>
          {idx > 0 && (
            <div className={cn('flex-1 h-[2px] mt-[10.5px]', step.completed ? 'bg-success' : 'bg-border')} style={{ transition: 'background-color 0.3s' }} />
          )}
          <div className={cn('flex flex-col items-center min-w-[80px] max-w-[120px]', step.locked ? 'cursor-default' : 'cursor-pointer', step.locked ? 'opacity-40' : 'opacity-100')} style={{ transition: 'opacity 0.2s' }} onClick={() => !step.locked && onStepClick(step.id)}>
            <div className={cn(
              'w-[28px] h-[28px] rounded-full flex items-center justify-center mb-[3px] transition-all duration-200',
              // Aplats : teinte vive, jamais l'encre `-ink` (réservée au texte).
              step.completed ? 'bg-success' : isActive ? 'bg-primary' : 'bg-muted',
              step.completed || isActive ? 'text-primary-foreground' : 'text-muted-foreground',
              isActive && !step.completed && 'shadow-[0_0_0_3px_var(--bui-primary-soft)]',
            )}>
              {step.completed ? (
                <CheckCircleIcon size={18} strokeWidth={1.75} />
              ) : step.locked ? (
                <LockIcon size={14} strokeWidth={1.75} />
              ) : (
                <span className="text-xs font-bold tabular-nums">
                  {step.id + 1}
                </span>
              )}
            </div>
            {/* Le libellé est du TEXTE : encre `-ink` pour l'étape faite. */}
            <span className={cn('text-2xs text-center leading-[1.2] px-[1.5px]', isActive ? 'font-bold' : 'font-medium', isActive ? 'text-primary' : step.completed ? 'text-success-ink' : 'text-muted-foreground')}>
              {step.label}
            </span>
          </div>
        </React.Fragment>
      );
    })}
  </div>
);

const handleDownloadPdf = async (doc: DocumentGeneration) => {
  await documentsApi.downloadGeneration(doc.id, doc.fileName);
};

const recapCardClass = [
  'p-[15px] rounded-xl bg-card',
  'border border-solid border-success/30',
  'transition-[border-color] duration-200 hover:border-success/60 motion-reduce:transition-none',
].join(' ');

// Le breakpoint `sm` de MUI vaut 600px (non configure), pas les 640px de Tailwind.
// Rendu par `Item variant="outline"` : ne restent ici que la direction
// responsive et l'affordance de survol, que le primitif ne porte pas.
const docCardClass = [
  'flex-col items-start gap-[9px] min-[600px]:flex-row min-[600px]:items-center min-[600px]:gap-[6px]',
  'justify-between p-3 rounded-xl bg-card cursor-pointer',
  'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
  'hover:border-foreground/20 hover:shadow-sm',
].join(' ');

// ─── Component ──────────────────────────────────────────────────────────────

const InterventionProgressSteps: React.FC<InterventionProgressStepsProps> = ({
  intervention,
  photos,
  rooms,
  steps: stepProps,
  progress: progressProps,
  handleStartIntervention,
  handleCompleteIntervention,
  handleReopenIntervention,
  starting,
  completing,
  canStartIntervention,
  canStartOrUpdateIntervention,
  isBeforeScheduledDate,
}) => {
  // Destructure grouped props for internal usage
  const { beforePhotos, afterPhotos, beforePhotoIds, afterPhotoIds, deletingPhotoId, handleDeletePhoto, setPhotoType, setPhotosDialogOpen } = photos;
  const { propertyDetails, getTotalRooms, getRoomNames, validatedRooms, allRoomsValidated, handleRoomValidation } = rooms;
  const { inspectionComplete, setInspectionComplete, completedSteps, setCompletedSteps, getStepNote, handleOpenNotesDialog } = stepProps;
  const { calculateProgress, areAllStepsCompleted, canUpdateProgress, handleUpdateProgressValue } = progressProps;

  const { t } = useTranslation();
  const progress = calculateProgress();
  const isComplete = progress === 100;

  // Fetch documents for this intervention
  const { data: documents = [] } = useGenerationsByReference('INTERVENTION', Number(intervention.id));

  // PDF preview dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');

  const handleViewPdf = async (doc: DocumentGeneration) => {
    setPdfLoading(true);
    setPdfDialogOpen(true);
    setPdfFileName(doc.fileName);
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/documents/generations/${doc.id}/download`;
      const token = getAccessToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const blob = await response.blob();
      setPdfUrl(window.URL.createObjectURL(blob));
    } catch {
      setPdfUrl(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePdfDialog = () => {
    setPdfDialogOpen(false);
    if (pdfUrl) {
      window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  // Detect reopened state: intervention was reopened if all rooms validated
  // and after photos exist but the step is not marked complete
  const isReopened = inspectionComplete && allRoomsValidated
    && afterPhotos.length > 0 && !completedSteps.has('after_photos');

  // After reopen: auto-restore 'after_photos' step since photos are still present.
  // Backend auto-completion is removed, so 100% progress won't auto-complete.
  // This allows the "Terminer" button to be enabled on the recap step.
  useEffect(() => {
    if (isReopened) {
      setCompletedSteps(prev => {
        const next = new Set(prev);
        next.add('after_photos');
        return next;
      });
    }
  }, [isReopened, setCompletedSteps]);

  // Auto-select the current active step
  const getDefaultStep = useCallback((): StepId => {
    if (isComplete) return 3;
    // After reopen: go directly to recap
    if (isReopened) return 3;
    if (allRoomsValidated) return 2;
    if (inspectionComplete) return 1;
    return 0;
  }, [isComplete, isReopened, allRoomsValidated, inspectionComplete]);
  const [activeStep, setActiveStep] = useState<StepId>(getDefaultStep);

  // Sync active step when completion state changes (e.g. on navigation back)
  useEffect(() => {
    setActiveStep(getDefaultStep());
  }, [getDefaultStep]);

  const showRoomData = canUpdateProgress || intervention?.status === 'COMPLETED';
  const totalRooms = showRoomData ? getTotalRooms() : 0;
  const roomNames = showRoomData ? getRoomNames() : [];

  // Recap is accessible once inspection + rooms are done (after_photos not required to VIEW recap)
  const canAccessRecap = inspectionComplete && allRoomsValidated;

  const steps: StepDef[] = [
    { id: 0, label: t('interventions.progressSteps.inspection'), completed: inspectionComplete, active: !inspectionComplete, locked: false },
    { id: 1, label: t('interventions.progressSteps.rooms'), completed: allRoomsValidated, active: inspectionComplete && !allRoomsValidated, locked: !inspectionComplete },
    { id: 2, label: t('interventions.progressSteps.photos'), completed: completedSteps.has('after_photos'), active: allRoomsValidated && !completedSteps.has('after_photos'), locked: !allRoomsValidated },
    { id: 3, label: t('interventions.progressSteps.recap'), completed: isComplete, active: false, locked: !canAccessRecap },
  ];

  // ── Step content renderers ────────────────────────────────────────────

  const renderInspection = () => (
    <div>
      <p className="text-xs font-semibold mb-1.5">
        {t('interventions.progressSteps.inspectionTitle')}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {t('interventions.progressSteps.inspectionDescription')}
      </p>

      {beforePhotos.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground flex items-center gap-0.5 mb-1.5">
            <span className={cn('inline-flex', inspectionComplete ? 'text-success' : 'text-muted-foreground')}><CheckCircleOutlineIcon size={16} strokeWidth={1.75} /></span>
            {t('interventions.progressSteps.beforePhotosCount', { count: beforePhotos.length })}
          </p>
          <PhotoGallery
            photos={beforePhotos}
            photoIds={beforePhotoIds}
            columns={4}
            onDelete={!inspectionComplete ? handleDeletePhoto : undefined}
            deletingPhotoId={deletingPhotoId}
          />
        </div>
      )}

      {getStepNote('inspection') && (
        <div className="mb-3">
          <span className="text-xs font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {getStepNote('inspection')}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outline" size="sm"
          onClick={() => { setPhotoType('before'); setPhotosDialogOpen(true); }}>
          <PhotoCameraIcon size={18} strokeWidth={1.75} />
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => handleOpenNotesDialog('inspection')}>
          <CommentIcon size={18} strokeWidth={1.75} />
          {getStepNote('inspection') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
        {!inspectionComplete && beforePhotos.length > 0 && (
          // Seule action qui fait AVANCER l'etape : elle domine les deux autres.
          <Button variant="default" size="sm" className="animate-pulse motion-reduce:animate-none"
          onClick={() => {
            setInspectionComplete(true);
            setCompletedSteps(prev => new Set(prev).add('inspection'));
            // Calculate progress with inspectionComplete=true (not yet in state)
            const totalRooms = rooms.getTotalRooms();
            const totalSteps = 2 + totalRooms;
            let completed = 1; // inspection is now complete
            completed += rooms.validatedRooms.size;
            if (stepProps.completedSteps.has('after_photos') && photos.afterPhotos.length > 0) completed++;
            const newProgress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0;
            handleUpdateProgressValue(newProgress);
            setActiveStep(1);
          }}>
            <CheckCircleOutlineIcon size={18} strokeWidth={1.75} />
            {t('interventions.progressSteps.validateInspection')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderRooms = () => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold">
          {t('interventions.progressSteps.roomValidation')}
        </p>
        {totalRooms > 0 && (
          <StatusChip
            tone={allRoomsValidated ? 'ok' : 'accent'}
            label={`${validatedRooms.size}/${totalRooms}`}
            className="h-6 text-[0.75rem]"
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t('interventions.progressSteps.roomValidationDesc')}
      </p>

      <div className="flex flex-wrap gap-1 mb-3">
        {roomNames.map((name, idx) => {
          const validated = validatedRooms.has(idx);
          return (
            <StatusChip
              key={name}
              tone="ok"
              // La piece se COCHE : puce de selection (bordure au repos, teinte
              // une fois validee), et non un statut subi.
              outlined
              selected={validated}
              pressed={validated}
              icon={validated
                ? <CheckCircleOutlineIcon size={18} strokeWidth={1.75} />
                : <RoomIcon size={18} strokeWidth={1.75} />}
              label={name}
              pill
              onClick={() => handleRoomValidation(idx)}
              className={roomChipClass}
            />
          );
        })}
      </div>

      {getStepNote('rooms') && (
        <div className="mb-3">
          <span className="text-xs font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {getStepNote('rooms')}
            </p>
          </div>
        </div>
      )}

      <Button variant="outline" size="sm"
        onClick={() => handleOpenNotesDialog('rooms')}>
        <CommentIcon size={18} strokeWidth={1.75} />
        {getStepNote('rooms') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
      </Button>
    </div>
  );

  const renderPhotos = () => (
    <div>
      <p className="text-xs font-semibold mb-1.5">
        {t('interventions.progressSteps.afterPhotosTitle')}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {t('interventions.progressSteps.afterPhotosDesc')}
      </p>

      {afterPhotos.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground flex items-center gap-0.5 mb-1.5">
            <span className="inline-flex text-success"><CheckCircleOutlineIcon size={16} strokeWidth={1.75} /></span>
            {t('interventions.progressSteps.afterPhotosCount', { count: afterPhotos.length })}
          </p>
          <PhotoGallery
            photos={afterPhotos}
            photoIds={afterPhotoIds}
            columns={4}
            onDelete={handleDeletePhoto}
            deletingPhotoId={deletingPhotoId}
          />
        </div>
      )}

      {getStepNote('after_photos') && (
        <div className="mb-3">
          <span className="text-xs font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {getStepNote('after_photos')}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outline" size="sm"
          onClick={() => { setPhotoType('after'); setPhotosDialogOpen(true); }}>
          <PhotoCameraIcon size={18} strokeWidth={1.75} />
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outline" size="sm"
          onClick={() => handleOpenNotesDialog('after_photos')}>
          <CommentIcon size={18} strokeWidth={1.75} />
          {getStepNote('after_photos') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
      </div>
    </div>
  );

  const renderRecap = () => (
    <div>
      <p className="text-xs font-semibold mb-3.5">
        {t('interventions.progressSteps.recapTitle')}
      </p>

      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr_1fr] gap-[15px]">
        {/* Inspection */}
        <div className={recapCardClass}>
          <div className="flex items-center gap-[4.5px] mb-[9px]">
            <span className="inline-flex text-success"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs font-semibold">{t('interventions.progressSteps.recapInspection')}</p>
          </div>
          {beforePhotos.length > 0 && (
            <span className="text-xs text-muted-foreground block mb-1.5">
              {t('interventions.progressSteps.beforePhotosShort', { count: beforePhotos.length })}
            </span>
          )}
          {getStepNote('inspection') && (
            <span className="text-xs text-muted-foreground block italic mb-1.5">
              "{getStepNote('inspection').substring(0, 60)}{getStepNote('inspection').length > 60 ? '...' : ''}"
            </span>
          )}
          {beforePhotos.length > 0 && (
            <div className="mt-0.5">
              <PhotoGallery photos={beforePhotos} columns={3} />
            </div>
          )}
        </div>

        {/* Rooms */}
        <div className={recapCardClass}>
          <div className="flex items-center gap-[4.5px] mb-[9px]">
            <span className="inline-flex text-success"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs font-semibold">{t('interventions.progressSteps.recapRooms', { validated: validatedRooms.size, total: totalRooms })}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {roomNames.map((name, idx) => (
              validatedRooms.has(idx) && (
                <Badge variant="success" className="h-[28px] text-[0.75rem]" key={name}><CheckCircleOutlineIcon size={18} strokeWidth={1.75} />{name}</Badge>
              )
            ))}
          </div>
          {getStepNote('rooms') && (
            <span className="text-xs text-muted-foreground block mt-1.5 italic">
              "{getStepNote('rooms').substring(0, 60)}{getStepNote('rooms').length > 60 ? '...' : ''}"
            </span>
          )}
        </div>

        {/* Photos */}
        <div className={recapCardClass}>
          <div className="flex items-center gap-[4.5px] mb-[9px]">
            <span className="inline-flex text-success"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs font-semibold">{t('interventions.progressSteps.recapAfterPhotos')}</p>
          </div>
          {afterPhotos.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground block mb-1.5">
                {t('interventions.progressSteps.afterPhotosShort', { count: afterPhotos.length })}
              </span>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </>
          )}
          {getStepNote('after_photos') && (
            <span className="text-xs text-muted-foreground block mt-1.5 italic">
              "{getStepNote('after_photos').substring(0, 60)}{getStepNote('after_photos').length > 60 ? '...' : ''}"
            </span>
          )}
        </div>
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-[4.5px] mb-3">
            <span className="inline-flex text-primary"><DescriptionIcon size={18} strokeWidth={1.75} /></span>
            <p className="text-xs font-semibold">
              {t('interventions.progressSteps.documents', { count: documents.length })}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => {
              const hasFile = !!doc.fileName;
              return (
                <Item key={doc.id} variant="outline" className={docCardClass} onClick={() => hasFile && handleViewPdf(doc)}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-[40px] h-[40px] rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                      <span className="inline-flex text-primary"><DescriptionIcon size={22} strokeWidth={1.75} /></span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate mb-0.5">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary" className="h-[22px] text-[0.675rem] font-medium">{doc.documentType.replace(/_/g, ' ')}</Badge>
                        {doc.emailStatus === 'SENT' && (
                          <Badge variant="info" className="h-[22px] text-[0.675rem]"><EmailSentIcon size={14} strokeWidth={1.75} />{doc.emailTo}</Badge>
                        )}
                        {doc.emailStatus === 'FAILED' && (
                          <Badge variant="destructive" className="h-[22px] text-[0.675rem]"><EmailFailedIcon size={14} strokeWidth={1.75} />{t('interventions.progressSteps.emailFailed')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasFile && (
                    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="xs" variant="outline"
                        onClick={() => handleViewPdf(doc)}>
                        <VisibilityIcon size={18} strokeWidth={1.75} />
                        {t('interventions.progressSteps.viewPdf')}
                      </Button>
                      <Button size="xs" variant="ghost" className="text-muted-foreground"
                        onClick={() => handleDownloadPdf(doc)}>
                        <DownloadIcon size={18} strokeWidth={1.75} />
                        {t('interventions.progressSteps.download')}
                      </Button>
                    </div>
                  )}
                </Item>
              );
            })}
          </div>
        </div>
      )}

      {/* Complete intervention button */}
      {intervention.status !== 'COMPLETED' && (
        <div className="mt-5 text-center">
          {/* Unique action de la zone et aboutissement du parcours : elle reste en
              encre pleine (`default`). La teinte `success` de MUI n'est pas reportee —
              le kit n'a pas de variante succes et l'etat "termine" est deja porte par
              l'icone et le libelle. */}
          <Button variant="default" size="lg"
            className={cn('px-6', areAllStepsCompleted && !completing && 'animate-pulse motion-reduce:animate-none')}
            onClick={handleCompleteIntervention}
            disabled={!areAllStepsCompleted || completing}>
            <DoneIcon size={18} strokeWidth={1.75} />
            {completing ? t('interventions.progressSteps.completing') : t('interventions.progressSteps.complete')}
          </Button>
        </div>
      )}
    </div>
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
      {/* ── Stepper + Content ────────────────────────────────────── */}
      {canUpdateProgress && propertyDetails && (
        <>
          <StepperHeader steps={steps} activeStep={activeStep} onStepClick={(id) => setActiveStep(id)} />

          <div className="p-3.5 rounded-xl border border-border bg-card min-h-[120px]">
            {renderStepContent()}
          </div>
        </>
      )}

      {/* ── Start CTA ────────────────────────────────────────────── */}
      {(canStartIntervention || (isBeforeScheduledDate && intervention?.status === 'PENDING')) && (
        <div className={cn('mt-3 p-[15px] rounded-xl border border-solid text-center', isBeforeScheduledDate ? 'bg-warning-soft border-warning/30' : 'bg-primary-soft border-primary/30')}>
          {isBeforeScheduledDate && intervention?.scheduledDate && (
            <>
              {/* Encre `-ink` : le libellé est du texte sur un fond pastel. */}
              <p className="text-xs font-semibold mb-1.5 text-warning-ink">
                Planifiee pour le{' '}
                {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <span className="text-xs text-muted-foreground mb-3 block">
                Le demarrage sera possible a partir de cette date.
              </span>
            </>
          )}
          {!isBeforeScheduledDate && (
            <>
              <span className="inline-flex text-primary mb-1.5"><RocketIcon size={32} strokeWidth={1.5} /></span>
              <p className="text-xs text-muted-foreground mb-3">
                {t('interventions.progressSteps.startDescription')}
              </p>
            </>
          )}
          <Button variant="default" size="lg" className="px-6"
            onClick={handleStartIntervention} disabled={starting || isBeforeScheduledDate}>
            <PlayArrowIcon size={18} strokeWidth={1.75} />
            {starting ? t('interventions.progressSteps.starting') : t('interventions.progressSteps.startIntervention')}
          </Button>
        </div>
      )}

      {/* ── Reopen CTA + Recap when COMPLETED ─────────────────────── */}
      {intervention?.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <>
          <div className="mt-[15px] p-[15px] rounded-xl bg-warning-soft border border-solid border-warning/30 flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-[36px] h-[36px] rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
                <CheckCircleIcon size={20} strokeWidth={1.75} />
              </div>
              <p className="text-xs text-muted-foreground leading-[1.5]">
                {t('interventions.progressSteps.completedMessage')}
              </p>
            </div>
            {/* Rouvrir revient en arriere sur une intervention close : action a poids
                mesure, teintee avertissement plutot qu'encre pleine. */}
            <Button variant="outline" size="lg"
              className="shrink-0 whitespace-nowrap text-warning-ink border-warning hover:bg-warning-soft"
              onClick={handleReopenIntervention} disabled={completing}>
              <ReplayIcon size={18} strokeWidth={1.75} />
              {completing ? t('interventions.progressSteps.reopening') : t('interventions.progressSteps.reopen')}
            </Button>
          </div>

          {/* Recap visible when completed */}
          <div className="mt-[18px] p-0 min-[600px]:p-0">
            {renderRecap()}
          </div>
        </>
      )}

      {/* ── Photos avant standalone ──────────────────────────────── */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && activeStep !== 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold mb-1.5">{t('interventions.detail.beforePhotosStandalone')}</p>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </div>
      )}

      {/* ── PDF Preview Dialog ──────────────────────────────────── */}
      <Dialog open={pdfDialogOpen} onOpenChange={(next) => { if (!next) handleClosePdfDialog(); }}>
        <DialogContent className="max-w-[900px] h-[85vh] rounded-[12px] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-4 py-2.5">
          <DialogTitle className="text-[0.9375rem] font-semibold">
            {pdfFileName || t('interventions.progressSteps.pdfPreview', 'Apercu du document')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col flex-1 overflow-hidden">
          {pdfLoading ? (
            <div className="flex justify-center items-center flex-1">
              <Spinner className="size-10" />
            </div>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <div className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-3">
                  {t('interventions.progressSteps.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </p>
                <Button asChild variant="default">
                  <a href={pdfUrl} download={pdfFileName || 'document.pdf'}>
                    <DownloadIcon size={18} strokeWidth={1.75} />
                    {t('interventions.progressSteps.download')}
                  </a>
                </Button>
              </div>
            </object>
          ) : (
            <div className="p-4 text-center">
              <Alert variant="destructive" className="text-[0.8125rem]">
                <TriangleAlert />
                <AlertDescription>{t('interventions.progressSteps.pdfLoadError', 'Erreur lors du chargement du PDF')}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
        {/* mx-0/mb-0 : le pied de modale deborde de 16 px par defaut pour
            compenser le padding du contenu, ici mis a zero. */}
        <DialogFooter className="mx-0 mb-0 px-3 py-2.5">
          <Button variant="ghost" size="sm" onClick={handleClosePdfDialog}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InterventionProgressSteps;
