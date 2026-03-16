import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
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
import { ProgressDialog, NotesDialog, PhotosDialog } from './InterventionDialogs';

const styles = {
  spinIcon: {
    color: 'info.main',
    fontSize: 20,
    animation: 'spin 2s linear infinite',
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
    gap: 2,
  },
  infoItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 1.5,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: 'primary.50',
    flexShrink: 0,
    mt: 0.25,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 1,
    alignItems: 'center',
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: { xs: 1, sm: 2 },
    alignItems: 'center',
  },
} as const;

const getStatusIcon = (status: string) => {
  const iconSx = { fontSize: 20 };
  switch (status) {
    case 'PENDING':
      return <WarningIcon sx={{ color: 'warning.main', ...iconSx }} />;
    case 'IN_PROGRESS':
      return <AutorenewIcon sx={styles.spinIcon} />;
    case 'COMPLETED':
      return <CheckCircleIcon sx={{ color: 'success.main', ...iconSx }} />;
    case 'CANCELLED':
      return <ErrorIcon sx={{ color: 'error.main', ...iconSx }} />;
    default:
      return <InfoIcon sx={{ color: 'info.main', ...iconSx }} />;
  }
};

const makeChip = (label: string, hexColor: string) => (
  <Chip
    label={label}
    size="small"
    sx={{
      height: 24,
      fontSize: '0.75rem',
      fontWeight: 600,
      backgroundColor: `${hexColor}18`,
      color: hexColor,
      border: `1px solid ${hexColor}40`,
      borderRadius: '6px',
      '& .MuiChip-label': { px: 1 },
    }}
  />
);

export default function InterventionDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const {
    user,
    intervention,
    loading,
    error,
    starting,
    completing,
    updatingProgress,
    progressDialogOpen,
    progressValue,
    notesDialogOpen,
    notesValue,
    updatingNotes,
    currentStepForNotes,
    stepNotes,
    photosDialogOpen,
    selectedPhotos,
    uploadingPhotos,
    photoType,
    propertyDetails,
    completedSteps,
    beforePhotos,
    afterPhotos,
    validatedRooms,
    inspectionComplete,
    allRoomsValidated,
    canViewInterventions,
    canEditInterventions,
    permissionsLoaded,
    setProgressDialogOpen,
    setProgressValue,
    setNotesDialogOpen,
    setNotesValue,
    setCurrentStepForNotes,
    setPhotosDialogOpen,
    setSelectedPhotos,
    setPhotoType,
    setError,
    handleStartIntervention,
    handleUpdateProgress,
    handleCompleteIntervention,
    handleReopenIntervention,
    handleOpenNotesDialog,
    handleUpdateNotes,
    handlePhotoUpload,
    handlePhotoSelect,
    handleInspectionComplete,
    handleRoomValidation,
    handleAfterPhotosComplete,
    handleUpdateProgressValue,
    canStartOrUpdateIntervention,
    canStartIntervention,
    canUpdateProgress,
    canModifyIntervention,
    areAllStepsCompleted,
    calculateProgress,
    getTotalRooms,
    getRoomNames,
    getStepNote,
    setCompletedSteps,
    setInspectionComplete,
    startSuccessMessage,
    setStartSuccessMessage,
  } = useInterventionDetails(id);

  if (!permissionsLoaded || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!canViewInterventions) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body2">
            Vous n'avez pas les permissions nécessaires pour visualiser les détails des interventions.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <PageHeader
        title="Détails de l'intervention"
        subtitle="Consultation et gestion des informations de l'intervention"
        backPath="/interventions"
        backLabel="Retour aux interventions"
        actions={
          canEditInterventions ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/interventions/${id}/edit`)}
              size="small"
            >
              Modifier
            </Button>
          ) : undefined
        }
        showBackButton={false}
        showBackButtonWithActions={true}
      />

      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={32} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {intervention && !loading && (
        <Card sx={{ maxWidth: 900 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>

            {/* ── Description ──────────────────────────────────────── */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {intervention.description}
            </Typography>

            {/* ── Chips: Type + Statut + Priorité ──────────────────── */}
            <Box sx={{ ...styles.chipRow, mb: 2 }}>
              <Box display="flex" alignItems="center" gap={0.75}>
                <BuildIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                {makeChip(getTypeLabel(intervention.type, t), getTypeHex(intervention.type))}
              </Box>
              <Box display="flex" alignItems="center" gap={0.75}>
                {getStatusIcon(intervention.status)}
                {makeChip(getStatusLabel(intervention.status, t), getStatusHex(intervention.status))}
              </Box>
              <Box display="flex" alignItems="center" gap={0.75}>
                <PriorityHighIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                {makeChip(getPriorityLabel(intervention.priority, t), getPriorityHex(intervention.priority))}
              </Box>
            </Box>

            {/* ── Dates en ligne ───────────────────────────────────── */}
            <Box sx={{ ...styles.metaRow, mb: 2 }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">Planifié:</Typography>
                <Typography variant="body2">{formatDate(intervention.scheduledDate)}</Typography>
              </Box>
              {intervention.startTime && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PlayCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="caption" color="text.secondary">Début:</Typography>
                  <Typography variant="body2">{formatDate(intervention.startTime)}</Typography>
                </Box>
              )}
              {intervention.endTime && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StopCircleIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  <Typography variant="caption" color="text.secondary">Fin:</Typography>
                  <Typography variant="body2">{formatDate(intervention.endTime)}</Typography>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* ── Informations détaillées (ex-sidebar) ─────────────── */}
            <Box sx={styles.infoGrid}>
              {/* Propriété */}
              <Box sx={styles.infoItem}>
                <Box sx={{ ...styles.infoIconBox, bgcolor: 'rgba(25, 118, 210, 0.08)' }}>
                  <LocationIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Propriété
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {intervention.propertyName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {intervention.propertyAddress}{intervention.propertyCity ? `, ${intervention.propertyCity}` : ''}
                  </Typography>
                </Box>
              </Box>

              {/* Demandeur */}
              <Box sx={styles.infoItem}>
                <Box sx={{ ...styles.infoIconBox, bgcolor: 'rgba(46, 125, 50, 0.08)' }}>
                  <PersonIcon sx={{ fontSize: 18, color: 'success.main' }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Demandeur
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {intervention.requestorName}
                  </Typography>
                </Box>
              </Box>

              {/* Assignation */}
              <Box sx={styles.infoItem}>
                <Box sx={{ ...styles.infoIconBox, bgcolor: 'rgba(156, 39, 176, 0.08)' }}>
                  {intervention.assignedToType === 'team'
                    ? <GroupIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                    : <PersonIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                  }
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Assigné à
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {intervention.assignedToName}
                  </Typography>
                  <Chip
                    label={intervention.assignedToType === 'team' ? 'Équipe' : 'Utilisateur'}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem', mt: 0.25, '& .MuiChip-label': { px: 0.75 } }}
                  />
                </Box>
              </Box>

              {/* Détails techniques */}
              <Box sx={styles.infoItem}>
                <Box sx={{ ...styles.infoIconBox, bgcolor: 'rgba(237, 108, 2, 0.08)' }}>
                  <AccessTimeIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    Durée estimée
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDuration(intervention.estimatedDurationHours)}
                  </Typography>
                  {intervention.estimatedCost != null && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2, mt: 0.5 }}>
                        Coût estimé
                      </Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatCurrency(intervention.estimatedCost)}
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            {/* ── Progression & Steps ──────────────────────────────── */}
            <InterventionProgressSteps
              intervention={intervention}
              calculateProgress={calculateProgress}
              canUpdateProgress={canUpdateProgress()}
              canStartIntervention={canStartIntervention()}
              canStartOrUpdateIntervention={canStartOrUpdateIntervention()}
              areAllStepsCompleted={areAllStepsCompleted()}
              propertyDetails={propertyDetails}
              getTotalRooms={getTotalRooms}
              getRoomNames={getRoomNames}
              validatedRooms={validatedRooms}
              allRoomsValidated={allRoomsValidated}
              inspectionComplete={inspectionComplete}
              beforePhotos={beforePhotos}
              afterPhotos={afterPhotos}
              completedSteps={completedSteps}
              getStepNote={getStepNote}
              handleStartIntervention={handleStartIntervention}
              handleCompleteIntervention={handleCompleteIntervention}
              handleReopenIntervention={handleReopenIntervention}
              handleRoomValidation={handleRoomValidation}
              handleOpenNotesDialog={handleOpenNotesDialog}
              handleUpdateProgressValue={handleUpdateProgressValue}
              setPhotoType={setPhotoType}
              setPhotosDialogOpen={setPhotosDialogOpen}
              setInspectionComplete={setInspectionComplete}
              setCompletedSteps={setCompletedSteps}
              starting={starting}
              completing={completing}
            />

          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ProgressDialog
        open={progressDialogOpen}
        onClose={() => setProgressDialogOpen(false)}
        progressValue={progressValue}
        onProgressChange={setProgressValue}
        onSubmit={handleUpdateProgress}
        updating={updatingProgress}
      />

      <NotesDialog
        open={notesDialogOpen}
        onClose={() => {
          setNotesDialogOpen(false);
          setNotesValue('');
          setCurrentStepForNotes(null);
        }}
        currentStep={currentStepForNotes}
        notesValue={notesValue}
        onNotesChange={setNotesValue}
        onSubmit={handleUpdateNotes}
        updating={updatingNotes}
        stepNotes={stepNotes}
        onStepNotesChange={() => {}}
      />

      <PhotosDialog
        open={photosDialogOpen}
        onClose={() => {
          setPhotosDialogOpen(false);
          setSelectedPhotos([]);
        }}
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
        <Alert
          severity="success"
          onClose={() => setStartSuccessMessage(null)}
          sx={{ width: '100%' }}
        >
          {startSuccessMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
