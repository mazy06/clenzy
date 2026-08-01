import React, { useMemo } from 'react';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { Info, TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Typography, Button, Snackbar } from '@mui/material';
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
      <div className="flex justify-center py-12">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (!canViewInterventions) {
    return (
      <div className="p-3">
        <BuiAlert variant="info" className="py-1.5">
          <Info />
          <AlertDescription><h6 className="cn-text-subtitle1 font-semibold mb-[0.35em]">{t('interventions.detail.unauthorized')}</h6><p className="cn-text-body2">
            {t('interventions.detail.unauthorizedMessage')}
            <br />{t('interventions.detail.unauthorizedContact')}
          </p></AlertDescription>
        </BuiAlert>
      </div>
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
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0">
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
      </div>

      {error && <BuiAlert variant="destructive" className="mb-2 py-1 text-[0.8125rem]">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
        <AlertAction>
          <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
            <X />
          </BuiButton>
        </AlertAction>
      </BuiAlert>}

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
            <div className="p-3 mb-[9px] rounded-[14px] bg-[var(--card)] shadow-none border border-solid border-[var(--line)]">
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
            </div>
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
        <BuiAlert variant="success" className="w-full">
          <CircleCheck />
          <AlertDescription>{startSuccessMessage}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setStartSuccessMessage(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      </Snackbar>
    </div>
  );
}

const WORKFLOW_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'var(--faint)',
  mb: 1.5,
} as const;
