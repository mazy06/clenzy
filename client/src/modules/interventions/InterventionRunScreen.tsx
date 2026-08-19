import React, { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Alert as BuiAlert, AlertDescription, Button, Spinner } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { ArrowBack, Build as WrenchIcon, AccessTime } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { useInterventionDetails } from './useInterventionDetails';
import InterventionProgressSteps from './InterventionProgressSteps';
import { NotesDialog, PhotosDialog } from './InterventionDialogs';
import IssueReportDialog from './IssueReportDialog';

/** Temps ecoule depuis le debut, rafraichi chaque minute. */
function useElapsed(startTime?: string | null): string | null {
  const [now, setNow] = React.useState(() => Date.now());
  useEffect(() => {
    if (!startTime) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [startTime]);
  if (!startTime) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

/**
 * Ecran TERRAIN d'une intervention en cours (`/interventions/:id/suivi`).
 *
 * Plein ecran, hors chrome de l'application : la personne qui fait le menage ou
 * la maintenance travaille sur son telephone, une main prise. Elle n'a besoin
 * que du suivi — le detail de l'intervention (metriques, adresse, personnes)
 * appartient a la fiche, qui reste a un tap de distance.
 *
 * `fixed inset-0` plutot qu'une route hors layout : meme mecanique que le mode
 * plein ecran du planning, sans toucher au routage.
 *
 * L'ecran n'existe que pendant l'execution : tout autre statut renvoie a la
 * fiche, pour qu'une URL partagee ou un retour arriere ne montre jamais un
 * suivi fige.
 */
export default function InterventionRunScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { notify } = useNotification();

  const {
    intervention, loading, error,
    starting, completing,
    notesDialogOpen, notesValue, updatingNotes, currentStepForNotes, stepNotes,
    photosDialogOpen, selectedPhotos, uploadingPhotos, deletingPhotoId, photoType,
    beforePhotoIds, afterPhotoIds,
    propertyDetails, completedSteps, beforePhotos, afterPhotos,
    validatedRooms, inspectionComplete, allRoomsValidated,
    canViewInterventions, permissionsLoaded,
    setNotesDialogOpen, setNotesValue, setCurrentStepForNotes,
    setPhotosDialogOpen, setSelectedPhotos, setPhotoType,
    handleStartIntervention, handleCompleteIntervention, handleReopenIntervention,
    handleOpenNotesDialog, handleUpdateNotes,
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

  const elapsed = useElapsed(intervention?.startTime);
  const [issueOpen, setIssueOpen] = React.useState(false);
  // Piece d'ou part le signalement : celle dont l'intervenant vient de toucher
  // l'action, pas une deduction sur l'avancement.
  const [issueRoom, setIssueRoom] = React.useState<string | null>(null);

  const roomNames = useMemo(() => getRoomNames(), [getRoomNames]);

  useEffect(() => {
    if (!startSuccessMessage) return;
    notify.success(startSuccessMessage);
    setStartSuccessMessage(null);
  }, [startSuccessMessage, notify, setStartSuccessMessage]);

  if (!permissionsLoaded || loading) {
    return (
      <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-background">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (!canViewInterventions || (intervention && intervention.status !== 'IN_PROGRESS')) {
    return <Navigate to={`/interventions/${id}`} replace />;
  }

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col bg-background">
      {/* En-tete compact : sortie, identite du chantier, temps ecoule. Colle en
          haut, il ne defile pas — c'est le seul repere pendant l'execution. */}
      <header className="shrink-0 border-b border-solid border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label={t('interventions.run.exit', 'Revenir à la fiche')}
            onClick={() => navigate(`/interventions/${id}`)}
          >
            <ArrowBack size={20} strokeWidth={1.75} />
          </Button>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <WrenchIcon size={18} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">
              {intervention?.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">{intervention?.propertyName}</p>
          </div>
          {elapsed && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-lg bg-success-soft px-2 py-1 text-xs font-semibold tabular-nums text-success-ink"
              aria-label={t('interventions.run.elapsedLabel', 'Temps écoulé')}
            >
              <AccessTime size={14} strokeWidth={1.75} />
              {elapsed}
            </span>
          )}
        </div>
      </header>

      {error && (
        <BuiAlert variant="destructive" className="mx-3 mt-2 shrink-0 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </BuiAlert>
      )}

      {/* Corps : le suivi, et rien d'autre. `[&_[data-slot=button]]:min-h-[44px]`
          porte la cible tactile minimale sur TOUS les boutons du kit rendus ici
          (44px = seuil d'ergonomie tactile), sans toucher au composant partage
          avec la fiche bureau. */}
      <main className="min-h-0 flex-1 overflow-auto px-3 py-3 [&_[data-slot=button]]:min-h-[44px]">
        {intervention && (
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
            onReportIssue={(roomName) => { setIssueRoom(roomName); setIssueOpen(true); }}
          />
        )}
      </main>

      {intervention?.propertyId != null && (
        <IssueReportDialog
          open={issueOpen}
          onClose={() => { setIssueOpen(false); setIssueRoom(null); }}
          propertyId={intervention.propertyId}
          sourceInterventionId={Number(id)}
          roomNames={roomNames}
          currentRoom={issueRoom}
        />
      )}

      <NotesDialog
        open={notesDialogOpen}
        onClose={() => { setNotesDialogOpen(false); setNotesValue(''); setCurrentStepForNotes(null); }}
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
        onClose={() => { if (!uploadingPhotos) { setPhotosDialogOpen(false); setSelectedPhotos([]); } }}
        photoType={photoType}
        selectedPhotos={selectedPhotos}
        onPhotosChange={setSelectedPhotos}
        onSubmit={handlePhotoUpload}
        uploading={uploadingPhotos}
      />
    </div>
  );
}
