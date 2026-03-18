import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  CircularProgress,
  LinearProgress,
  Snackbar,
} from '@mui/material';
import {
  Edit as EditIcon,
  Build as BuildIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityHighIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Autorenew as AutorenewIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  StopCircle as StopCircleIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  AccessTime as AccessTimeIcon,
  CalendarMonth as CalendarIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useInterventionDetails } from './useInterventionDetails';
import {
  getStatusLabel,
  getStatusHex,
  getPriorityLabel,
  getPriorityHex,
  getTypeLabel,
  getTypeHex,
  formatDate,
  formatDuration,
  formatCurrency,
} from './interventionUtils';
import InterventionProgressSteps from './InterventionProgressSteps';
import { NotesDialog, PhotosDialog } from './InterventionDialogs';

// ─── Helpers ────────────────────────────────────────────────────────────────

const getStatusIcon = (status: string) => {
  const sx = { fontSize: 18 };
  switch (status) {
    case 'PENDING':    return <WarningIcon sx={{ ...sx, color: 'warning.main' }} />;
    case 'IN_PROGRESS': return <AutorenewIcon sx={{ ...sx, color: 'info.main', animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />;
    case 'COMPLETED':  return <CheckCircleIcon sx={{ ...sx, color: 'success.main' }} />;
    case 'CANCELLED':  return <ErrorIcon sx={{ ...sx, color: 'error.main' }} />;
    default:           return <InfoIcon sx={{ ...sx, color: 'info.main' }} />;
  }
};

const StatusChip: React.FC<{ label: string; hex: string; icon?: React.ReactElement }> = ({ label, hex, icon }) => (
  <Chip
    icon={icon}
    label={label}
    size="small"
    sx={{
      height: 26,
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: `${hex}14`,
      color: hex,
      border: `1px solid ${hex}30`,
      borderRadius: '6px',
      '& .MuiChip-icon': { color: hex, ml: 0.5 },
      '& .MuiChip-label': { px: 1 },
    }}
  />
);

const InfoCard: React.FC<{
  icon: React.ReactElement;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  extra?: React.ReactNode;
}> = ({ icon, iconBg, label, value, sub, extra }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1.5,
    p: 1.5,
    borderRadius: 2,
    bgcolor: 'grey.50',
    border: '1px solid',
    borderColor: 'grey.100',
    minHeight: 64,
  }}>
    <Box sx={{
      width: 36, height: 36, borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: iconBg, flexShrink: 0,
    }}>
      {icon}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
          {sub}
        </Typography>
      )}
      {extra}
    </Box>
  </Box>
);

const TimelineItem: React.FC<{ icon: React.ReactElement; label: string; value: string }> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    {icon}
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.3, fontSize: '0.8125rem' }}>
        {value}
      </Typography>
    </Box>
  </Box>
);

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
    canStartOrUpdateIntervention, canStartIntervention, canUpdateProgress,
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

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <PageHeader
        title={t('interventions.detail.title')}
        subtitle={t('interventions.detail.subtitle')}
        backPath="/interventions"
        backLabel={t('interventions.detail.backToList')}
        actions={
          canEditInterventions ? (
            <Button variant="contained" color="primary" startIcon={<EditIcon />}
              onClick={() => navigate(`/interventions/${id}/edit`)} size="small">
              {t('interventions.detail.editButton')}
            </Button>
          ) : undefined
        }
        showBackButton={false}
        showBackButtonWithActions={true}
      />

      {error && <Alert severity="error" sx={{ mb: 2, py: 1 }} onClose={() => setError(null)}>{error}</Alert>}

      {intervention && !loading && (
        <Card sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

          {/* ── Status banner ────────────────────────────────────────── */}
          <Box sx={{
            px: { xs: 2, sm: 3 },
            py: 1.5,
            bgcolor: `${getStatusHex(intervention.status)}08`,
            borderBottom: '1px solid',
            borderColor: `${getStatusHex(intervention.status)}20`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <StatusChip
                icon={getStatusIcon(intervention.status)}
                label={getStatusLabel(intervention.status, t)}
                hex={getStatusHex(intervention.status)}
              />
              <StatusChip
                icon={<BuildIcon sx={{ fontSize: 14 }} />}
                label={getTypeLabel(intervention.type, t)}
                hex={getTypeHex(intervention.type)}
              />
              <StatusChip
                icon={<PriorityHighIcon sx={{ fontSize: 14 }} />}
                label={getPriorityLabel(intervention.priority, t)}
                hex={getPriorityHex(intervention.priority)}
              />
              {/* Inline progress bar */}
              {(() => {
                const progress = progressProps.calculateProgress();
                const isComplete = progress === 100;
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, ml: 0.5 }}>
                    <LinearProgress variant="determinate" value={progress}
                      color={isComplete ? 'success' : 'primary'}
                      sx={{
                        width: 80, height: 5, borderRadius: 3, bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': { borderRadius: 3 },
                      }}
                    />
                    <Typography variant="caption" fontWeight={700}
                      color={isComplete ? 'success.main' : 'primary.main'}
                      sx={{ fontSize: '0.7rem', lineHeight: 1 }}>
                      {progress}%
                    </Typography>
                  </Box>
                );
              })()}
            </Box>

            {/* Timeline dates */}
            <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 3 }, flexWrap: 'wrap' }}>
              <TimelineItem
                icon={<CalendarIcon sx={{ fontSize: 16, color: 'text.secondary' }} />}
                label={t('interventions.detail.planned')}
                value={formatDate(intervention.scheduledDate)}
              />
              {intervention.startTime && (
                <TimelineItem
                  icon={<PlayCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />}
                  label={t('interventions.detail.start')}
                  value={formatDate(intervention.startTime)}
                />
              )}
              {intervention.endTime && (
                <TimelineItem
                  icon={<StopCircleIcon sx={{ fontSize: 16, color: 'error.main' }} />}
                  label={t('interventions.detail.end')}
                  value={formatDate(intervention.endTime)}
                />
              )}
            </Box>
          </Box>

          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>

            {/* ── Description ────────────────────────────────────────── */}
            {intervention.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                {intervention.description}
              </Typography>
            )}

            {/* ── Info grid ──────────────────────────────────────────── */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
              gap: 1.5,
              mb: 2,
            }}>
              <InfoCard
                icon={<LocationIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
                iconBg="rgba(25, 118, 210, 0.1)"
                label={t('interventions.detail.property')}
                value={intervention.propertyName}
                sub={`${intervention.propertyAddress}${intervention.propertyCity ? `, ${intervention.propertyCity}` : ''}`}
              />
              <InfoCard
                icon={<PersonIcon sx={{ fontSize: 18, color: '#2e7d32' }} />}
                iconBg="rgba(46, 125, 50, 0.1)"
                label={t('interventions.detail.requestor')}
                value={intervention.requestorName}
              />
              <InfoCard
                icon={intervention.assignedToType === 'team'
                  ? <GroupIcon sx={{ fontSize: 18, color: '#7b1fa2' }} />
                  : <PersonIcon sx={{ fontSize: 18, color: '#7b1fa2' }} />
                }
                iconBg="rgba(123, 31, 162, 0.1)"
                label={t('interventions.detail.assignedTo')}
                value={intervention.assignedToName}
                extra={
                  <Chip
                    label={intervention.assignedToType === 'team'
                      ? t('interventions.detail.teamType')
                      : intervention.assignedUserRole
                        ? t(`interventions.detail.roles.${intervention.assignedUserRole}`, intervention.assignedUserRole)
                        : t('interventions.detail.userType')}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem', mt: 0.5, '& .MuiChip-label': { px: 0.5 } }}
                  />
                }
              />
              <InfoCard
                icon={<AccessTimeIcon sx={{ fontSize: 18, color: '#ed6c02' }} />}
                iconBg="rgba(237, 108, 2, 0.1)"
                label={t('interventions.detail.estimatedDuration')}
                value={formatDuration(intervention.estimatedDurationHours)}
                sub={intervention.estimatedCost != null ? t('interventions.detail.costLabel', { cost: formatCurrency(intervention.estimatedCost) }) : undefined}
              />
            </Box>

            {/* ── Progression & Steps ────────────────────────────────── */}
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
            />

          </CardContent>
        </Card>
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
