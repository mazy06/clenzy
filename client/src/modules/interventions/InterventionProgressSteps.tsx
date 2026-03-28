import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert,
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
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Email as EmailIcon,
  CheckCircle as EmailSentIcon,
  ErrorOutline as EmailFailedIcon,
} from '@mui/icons-material';
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

  const handleDownloadPdf = async (doc: DocumentGeneration) => {
    await documentsApi.downloadGeneration(doc.id, doc.fileName);
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
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {t('interventions.progressSteps.inspectionTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('interventions.progressSteps.inspectionDescription')}
      </Typography>

      {beforePhotos.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16, color: inspectionComplete ? 'success.main' : 'text.secondary' }} />
            {t('interventions.progressSteps.beforePhotosCount', { count: beforePhotos.length })}
          </Typography>
          <PhotoGallery
            photos={beforePhotos}
            photoIds={beforePhotoIds}
            columns={4}
            onDelete={!inspectionComplete ? handleDeletePhoto : undefined}
            deletingPhotoId={deletingPhotoId}
          />
        </Box>
      )}

      {getStepNote('inspection') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{t('interventions.detail.notes')}</Typography>
          <Box sx={noteBoxSx}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('inspection')}
            </Typography>
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" startIcon={<PhotoCameraIcon />} sx={actionBtnSx}
          onClick={() => { setPhotoType('before'); setPhotosDialogOpen(true); }}>
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
          onClick={() => handleOpenNotesDialog('inspection')}>
          {getStepNote('inspection') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
        {!inspectionComplete && beforePhotos.length > 0 && (
          <Button variant="contained" size="small" startIcon={<CheckCircleOutlineIcon />} sx={{
            ...actionBtnSx,
            animation: 'pulse 2s infinite',
            '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
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
      </Box>
    </Box>
  );

  const renderRooms = () => (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="body2" fontWeight={600}>
          {t('interventions.progressSteps.roomValidation')}
        </Typography>
        {totalRooms > 0 && (
          <Chip label={`${validatedRooms.size}/${totalRooms}`} size="small"
            color={allRoomsValidated ? 'success' : 'primary'} variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem' }}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('interventions.progressSteps.roomValidationDesc')}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
        {roomNames.map((name, idx) => (
          <Chip key={name}
            icon={validatedRooms.has(idx) ? <CheckCircleOutlineIcon /> : <RoomIcon />}
            label={name} size="small"
            color={validatedRooms.has(idx) ? 'success' : 'primary'}
            variant={validatedRooms.has(idx) ? 'filled' : 'outlined'}
            onClick={() => handleRoomValidation(idx)}
            sx={roomChipSx(false)}
          />
        ))}
      </Box>

      {getStepNote('rooms') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{t('interventions.detail.notes')}</Typography>
          <Box sx={noteBoxSx}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {getStepNote('rooms')}
            </Typography>
          </Box>
        </Box>
      )}

      <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
        onClick={() => handleOpenNotesDialog('rooms')}>
        {getStepNote('rooms') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
      </Button>
    </Box>
  );

  const renderPhotos = () => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {t('interventions.progressSteps.afterPhotosTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('interventions.progressSteps.afterPhotosDesc')}
      </Typography>

      {afterPhotos.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
            {t('interventions.progressSteps.afterPhotosCount', { count: afterPhotos.length })}
          </Typography>
          <PhotoGallery
            photos={afterPhotos}
            photoIds={afterPhotoIds}
            columns={4}
            onDelete={handleDeletePhoto}
            deletingPhotoId={deletingPhotoId}
          />
        </Box>
      )}

      {getStepNote('after_photos') && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{t('interventions.detail.notes')}</Typography>
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
          {t('interventions.progressSteps.addPhotos')}
        </Button>
        <Button variant="outlined" size="small" startIcon={<CommentIcon />} sx={actionBtnSx}
          onClick={() => handleOpenNotesDialog('after_photos')}>
          {getStepNote('after_photos') ? t('interventions.progressSteps.editNote') : t('interventions.progressSteps.addNote')}
        </Button>
      </Box>
    </Box>
  );

  const recapCardSx = {
    p: 2.5,
    borderRadius: 2.5,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'rgba(46, 125, 50, 0.2)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    transition: 'box-shadow 0.2s',
    '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  };

  const docCardSx = {
    display: 'flex',
    alignItems: { xs: 'flex-start', sm: 'center' },
    flexDirection: { xs: 'column', sm: 'row' },
    justifyContent: 'space-between',
    gap: { xs: 1.5, sm: 1 },
    p: 2,
    borderRadius: 2,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'grey.200',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: 'primary.light',
      boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
      bgcolor: 'rgba(25, 118, 210, 0.02)',
    },
  };

  const renderRecap = () => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 2.5 }}>
        {t('interventions.progressSteps.recapTitle')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2.5 }}>
        {/* Inspection */}
        <Box sx={recapCardSx}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>{t('interventions.progressSteps.recapInspection')}</Typography>
          </Box>
          {beforePhotos.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('interventions.progressSteps.beforePhotosShort', { count: beforePhotos.length })}
            </Typography>
          )}
          {getStepNote('inspection') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mb: 1 }}>
              "{getStepNote('inspection').substring(0, 60)}{getStepNote('inspection').length > 60 ? '...' : ''}"
            </Typography>
          )}
          {beforePhotos.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <PhotoGallery photos={beforePhotos} columns={3} />
            </Box>
          )}
        </Box>

        {/* Rooms */}
        <Box sx={recapCardSx}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>{t('interventions.progressSteps.recapRooms', { validated: validatedRooms.size, total: totalRooms })}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {roomNames.map((name, idx) => (
              validatedRooms.has(idx) && (
                <Chip key={name} icon={<CheckCircleOutlineIcon />} label={name} size="small"
                  color="success" variant="filled" sx={{ height: 28, fontSize: '0.75rem' }} />
              )
            ))}
          </Box>
          {getStepNote('rooms') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
              "{getStepNote('rooms').substring(0, 60)}{getStepNote('rooms').length > 60 ? '...' : ''}"
            </Typography>
          )}
        </Box>

        {/* Photos */}
        <Box sx={recapCardSx}>
          <Box display="flex" alignItems="center" gap={0.75} mb={1.5}>
            <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
            <Typography variant="body2" fontWeight={600}>{t('interventions.progressSteps.recapAfterPhotos')}</Typography>
          </Box>
          {afterPhotos.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {t('interventions.progressSteps.afterPhotosShort', { count: afterPhotos.length })}
              </Typography>
              <PhotoGallery photos={afterPhotos} columns={3} />
            </>
          )}
          {getStepNote('after_photos') && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
              "{getStepNote('after_photos').substring(0, 60)}{getStepNote('after_photos').length > 60 ? '...' : ''}"
            </Typography>
          )}
        </Box>
      </Box>

      {/* Documents */}
      {documents.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Box display="flex" alignItems="center" gap={0.75} mb={2}>
            <DescriptionIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="body2" fontWeight={600}>
              {t('interventions.progressSteps.documents', { count: documents.length })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {documents.map((doc) => {
              const hasFile = !!doc.fileName;
              return (
                <Box key={doc.id} sx={docCardSx} onClick={() => hasFile && handleViewPdf(doc)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 1.5,
                      bgcolor: 'rgba(25, 118, 210, 0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <DescriptionIcon sx={{ fontSize: 22, color: 'primary.main' }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ mb: 0.5 }}>
                        {doc.fileName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip label={doc.documentType.replace(/_/g, ' ')} size="small"
                          sx={{ height: 22, fontSize: '0.675rem', fontWeight: 500, bgcolor: 'grey.100' }} />
                        {doc.emailStatus === 'SENT' && (
                          <Chip icon={<EmailSentIcon sx={{ fontSize: '14px !important' }} />}
                            label={doc.emailTo} size="small" color="info" variant="outlined"
                            sx={{ height: 22, fontSize: '0.675rem' }} />
                        )}
                        {doc.emailStatus === 'FAILED' && (
                          <Chip icon={<EmailFailedIcon sx={{ fontSize: '14px !important' }} />}
                            label={t('interventions.progressSteps.emailFailed')} size="small" color="error" variant="outlined"
                            sx={{ height: 22, fontSize: '0.675rem' }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                  {hasFile && (
                    <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Button size="small" variant="outlined" startIcon={<VisibilityIcon />}
                        onClick={() => handleViewPdf(doc)}
                        sx={{
                          textTransform: 'none', fontSize: '0.75rem', minWidth: 0,
                          borderRadius: 1.5, py: 0.5, px: 1.5,
                        }}>
                        {t('interventions.progressSteps.viewPdf')}
                      </Button>
                      <Button size="small" variant="text" startIcon={<DownloadIcon />}
                        onClick={() => handleDownloadPdf(doc)}
                        sx={{
                          textTransform: 'none', fontSize: '0.75rem', minWidth: 0,
                          borderRadius: 1.5, py: 0.5, px: 1.5, color: 'text.secondary',
                        }}>
                        {t('interventions.progressSteps.download')}
                      </Button>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Complete intervention button */}
      {intervention.status !== 'COMPLETED' && (
        <Box sx={{ mt: 3.5, textAlign: 'center' }}>
          <Button variant="contained" color="success" size="large" startIcon={<DoneIcon />}
            onClick={handleCompleteIntervention}
            disabled={!areAllStepsCompleted || completing}
            sx={{
              py: 1.25, px: 4, textTransform: 'none', fontWeight: 600,
              fontSize: '0.875rem', borderRadius: 2,
              boxShadow: '0 2px 8px rgba(46, 125, 50, 0.3)',
              ...(areAllStepsCompleted && !completing ? {
                animation: 'pulse 2s infinite',
                '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.7 } },
              } : {}),
            }}>
            {completing ? t('interventions.progressSteps.completing') : t('interventions.progressSteps.complete')}
          </Button>
        </Box>
      )}
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
      {(canStartIntervention || (isBeforeScheduledDate && intervention?.status === 'PENDING')) && (
        <Box sx={{
          mt: 2, p: 2.5, borderRadius: 2,
          bgcolor: isBeforeScheduledDate ? 'rgba(237, 108, 2, 0.04)' : 'rgba(25, 118, 210, 0.04)',
          border: '1px solid', borderColor: isBeforeScheduledDate ? 'rgba(237, 108, 2, 0.15)' : 'rgba(25, 118, 210, 0.15)',
          textAlign: 'center',
        }}>
          {isBeforeScheduledDate && intervention?.scheduledDate && (
            <>
              <Typography variant="body2" color="warning.main" fontWeight={600} sx={{ mb: 1 }}>
                Planifiee pour le{' '}
                {new Date(intervention.scheduledDate).toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Le demarrage sera possible a partir de cette date.
              </Typography>
            </>
          )}
          {!isBeforeScheduledDate && (
            <>
              <RocketIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('interventions.progressSteps.startDescription')}
              </Typography>
            </>
          )}
          <Button variant="contained" color="primary" startIcon={<PlayArrowIcon />}
            onClick={handleStartIntervention} disabled={starting || isBeforeScheduledDate}
            sx={{
              py: 1.25, px: 4, textTransform: 'none', fontWeight: 600,
              fontSize: '0.875rem', borderRadius: 2,
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
            }}>
            {starting ? t('interventions.progressSteps.starting') : t('interventions.progressSteps.startIntervention')}
          </Button>
        </Box>
      )}

      {/* ── Reopen CTA + Recap when COMPLETED ─────────────────────── */}
      {intervention?.status === 'COMPLETED' && canStartOrUpdateIntervention && (
        <>
          <Box sx={{
            mt: 2.5, p: 2.5, borderRadius: 2.5,
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
                {t('interventions.progressSteps.completedMessage')}
              </Typography>
            </Box>
            <Button variant="contained" color="warning" startIcon={<ReplayIcon />}
              onClick={handleReopenIntervention} disabled={completing}
              sx={{
                py: 1.25, px: 3, fontWeight: 600, textTransform: 'none',
                fontSize: '0.875rem', whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 2,
              }}>
              {completing ? t('interventions.progressSteps.reopening') : t('interventions.progressSteps.reopen')}
            </Button>
          </Box>

          {/* Recap visible when completed */}
          <Box sx={{ mt: 3, p: { xs: 0, sm: 0 } }}>
            {renderRecap()}
          </Box>
        </>
      )}

      {/* ── Photos avant standalone ──────────────────────────────── */}
      {canUpdateProgress && beforePhotos.length > 0 && !inspectionComplete && activeStep !== 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{t('interventions.detail.beforePhotosStandalone')}</Typography>
          <PhotoGallery photos={beforePhotos} columns={3} />
        </Box>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : pdfUrl ? (
            <object
              data={pdfUrl}
              type="application/pdf"
              width="100%"
              style={{ flex: 1, border: 'none', minHeight: 0 }}
            >
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  {t('interventions.progressSteps.pdfNotSupported', 'Votre navigateur ne supporte pas la visualisation PDF.')}
                </Typography>
                <Button variant="contained" href={pdfUrl} download={pdfFileName || 'document.pdf'}
                  startIcon={<DownloadIcon />} sx={{ textTransform: 'none' }}>
                  {t('interventions.progressSteps.download')}
                </Button>
              </Box>
            </object>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
                {t('interventions.progressSteps.pdfLoadError', 'Erreur lors du chargement du PDF')}
              </Alert>
            </Box>
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
