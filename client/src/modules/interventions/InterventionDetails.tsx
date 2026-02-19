import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
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
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  Autorenew as AutorenewIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  StopCircle as StopCircleIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useInterventionDetails } from './useInterventionDetails';
import {
  getStatusColor,
  getStatusLabel,
  getPriorityColor,
  getPriorityLabel,
  getTypeLabel,
  formatDate,
} from './interventionUtils';
import InterventionSidebar from './InterventionSidebar';
import InterventionProgressSteps from './InterventionProgressSteps';
import { ProgressDialog, NotesDialog, PhotosDialog } from './InterventionDialogs';

const styles = {
  flexLayout: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    '& > *': {
      flex: '1 1 auto',
      minWidth: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' },
      maxWidth: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 11px)' },
    },
  },
  iconBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  sidebarToggle: {
    mr: 1,
    border: '1px solid',
    borderColor: 'divider',
  },
  spinIcon: {
    color: 'info.main',
    fontSize: 20,
    animation: 'spin 2s linear infinite',
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },
} as const;

// Fonction JSX pour l'icône de statut
const getStatusIcon = (status: string) => {
  const iconSx = { fontSize: 20 };
  switch (status) {
    case 'PENDING':
      return <WarningIcon sx={{ color: 'warning.main', ...iconSx }} />;
    case 'IN_PROGRESS':
      return (
        <AutorenewIcon sx={styles.spinIcon} />
      );
    case 'COMPLETED':
      return <CheckCircleIcon sx={{ color: 'success.main', ...iconSx }} />;
    case 'CANCELLED':
      return <ErrorIcon sx={{ color: 'error.main', ...iconSx }} />;
    default:
      return <InfoIcon sx={{ color: 'info.main', ...iconSx }} />;
  }
};

export default function InterventionDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const {
    // Auth
    user,
    // State
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
    showSidebar,
    propertyDetails,
    completedSteps,
    beforePhotos,
    afterPhotos,
    validatedRooms,
    inspectionComplete,
    allRoomsValidated,
    canViewInterventions,
    canEditInterventions,
    // Setters
    setProgressDialogOpen,
    setProgressValue,
    setNotesDialogOpen,
    setNotesValue,
    setCurrentStepForNotes,
    setPhotosDialogOpen,
    setSelectedPhotos,
    setPhotoType,
    setShowSidebar,
    setError,
    // Handlers
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
    // Computed
    canStartOrUpdateIntervention,
    canStartIntervention,
    canUpdateProgress,
    canModifyIntervention,
    areAllStepsCompleted,
    calculateProgress,
    getTotalRooms,
    getRoomNames,
    getStepNote,
    // Sub-component setters needed by ProgressSteps
    setCompletedSteps,
    setAllRoomsValidated,
    setInspectionComplete,
    saveCompletedSteps,
  } = useInterventionDetails(id);

  // Si l'utilisateur n'a pas la permission de voir les interventions
  if (!canViewInterventions) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ py: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
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
          <>
            <IconButton
              onClick={() => setShowSidebar(!showSidebar)}
              size="small"
              sx={styles.sidebarToggle}
              title={showSidebar ? "Masquer les détails" : "Afficher les détails"}
            >
              {showSidebar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
            {canEditInterventions && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<EditIcon />}
                onClick={() => navigate(`/interventions/${id}/edit`)}
                size="small"
                title="Modifier"
              >
                Modifier
              </Button>
            )}
          </>
        }
        showBackButton={false}
        showBackButtonWithActions={true}
      />

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={32} />
        </Box>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* Main content */}
      {intervention && !loading && (
        <Grid container spacing={2}>
          {/* Informations principales */}
          <Grid item xs={12} md={showSidebar ? 8 : 12}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 1.5 }}>
                  Description
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph sx={{ fontSize: '0.85rem' }}>
                  {intervention.description}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {/* Layout responsive avec flexbox */}
                <Box sx={styles.flexLayout}>
                  {/* Type */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={styles.iconBox}>
                      <BuildIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Type:</Typography>
                    <Chip label={getTypeLabel(intervention.type, t)} color="primary" variant="outlined" size="small" sx={{ height: 22, fontSize: '0.7rem', borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }} />
                  </Box>

                  {/* Statut */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={styles.iconBox}>
                      {getStatusIcon(intervention.status)}
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Statut:</Typography>
                    <Chip label={getStatusLabel(intervention.status, t)} color={getStatusColor(intervention.status)} variant="outlined" size="small" sx={{ height: 22, fontSize: '0.7rem', borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }} />
                  </Box>

                  {/* Priorité */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={styles.iconBox}>
                      <PriorityHighIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Priorité:</Typography>
                    <Chip label={getPriorityLabel(intervention.priority, t)} color={getPriorityColor(intervention.priority)} variant="outlined" size="small" sx={{ height: 22, fontSize: '0.7rem', borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }} />
                  </Box>

                  {/* Planifié */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={styles.iconBox}>
                      <ScheduleIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Planifié:</Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {formatDate(intervention.scheduledDate)}
                    </Typography>
                  </Box>

                  {/* Date et heure de début */}
                  {intervention.startTime && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={styles.iconBox}>
                        <PlayCircleOutlineIcon sx={{ color: 'success.main', fontSize: 20 }} />
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Début:</Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {formatDate(intervention.startTime)}
                      </Typography>
                    </Box>
                  )}

                  {/* Date de fin */}
                  {intervention.endTime && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Box sx={styles.iconBox}>
                        <StopCircleIcon sx={{ color: 'error.main', fontSize: 20 }} />
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>Fin:</Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {formatDate(intervention.endTime)}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Progression & Steps */}
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
                  setAllRoomsValidated={setAllRoomsValidated}
                  saveCompletedSteps={saveCompletedSteps}
                  starting={starting}
                  completing={completing}
                />

              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          {showSidebar && (
            <InterventionSidebar intervention={intervention} />
          )}
        </Grid>
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
        onStepNotesChange={(notes) => {
          // This is handled by the hook's setStepNotes internally
          // The dialog calls this to update step notes for auto-save
        }}
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
    </Box>
  );
}
