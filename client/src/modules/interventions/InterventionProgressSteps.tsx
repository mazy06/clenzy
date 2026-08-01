import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
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
  'transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-card)]',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ');

const noteBoxClass = 'p-[9px] bg-[var(--surface-2)] rounded-[12px] border border-solid border-[var(--line)]';

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
  <div className="flex items-start gap-0 mb-3 relative">
    {steps.map((step, idx) => {
      const isActive = activeStep === step.id;
      return (
        <React.Fragment key={step.id}>
          {idx > 0 && (
            <div className={cn('flex-1 h-[2px] mt-[10.5px]', step.completed ? 'bg-[var(--ok)]' : 'bg-[var(--line-2)]')} style={{ transition: 'background-color 0.3s' }} />
          )}
          <div className={cn('flex flex-col items-center min-w-[80px] max-w-[120px]', step.locked ? 'cursor-default' : 'cursor-pointer', step.locked ? 'opacity-40' : 'opacity-100')} style={{ transition: 'opacity 0.2s' }} onClick={() => !step.locked && onStepClick(step.id)}>
            <div className={cn(
              'w-[28px] h-[28px] rounded-[50%] flex items-center justify-center mb-[3px] transition-all duration-200',
              step.completed ? 'bg-[var(--ok)]' : isActive ? 'bg-[var(--accent)]' : 'bg-[var(--hover)]',
              step.completed || isActive ? 'text-[var(--on-accent)]' : 'text-[var(--muted)]',
              isActive && !step.completed && 'shadow-[0_0_0_3px_var(--accent-soft)]',
            )}>
              {step.completed ? (
                <CheckCircleIcon size={18} strokeWidth={1.75} />
              ) : step.locked ? (
                <LockIcon size={14} strokeWidth={1.75} />
              ) : (
                <span className="cn-text-caption font-bold text-[0.75rem]">
                  {step.id + 1}
                </span>
              )}
            </div>
            <Typography
              variant="caption"
              fontWeight={isActive ? 700 : 500}
              sx={{ fontSize: '0.7rem', textAlign: 'center', lineHeight: 1.2, px: 0.25, color: isActive ? 'var(--accent)' : step.completed ? 'var(--ok)' : 'var(--muted)' }}
            >
              {step.label}
            </Typography>
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
  'p-[15px] rounded-[14px] bg-[var(--card)]',
  'border border-solid border-[color-mix(in_srgb,var(--ok)_30%,transparent)]',
  'transition-[border-color] duration-200 hover:border-[var(--line-2)] motion-reduce:transition-none',
].join(' ');

// Le breakpoint `sm` de MUI vaut 600px (non configure), pas les 640px de Tailwind.
const docCardClass = [
  'flex flex-col items-start gap-[9px] min-[600px]:flex-row min-[600px]:items-center min-[600px]:gap-[6px]',
  'justify-between p-3 rounded-[14px] bg-[var(--card)] cursor-pointer',
  'border border-solid border-[var(--line)]',
  'transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
  'hover:border-[var(--line-2)] hover:shadow-[var(--shadow-card)]',
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
      <p className="cn-text-body2 font-semibold mb-1.5">
        {t('interventions.progressSteps.inspectionTitle')}
      </p>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('interventions.progressSteps.inspectionDescription')}
      </p>

      {beforePhotos.length > 0 && (
        <div className="mb-3">
          <p className="cn-text-body2 text-muted-foreground flex items-center gap-0.5 mb-1.5">
            <span className={cn('inline-flex', inspectionComplete ? 'text-[var(--ok)]' : 'text-[var(--muted)]')}><CheckCircleOutlineIcon size={16} strokeWidth={1.75} /></span>
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
          <span className="cn-text-caption font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="cn-text-body2 text-muted-foreground whitespace-pre-wrap">
              {getStepNote('inspection')}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon size={18} strokeWidth={1.75} />} sx={actionBtnSx}
          onClick={() => { setPhotoType('before'); setPhotosDialogOpen(true); }}>
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CommentIcon size={18} strokeWidth={1.75} />} sx={actionBtnSx}
          onClick={() => handleOpenNotesDialog('inspection')}>
          {getStepNote('inspection') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
        {!inspectionComplete && beforePhotos.length > 0 && (
          <Button variant="contained" size="small" startIcon={<CheckCircleOutlineIcon size={18} strokeWidth={1.75} />} sx={{
            ...actionBtnSx,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
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
            {t('interventions.progressSteps.validateInspection')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderRooms = () => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="cn-text-body2 font-semibold">
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
      <p className="cn-text-body2 text-muted-foreground mb-3">
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
          <span className="cn-text-caption font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="cn-text-body2 text-muted-foreground whitespace-pre-wrap">
              {getStepNote('rooms')}
            </p>
          </div>
        </div>
      )}

      <Button variant="outlined" size="small" startIcon={<CommentIcon size={18} strokeWidth={1.75} />} sx={actionBtnSx}
        onClick={() => handleOpenNotesDialog('rooms')}>
        {getStepNote('rooms') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
      </Button>
    </div>
  );

  const renderPhotos = () => (
    <div>
      <p className="cn-text-body2 font-semibold mb-1.5">
        {t('interventions.progressSteps.afterPhotosTitle')}
      </p>
      <p className="cn-text-body2 text-muted-foreground mb-3">
        {t('interventions.progressSteps.afterPhotosDesc')}
      </p>

      {afterPhotos.length > 0 && (
        <div className="mb-3">
          <p className="cn-text-body2 text-muted-foreground flex items-center gap-0.5 mb-1.5">
            <span className="inline-flex text-[var(--ok)]"><CheckCircleOutlineIcon size={16} strokeWidth={1.75} /></span>
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
          <span className="cn-text-caption font-semibold block mb-0.5">{t('interventions.detail.notes')}</span>
          <div className={noteBoxClass}>
            <p className="cn-text-body2 text-muted-foreground whitespace-pre-wrap">
              {getStepNote('after_photos')}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon size={18} strokeWidth={1.75} />} sx={actionBtnSx}
          onClick={() => { setPhotoType('after'); setPhotosDialogOpen(true); }}>
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CommentIcon size={18} strokeWidth={1.75} />} sx={actionBtnSx}
          onClick={() => handleOpenNotesDialog('after_photos')}>
          {getStepNote('after_photos') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
      </div>
    </div>
  );

  const renderRecap = () => (
    <div>
      <p className="cn-text-body2 font-semibold mb-3.5">
        {t('interventions.progressSteps.recapTitle')}
      </p>

      <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr_1fr] gap-[15px]">
        {/* Inspection */}
        <div className={recapCardClass}>
          <div className="flex items-center gap-[4.5px] mb-[9px]">
            <span className="inline-flex text-[var(--ok)]"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 font-semibold">{t('interventions.progressSteps.recapInspection')}</p>
          </div>
          {beforePhotos.length > 0 && (
            <span className="cn-text-caption text-muted-foreground block mb-1.5">
              {t('interventions.progressSteps.beforePhotosShort', { count: beforePhotos.length })}
            </span>
          )}
          {getStepNote('inspection') && (
            <span className="cn-text-caption text-muted-foreground block italic mb-1.5">
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
            <span className="inline-flex text-[var(--ok)]"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 font-semibold">{t('interventions.progressSteps.recapRooms', { validated: validatedRooms.size, total: totalRooms })}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {roomNames.map((name, idx) => (
              validatedRooms.has(idx) && (
                <Badge variant="success" className="h-[28px] text-[0.75rem]" key={name}><CheckCircleOutlineIcon size={18} strokeWidth={1.75} />{name}</Badge>
              )
            ))}
          </div>
          {getStepNote('rooms') && (
            <span className="cn-text-caption text-muted-foreground block mt-1.5 italic">
              "{getStepNote('rooms').substring(0, 60)}{getStepNote('rooms').length > 60 ? '...' : ''}"
            </span>
          )}
        </div>

        {/* Photos */}
        <div className={recapCardClass}>
          <div className="flex items-center gap-[4.5px] mb-[9px]">
            <span className="inline-flex text-[var(--ok)]"><CheckCircleIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 font-semibold">{t('interventions.progressSteps.recapAfterPhotos')}</p>
          </div>
          {afterPhotos.length > 0 && (
            <>
              <span className="cn-text-caption text-muted-foreground block mb-1.5">
                {t('interventions.progressSteps.afterPhotosShort', { count: afterPhotos.length })}
              </span>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </>
          )}
          {getStepNote('after_photos') && (
            <span className="cn-text-caption text-muted-foreground block mt-1.5 italic">
              "{getStepNote('after_photos').substring(0, 60)}{getStepNote('after_photos').length > 60 ? '...' : ''}"
            </span>
          )}
        </div>
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-[4.5px] mb-3">
            <span className="inline-flex text-[var(--accent)]"><DescriptionIcon size={18} strokeWidth={1.75} /></span>
            <p className="cn-text-body2 font-semibold">
              {t('interventions.progressSteps.documents', { count: documents.length })}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => {
              const hasFile = !!doc.fileName;
              return (
                <div key={doc.id} className={docCardClass} onClick={() => hasFile && handleViewPdf(doc)}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-[40px] h-[40px] rounded-[1.5px] bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                      <span className="inline-flex text-[var(--accent)]"><DescriptionIcon size={22} strokeWidth={1.75} /></span>
                    </div>
                    <div className="min-w-0">
                      <p className="cn-text-body2 font-semibold truncate mb-0.5">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary" className="h-[22px] text-[0.675rem] font-medium bg-[var(--hover)] text-[var(--muted)]">{doc.documentType.replace(/_/g, ' ')}</Badge>
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
                      <Button size="small" variant="outlined" startIcon={<VisibilityIcon size={18} strokeWidth={1.75} />}
                        onClick={() => handleViewPdf(doc)}
                        sx={{
                          textTransform: 'none', fontSize: '0.75rem', minWidth: 0,
                          borderRadius: 1.5, py: 0.5, px: 1.5,
                        }}>
                        {t('interventions.progressSteps.viewPdf')}
                      </Button>
                      <Button size="small" variant="text" startIcon={<DownloadIcon size={18} strokeWidth={1.75} />}
                        onClick={() => handleDownloadPdf(doc)}
                        sx={{
                          textTransform: 'none', fontSize: '0.75rem', minWidth: 0,
                          borderRadius: 1.5, py: 0.5, px: 1.5, color: 'text.secondary',
                        }}>
                        {t('interventions.progressSteps.download')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Complete intervention button */}
      {intervention.status !== 'COMPLETED' && (
        <div className="mt-5 text-center">
          <Button variant="contained" color="success" size="large" startIcon={<DoneIcon size={18} strokeWidth={1.75} />}
            onClick={handleCompleteIntervention}
            disabled={!areAllStepsCompleted || completing}
            sx={{
              py: 1.25, px: 4, textTransform: 'none', fontWeight: 600,
              fontSize: '0.875rem', borderRadius: 2,
              ...(areAllStepsCompleted && !completing ? {
                animation: 'pulse 2s infinite',
                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              } : {}),
            }}>
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

          <div className="p-3.5 rounded-[14px] border border-[var(--line)] bg-[var(--card)] min-h-[120px]">
            {renderStepContent()}
          </div>
        </>
      )}

      {/* ── Start CTA ────────────────────────────────────────────── */}
      {(canStartIntervention || (isBeforeScheduledDate && intervention?.status === 'PENDING')) && (
        <div className={cn('mt-3 p-[15px] rounded-[14px] border border-solid text-center', isBeforeScheduledDate ? 'bg-[var(--warn-soft)]' : 'bg-[var(--accent-soft)]', isBeforeScheduledDate ? 'border-[color-mix(in_srgb,_var(--warn)_30%,_transparent)]' : 'border-[color-mix(in_srgb,_var(--accent)_30%,_transparent)]')}>
          {isBeforeScheduledDate && intervention?.scheduledDate && (
            <>
              <p className="cn-text-body2 font-semibold mb-1.5 text-[var(--warn)]">
                Planifiee pour le{' '}
                {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <span className="cn-text-caption text-muted-foreground mb-3 block">
                Le demarrage sera possible a partir de cette date.
              </span>
            </>
          )}
          {!isBeforeScheduledDate && (
            <>
              <span className="inline-flex text-[var(--accent)] mb-1.5"><RocketIcon size={32} strokeWidth={1.5} /></span>
              <p className="cn-text-body2 text-muted-foreground mb-3">
                {t('interventions.progressSteps.startDescription')}
              </p>
            </>
          )}
          <Button variant="contained" color="primary" startIcon={<PlayArrowIcon size={18} strokeWidth={1.75} />}
            onClick={handleStartIntervention} disabled={starting || isBeforeScheduledDate}
            sx={{
              py: 1.25, px: 4, textTransform: 'none', fontWeight: 600,
              fontSize: '0.875rem', borderRadius: 2,
            }}>
            {starting ? t('interventions.progressSteps.starting') : t('interventions.progressSteps.startIntervention')}
          </Button>
        </div>
      )}

      {/* ── Reopen CTA + Recap when COMPLETED ─────────────────────── */}
      {intervention?.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <>
          <div className="mt-[15px] p-[15px] rounded-[14px] bg-[var(--warn-soft)] border border-solid border-[color-mix(in_srgb,_var(--warn)_30%,_transparent)] flex flex-col min-[600px]:flex-row items-stretch min-[600px]:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-[36px] h-[36px] rounded-[50%] bg-[var(--ok-soft)] text-[var(--ok)] flex items-center justify-center shrink-0">
                <CheckCircleIcon size={20} strokeWidth={1.75} />
              </div>
              <p className="cn-text-body2 text-muted-foreground leading-[1.5]">
                {t('interventions.progressSteps.completedMessage')}
              </p>
            </div>
            <Button variant="contained" color="warning" startIcon={<ReplayIcon size={18} strokeWidth={1.75} />}
              onClick={handleReopenIntervention} disabled={completing}
              sx={{
                py: 1.25, px: 3, fontWeight: 600, textTransform: 'none',
                fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 2,
              }}>
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
          <p className="cn-text-body2 font-semibold mb-1.5">{t('interventions.detail.beforePhotosStandalone')}</p>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </div>
      )}

      {/* ── PDF Preview Dialog ──────────────────────────────────── */}
      <Dialog
        open={pdfDialogOpen}
        onClose={handleClosePdfDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', height: '85vh' } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 600, py: 1.5 }}>
          {pdfFileName || t('interventions.progressSteps.pdfPreview', 'Apercu du document')}
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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
                <p className="cn-text-body2 text-muted-foreground mb-3">
                  {t('interventions.progressSteps.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </p>
                <Button variant="contained" href={pdfUrl} download={pdfFileName || 'document.pdf'}
                  startIcon={<DownloadIcon size={18} strokeWidth={1.75} />} sx={{ textTransform: 'none' }}>
                  {t('interventions.progressSteps.download')}
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
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={handleClosePdfDialog} sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InterventionProgressSteps;
