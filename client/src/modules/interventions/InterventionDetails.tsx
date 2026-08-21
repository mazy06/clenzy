import React, { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton, Card, CardContent } from '../../components/ui';
import { Info, TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useNotification } from '../../hooks/useNotification';
import {
  Edit as EditIcon,
  Build as WrenchIcon,
  PriorityHigh as PriorityHighIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  PlayArrow as PlayArrowIcon,
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
import InterventionQuotesSection from './InterventionQuotesSection';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi } from '../../services/api/interventionsApi';
import { TRADE_ROLES } from '../../utils/fieldRoles';
import { interventionsKeys } from './useInterventionsList';
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
  const { notify } = useNotification();
  const queryClient = useQueryClient();

  const { hasAnyRole } = useAuth();
  const [respondingAssignment, setRespondingAssignment] = React.useState(false);

  /** Accepter ou refuser la mission depuis sa fiche, sans repasser par le tableau de bord. */
  const respondToAssignment = async (accept: boolean) => {
    if (!id) return;
    setRespondingAssignment(true);
    try {
      await (accept ? interventionsApi.accept(Number(id)) : interventionsApi.decline(Number(id)));
      notify.success(accept
        ? t('field.proposals.accepted', 'Mission acceptée')
        : t('field.proposals.declined', 'Mission refusée'));
      queryClient.invalidateQueries({ queryKey: interventionsKeys.detail(id) });
    } catch {
      setError(t('field.proposals.error', 'L’action a échoué, réessayez.'));
    } finally {
      setRespondingAssignment(false);
    }
  };

  /** Metiers de travaux : eux seuls chiffrent une intervention. */
  const canSubmitOwnQuote = hasAnyRole([...TRADE_ROLES]);

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

  // Le message de succes reste porte par le hook (etat metier) ; on le consomme
  // ici en toast puis on le vide, ce qui remplace l'ancienne banniere flottante.
  useEffect(() => {
    if (!startSuccessMessage) return;
    notify.success(startSuccessMessage);
    setStartSuccessMessage(null);
  }, [startSuccessMessage, notify, setStartSuccessMessage]);

  // Intervention EN COURS et utilisateur charge de l'executer → l'ecran terrain
  // prend la main : pendant l'execution, le detail (metriques, adresse,
  // personnes) n'a plus d'utilite, seul le suivi compte. `replace` pour que le
  // retour arriere sorte vers la liste et non vers une fiche qui redirige.
  // Les autres profils (manager en lecture, comptabilite) gardent la fiche.
  const shouldRunFieldScreen = intervention?.status === 'IN_PROGRESS' && canStartOrUpdateIntervention;
  useEffect(() => {
    if (shouldRunFieldScreen) navigate(`/interventions/${id}/suivi`, { replace: true });
  }, [shouldRunFieldScreen, navigate, id]);

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
          <AlertDescription><h6 className="text-sm font-semibold mb-[0.35em]">{t('interventions.detail.unauthorized')}</h6><p className="text-xs">
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

    // Debut et fin ne sont PAS des tuiles : le bloc « Detail du temps » les
    // rend deja, plus bas dans le meme ecran. Sans ce doublon, les tuiles
    // restantes (type, duree, echeance, cout) tiennent sur une seule rangee.
    const extraMetrics: WorkOrderMetric[] = [];

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
      // La photo de couverture arrive avec l'intervention depuis le lot
      // pre-charge : un intervenant reconnait un lieu avant de le lire.
      propertyPhotoUrl: intervention.propertyCoverPhotoUrl,
      tasks: intervention.quoteLines?.map((line) => ({
        label: line.label,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
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

  /**
   * Action principale, posee en tete de fiche (carte Progression). Avant, le
   * bouton « Demarrer » vivait au bas du stepper : il fallait defiler toute la
   * fiche pour l'atteindre, alors que c'est la seule chose qu'un intervenant
   * vient y faire.
   */
  const heroAction = (() => {
    if (!intervention) return undefined;
    if (canStartIntervention) {
      return (
        <BuiButton size="sm" onClick={handleStartIntervention} disabled={starting}>
          {starting ? <Spinner className="size-4" /> : <PlayArrowIcon size={16} strokeWidth={1.75} />}
          {starting
            ? t('interventions.progressSteps.starting')
            : t('interventions.progressSteps.startIntervention')}
        </BuiButton>
      );
    }
    // Assigne mais trop tot : le bouton n'a pas de sens, la date en a un.
    if (canStartOrUpdateIntervention && intervention.status === 'PENDING'
        && isBeforeScheduledDate && intervention.scheduledDate) {
      return (
        <span className="rounded-lg bg-warning-soft px-2 py-1 text-xs font-semibold text-warning-ink">
          {t('interventions.detail.scheduledFor', 'Démarrage possible le')}{' '}
          {formatDateTime(intervention.scheduledDate)}
        </span>
      );
    }
    // En cours vu par un profil non executant (manager) : la fiche reste, mais
    // l'ecran terrain est a un tap. L'executant, lui, y est deja redirige.
    if (intervention.status === 'IN_PROGRESS') {
      return (
        <BuiButton variant="outline" size="sm" onClick={() => navigate(`/interventions/${id}/suivi`)}>
          <PlayArrowIcon size={16} strokeWidth={1.75} />
          {t('interventions.detail.openRunScreen', 'Ouvrir le suivi')}
        </BuiButton>
      );
    }
    return undefined;
  })();

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
              <BuiButton variant="outline" size="sm"
                onClick={() => navigate(`/interventions/${id}/edit`)}
                title={t('interventions.detail.editButton')}>
                <EditIcon strokeWidth={1.75} />
                {t('interventions.detail.editButton')}
              </BuiButton>
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
          heroAction={heroAction}
          statusBanner={
            // La fiche restait muette sur l'etat d'assignation, que le tableau
            // de bord affiche : il fallait revenir en arriere pour repondre.
            intervention.assignmentResponse === 'PENDING' && canSubmitOwnQuote ? (
              <BuiAlert variant="warning" className="items-center py-2">
                <TriangleAlert />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {t('interventions.detail.toConfirm',
                      'Cette mission vous est proposée — elle attend votre réponse.')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BuiButton
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive-ink"
                      disabled={respondingAssignment}
                      onClick={() => respondToAssignment(false)}
                    >
                      {t('field.proposals.decline', 'Refuser')}
                    </BuiButton>
                    <BuiButton
                      variant="secondary"
                      size="sm"
                      disabled={respondingAssignment}
                      onClick={() => respondToAssignment(true)}
                    >
                      {t('field.proposals.accept', 'Accepter')}
                    </BuiButton>
                  </span>
                </AlertDescription>
              </BuiAlert>
            ) : intervention.assignmentResponse === 'ACCEPTED' ? (
              <BuiAlert className="items-center py-1.5">
                <AlertDescription className="text-success-ink">
                  {t('interventions.detail.accepted', 'Mission acceptée.')}
                </AlertDescription>
              </BuiAlert>
            ) : undefined
          }
          propertyAction={
            // Action discrete au coin d'une carte : ghost, et xs pour retrouver
            // la hauteur 24 que le sx d'origine imposait.
            <BuiButton
              variant="ghost"
              size="xs"
              onClick={() => navigate(`/properties/${intervention.propertyId}`)}
            >
              {t('serviceRequests.details.viewProperty')}
            </BuiButton>
          }
          extraSection={
            <>
              {/* Le suivi vit desormais sur l'ecran terrain
                  (/interventions/:id/suivi). Sur la fiche il ne reste que pour
                  une intervention TERMINEE : c'est alors un recapitulatif
                  (pieces validees, photos, documents) et le bouton Rouvrir. */}
              {intervention.status === 'COMPLETED' && (
              <Card size="sm" className="mb-[9px] shadow-none">
                <CardContent>
                  <p className={WORKFLOW_TITLE_CLASS}>
                    {t('interventions.detail.workflowTitle', 'Suivi de l\'intervention')}
                  </p>
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
                </CardContent>
              </Card>
              )}
              {/* Devis prestataires (M4) — l'approbation reporte le montant sur le
                  coût estimé : on invalide la query détail pour rafraîchir les KPI. */}
              <InterventionQuotesSection
                interventionId={Number(id)}
                canEdit={canEditInterventions}
                // Chiffrer sa propre mission est le geste economique du
                // technicien. `canEditInterventions` ne l'ouvre pas : cette
                // permission est reservee aux gestionnaires, qui saisissent les
                // devis RECUS de tiers et les approuvent.
                canSubmitOwn={canSubmitOwnQuote}
                interventionStatus={intervention.status}
                interventionCreatedAt={intervention.createdAt}
                onQuoteApproved={() => {
                  queryClient.invalidateQueries({ queryKey: interventionsKeys.detail(id ?? '') });
                }}
              />
            </>
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
    </div>
  );
}

/** Surtitre de la section « suivi » : capitales espacées, encre pâle. */
const WORKFLOW_TITLE_CLASS = 'text-2xs font-bold uppercase tracking-wider text-faint mb-[9px]';
