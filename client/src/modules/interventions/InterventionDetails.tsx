import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Build as WrenchIcon,
  PriorityHigh as PriorityHighIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  StopCircle as StopCircleIcon,
} from '../../icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatusChip from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime } from '../../utils/formatUtils';
import { useInterventionDetails } from './useInterventionDetails';
import {
  getStatusLabel,
  getPriorityLabel,
  getPriorityTokens,
} from './interventionUtils';
import InterventionProgressSteps from './InterventionProgressSteps';
import { NotesDialog, PhotosDialog } from './InterventionDialogs';
import WorkOrderDetailLayout, {
  type WorkOrderViewModel,
  type WorkOrderMetric,
  type WorkOrderTimeRow,
} from '../work-orders/WorkOrderDetailLayout';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function InterventionDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const {
    intervention, loading, error, starting, completing,
    notesDialogOpen, notesValue, updatingNotes, currentStepForNotes, stepNotes,
    photosDialogOpen, selectedPhotos, uploadingPhotos, deletingPhotoId, photoType,
    beforePhotoIds, afterPhotoIds,
    propertyDetails, completedSteps, beforePhotos, afterPhotos,
    validatedRooms, inspectionComplete, allRoomsValidated,
    canViewInterventions, canEditInterventions, permissionsLoaded,
    setNotesDialogOpen, setNotesValue, setCurrentStepForNotes,
    setPhotosDialogOpen, setSelectedPhotos, setPhotoType, setError,
    handleStartIntervention, handleCompleteIntervention,
    handleReopenIntervention, handleOpenNotesDialog, handleUpdateNotes,
    handlePhotoUpload, handleDeletePhoto, handleRoomValidation,
    handleUpdateProgressValue,
    canStartOrUpdateIntervention, canStartIntervention, isBeforeScheduledDate, canUpdateProgress,
    areAllStepsCompleted, calculateProgress, getTotalRooms, getRoomNames, getStepNote,
    setCompletedSteps, setInspectionComplete,
    startSuccessMessage, setStartSuccessMessage,
  } = useInterventionDetails(id);

  const photosProps = useMemo(() => ({
    beforePhotos, afterPhotos, beforePhotoIds, afterPhotoIds,
    deletingPhotoId, handleDeletePhoto, setPhotoType, setPhotosDialogOpen,
  }), [beforePhotos, afterPhotos, beforePhotoIds, afterPhotoIds, deletingPhotoId, handleDeletePhoto, setPhotoType, setPhotosDialogOpen]);

  const roomsProps = useMemo(() => ({
    propertyDetails, getTotalRooms, getRoomNames,
    validatedRooms, allRoomsValidated, handleRoomValidation,
  }), [propertyDetails, getTotalRooms, getRoomNames, validatedRooms, allRoomsValidated, handleRoomValidation]);

  const stepsProps = useMemo(() => ({
    inspectionComplete, setInspectionComplete, completedSteps,
    setCompletedSteps, getStepNote, handleOpenNotesDialog,
  }), [inspectionComplete, setInspectionComplete, completedSteps, setCompletedSteps, getStepNote, handleOpenNotesDialog]);

  const progressProps = useMemo(() => ({
    calculateProgress, areAllStepsCompleted: areAllStepsCompleted(),
    canUpdateProgress, handleUpdateProgressValue,
  }), [calculateProgress, areAllStepsCompleted, canUpdateProgress, handleUpdateProgressValue]);

  if (!permissionsLoaded || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canViewInterventions) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>{t('interventions.detail.unauthorized')}</Typography>
          <Typography variant="body2">
            {t('interventions.detail.unauthorizedMessage')}
            <br />{t('interventions.detail.unauthorizedContact')}
          </Typography>
        </Alert>
      </Box>
    );
  }

  // ─── Map Intervention → shared view-model ────────────────────────────────
  const buildViewModel = (): WorkOrderViewModel | null => {
    if (!intervention) return null;

    // Start / end times surfaced as extra KPI tiles (intervention-only fields).
    const extraMetrics: WorkOrderMetric[] = [];
    if (intervention.startTime) {
      extraMetrics.push({
        icon: <PlayCircleOutlineIcon size={18} strokeWidth={1.75} />,
        tone: 'var(--ok)',
        value: formatDateTime(intervention.startTime),
        label: t('interventions.detail.start'),
      });
    }
    if (intervention.endTime) {
      extraMetrics.push({
        icon: <StopCircleIcon size={18} strokeWidth={1.75} />,
        tone: 'var(--err)',
        value: formatDateTime(intervention.endTime),
        label: t('interventions.detail.end'),
      });
    }

    // Start / end times also listed in the time-detail section for completeness.
    const extraTimeRows: WorkOrderTimeRow[] = [];
    if (intervention.startTime) {
      extraTimeRows.push({
        icon: <PlayCircleOutlineIcon size={16} strokeWidth={1.75} />,
        label: t('interventions.detail.start'),
        value: formatDateTime(intervention.startTime),
      });
    }
    if (intervention.endTime) {
      extraTimeRows.push({
        icon: <StopCircleIcon size={16} strokeWidth={1.75} />,
        label: t('interventions.detail.end'),
        value: formatDateTime(intervention.endTime),
      });
    }

    const assignedTypeLabel = intervention.assignedToType === 'team'
      ? t('interventions.detail.teamType')
      : intervention.assignedUserRole
        ? t(`interventions.detail.roles.${intervention.assignedUserRole}`, intervention.assignedUserRole)
        : t('interventions.detail.userType');

    return {
      type: intervention.type,
      status: intervention.status,
      statusLabel: getStatusLabel(intervention.status, t),
      description: intervention.description || undefined,
      estimatedDurationHours: intervention.estimatedDurationHours,
      dueDate: intervention.scheduledDate,
      estimatedCost: intervention.estimatedCost,
      recommendedCost: intervention.recommendedCost,
      actualCost: intervention.actualCost,
      createdAt: intervention.createdAt,
      extraMetrics,
      property: {
        id: intervention.propertyId,
        name: intervention.propertyName,
        address: intervention.propertyAddress,
        city: intervention.propertyCity,
        postalCode: intervention.propertyPostalCode,
        country: intervention.propertyCountry,
        bedroomCount: propertyDetails?.bedroomCount,
        bathroomCount: propertyDetails?.bathroomCount,
      },
      requestor: intervention.requestorName
        ? { name: intervention.requestorName }
        : undefined,
      assignee: {
        name: intervention.assignedToName,
        type: intervention.assignedToType,
        typeLabel: intervention.assignedToName ? assignedTypeLabel : undefined,
      },
      extraTimeRows,
    };
  };

  const vm = buildViewModel();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={intervention?.title || t('interventions.detail.title')}
          subtitle={intervention
            ? `${t('interventions.detail.contextLabel', 'Intervention')} · ${intervention.propertyName}`
            : t('interventions.detail.subtitle')}
          iconBadge={<WrenchIcon />}
          titleAdornment={intervention ? (
            <StatusChip
              color={getPriorityTokens(intervention.priority).color}
              icon={<PriorityHighIcon size={14} strokeWidth={1.75} />}
              label={getPriorityLabel(intervention.priority, t)}
              size="sm"
            />
          ) : undefined}
          backPath="/interventions"
          backLabel={t('interventions.detail.backToList')}
          actions={
            canEditInterventions ? (
              <Button variant="outlined" startIcon={<EditIcon size={18} strokeWidth={1.75} />}
                onClick={() => navigate(`/interventions/${id}/edit`)} size="small"
                title={t('interventions.detail.editButton')}>
                {t('interventions.detail.editButton')}
              </Button>
            ) : undefined
          }
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5, py: 0.75, fontSize: '0.8125rem' }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      {vm && intervention && (
        <WorkOrderDetailLayout
          vm={vm}
          propertyAction={
            <Button
              size="small"
              onClick={() => navigate(`/properties/${intervention.propertyId}`)}
              sx={{ fontSize: '0.6875rem', textTransform: 'none', py: 0, minHeight: 24 }}
            >
              {t('serviceRequests.details.viewProperty')}
            </Button>
          }
          extraSection={
            <Box sx={{ ...workflowCardSx }}>
              <Typography sx={WORKFLOW_TITLE_SX}>
                {t('interventions.detail.workflowTitle', 'Suivi de l\'intervention')}
              </Typography>
              <InterventionProgressSteps
                intervention={intervention}
                photos={photosProps}
                rooms={roomsProps}
                steps={stepsProps}
                progress={progressProps}
                handleStartIntervention={handleStartIntervention}
                handleCompleteIntervention={handleCompleteIntervention}
                handleReopenIntervention={handleReopenIntervention}
                starting={starting}
                completing={completing}
                canStartIntervention={canStartIntervention}
                canStartOrUpdateIntervention={canStartOrUpdateIntervention}
                isBeforeScheduledDate={isBeforeScheduledDate}
              />
            </Box>
          }
        />
      )}

      {/* Dialogs */}
      <NotesDialog
        open={notesDialogOpen}
        onClose={() => { setNotesDialogOpen(false); setNotesValue(''); setCurrentStepForNotes(null); }}
        currentStep={currentStepForNotes}
        notesValue={notesValue}
        onNotesChange={setNotesValue}
        onSubmit={handleUpdateNotes}
        updating={updatingNotes}
        stepNotes={stepNotes}
        onStepNotesChange={() => {
          // Notes state is managed internally by useInterventionNotes;
          // the actual save happens via handleUpdateNotes on dialog submit.
        }}
      />

      <PhotosDialog
        open={photosDialogOpen}
        onClose={() => { if (!uploadingPhotos) { setPhotosDialogOpen(false); setSelectedPhotos([]); } }}
        photoType={photoType}
        selectedPhotos={selectedPhotos}
        onPhotosChange={setSelectedPhotos}
        onSubmit={handlePhotoUpload}
        uploading={uploadingPhotos}
      />

      <Snackbar
        open={!!startSuccessMessage}
        autoHideDuration={6000}
        onClose={() => setStartSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setStartSuccessMessage(null)} sx={{ width: '100%' }}>
          {startSuccessMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Carte hairline plate (.pd-card) hébergeant le suivi interactif de l'intervention.
const workflowCardSx = {
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 2,
  mb: 1.5,
} as const;

const WORKFLOW_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'var(--faint)',
  mb: 1.5,
} as const;
