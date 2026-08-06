/**
 * Channex Smart Disconnect Dialog
 *
 * Quick Win #2 de la strategie Channex : un dialog en 3 phases qui orchestre
 * la deconnexion complete (channels deactivate + delete + cleanup local) en un
 * seul appel REST et affiche une checklist par etape pour la transparence.
 *
 * <p><b>Pourquoi ce dialog existe</b> : la deconnexion "simple" via {@code DELETE
 * /disconnect} ne fait qu'effacer le mapping en DB Baitly — la property reste
 * cote hub, les channels OTA restent actifs et continuent de pusher (= les OTAs
 * sont toujours bloques cote host). Cette version fait <b>vraiment</b> tout :
 * desactive chaque OTA pour rendre la main aux hosts, supprime les channels du
 * hub, optionnellement supprime la pivot, et nettoie la DB locale.</p>
 *
 * <p><b>3 phases</b> :</p>
 * <ol>
 *   <li>CONFIRM : explication + checkbox "Tout supprimer cote hub" (mode hard)</li>
 *   <li>RUNNING : spinner pendant l'orchestration (peut prendre 5-10s)</li>
 *   <li>RESULT  : checklist verte/rouge/grise par etape + bouton Fermer</li>
 * </ol>
 */
import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert as UiAlert, AlertDescription, Button } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '../../../components/ui';
import StatusChip from '../../../components/StatusChip';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { channexApi } from '../../../services/api/channexApi';
import type {
  ChannexFullDisconnectResult,
  ChannexFullDisconnectStep,
} from '../../../services/api/channexApi';

interface ChannexFullDisconnectDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  propertyName: string;
  /** Callback appele apres succes pour rafraichir la liste des mappings du parent. */
  onSuccess: () => void;
}

type Phase = 'CONFIRM' | 'RUNNING' | 'RESULT';

const STEP_LABEL_FR: Record<ChannexFullDisconnectStep['code'], string> = {
  LIST_CHANNELS: 'Detection des channels OTA',
  DEACTIVATE_CHANNEL: 'Desactivation du channel (OTA libere)',
  DELETE_CHANNEL: 'Suppression du channel du hub',
  DELETE_PROPERTY: 'Suppression de la property cote hub',
  CLEANUP_LOCAL: 'Nettoyage du mapping local Baitly',
};

/** Icone decorative → teinte VIVE, jamais `-ink` (contrat §2.4). */
function StepIcon({ status }: { status: ChannexFullDisconnectStep['status'] }) {
  if (status === 'SUCCESS') {
    return <CheckCircle2 size={18} strokeWidth={2.2} className="text-success" />;
  }
  if (status === 'FAILED') {
    return <XCircle size={18} strokeWidth={2.2} className="text-destructive" />;
  }
  return <MinusCircle size={18} strokeWidth={2.2} className="text-muted-foreground" />;
}

/** Le statut est un ensemble ferme : la teinte de la ligne tient en classes. */
const STEP_ROW_CLASS: Record<ChannexFullDisconnectStep['status'], string> = {
  SUCCESS: 'border-success/25 bg-success-soft/40',
  FAILED:  'border-destructive/25 bg-destructive-soft/40',
  SKIPPED: 'border-border bg-muted',
};

function StepRow({ step }: { step: ChannexFullDisconnectStep }) {
  return (
    <div className={cn('flex gap-[9px] p-[7.5px] rounded-lg items-start border border-solid', STEP_ROW_CLASS[step.status] ?? STEP_ROW_CLASS.SKIPPED)}>
      <div className="mt-0.5">
        <StepIcon status={step.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 mb-0.5">
          <p className="text-xs font-semibold leading-[1.3] text-foreground">
            {STEP_LABEL_FR[step.code] ?? step.label}
          </p>
          {step.targetId && (
            <StatusChip
              size="sm"
              tone="neutral"
              label={step.targetId.slice(0, 8)}
              className="text-2xs font-mono"
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground block leading-[1.45]">
          {step.detail}
        </span>
      </div>
    </div>
  );
}

export default function ChannexFullDisconnectDialog({
  open,
  onClose,
  propertyId,
  propertyName,
  onSuccess,
}: ChannexFullDisconnectDialogProps) {
  const [phase, setPhase] = useState<Phase>('CONFIRM');
  const [deletePivot, setDeletePivot] = useState(false);
  const [result, setResult] = useState<ChannexFullDisconnectResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setPhase('RUNNING');
    setSubmitError(null);
    try {
      const res = await channexApi.fullDisconnect(propertyId, deletePivot);
      setResult(res);
      setPhase('RESULT');
      // Si toutes les etapes critiques sont passees, on rafraichit le parent
      // (le mapping local est supprime → la property n'apparait plus comme connectee)
      if (res.steps.some((s) => s.code === 'CLEANUP_LOCAL' && s.status === 'SUCCESS')) {
        onSuccess();
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Erreur inattendue. Reessayez ou contactez le support.',
      );
      setPhase('CONFIRM');
    }
  };

  const handleClose = () => {
    if (phase === 'RUNNING') return; // bloque la fermeture pendant le run
    setPhase('CONFIRM');
    setDeletePivot(false);
    setResult(null);
    setSubmitError(null);
    onClose();
  };

  const successCount = result?.steps.filter((s) => s.status === 'SUCCESS').length ?? 0;
  const failedCount = result?.steps.filter((s) => s.status === 'FAILED').length ?? 0;
  const skippedCount = result?.steps.filter((s) => s.status === 'SKIPPED').length ?? 0;

  return (
    // La fermeture par ESC/backdrop est deja neutralisee pendant le RUNNING :
    // `handleClose` sort sans appeler `onClose`, et `open` est pilote par le parent.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto" showCloseButton={false}>
      {/* ─── Phase CONFIRM ─────────────────────────────────────────────── */}
      {phase === 'CONFIRM' && (
        <>
          <DialogHeader>
            <div className="flex items-start gap-2">
              <div className="size-9 rounded-lg bg-destructive-soft text-destructive flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight text-balance leading-[1.3]">
                  Deconnexion complete de « {propertyName} »
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Smart Disconnect orchestre · libere les OTA + nettoie le hub
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div>
            <p className="text-xs text-muted-foreground mb-3">
              Cette operation va executer en sequence&nbsp;:
            </p>
            {/* Filet de 1 px : une bande laterale plus epaisse est proscrite. */}
            <div className="flex flex-col gap-[4.5px] mb-3 ps-3 border-s border-solid border-border">
              <p className="text-xs text-foreground">
                1. <b>Detecter</b> tous les channels OTA actifs sur cette property
              </p>
              <p className="text-xs text-foreground">
                2. <b>Desactiver</b> chaque channel (les hosts reprennent la main immediatement)
              </p>
              <p className="text-xs text-foreground">
                3. <b>Supprimer</b> chaque channel du hub (tokens OAuth detruits)
              </p>
              <p className="text-xs text-foreground">
                4. <b>Nettoyer</b> le mapping local Baitly
              </p>
            </div>

            <Field
              orientation="horizontal"
              className="items-start gap-2 rounded-lg border border-solid border-destructive/20 bg-destructive-soft/30 p-[7.5px]"
            >
              <Checkbox
                id="channex-delete-pivot"
                checked={deletePivot}
                onCheckedChange={(checked) => setDeletePivot(checked === true)}
                className="mt-0.5 data-checked:border-destructive data-checked:bg-destructive"
              />
              <FieldContent>
                <FieldLabel htmlFor="channex-delete-pivot" className="text-xs font-semibold">
                  Reset complet : supprimer aussi la property cote hub
                </FieldLabel>
                <FieldDescription className="text-xs">
                  Plus de trace dans le dashboard Channex. Irreversible : il faudra recreer la
                  property pour reconnecter.
                </FieldDescription>
              </FieldContent>
            </Field>

            {submitError && (
              <UiAlert variant="destructive" className="mt-3">
                <TriangleAlert />
                <AlertDescription>{submitError}</AlertDescription>
              </UiAlert>
            )}
          </div>

          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirm}>
              <Sparkles size={16} />
              {deletePivot ? 'Reset complet' : 'Deconnecter'}
            </Button>
          </div>
        </>
      )}

      {/* ─── Phase RUNNING ─────────────────────────────────────────────── */}
      {phase === 'RUNNING' && (
        <div className="py-[30px]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-[42px] text-destructive" />
            <div className="text-center">
              {/* Radix exige un titre par contenu de modale : celui de la phase
                  RUNNING est le libelle deja affiche a l'ecran. */}
              <DialogTitle className="text-sm font-semibold mb-0.5">
                Deconnexion en cours…
              </DialogTitle>
              <DialogDescription className="text-xs">
                Le hub libere les OTA et nettoie les channels. 5 a 10 secondes selon le nombre
                d'OTA connectes.
              </DialogDescription>
            </div>
          </div>
        </div>
      )}

      {/* ─── Phase RESULT ──────────────────────────────────────────────── */}
      {phase === 'RESULT' && result && (
        <>
          <DialogHeader>
            <div className="flex items-start gap-2">
              <div className={cn('size-9 rounded-lg flex items-center justify-center shrink-0 mt-[1.5px]', result.overallSuccess ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                {result.overallSuccess ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight text-balance leading-[1.3]">
                  {result.overallSuccess
                    ? 'Deconnexion reussie'
                    : 'Deconnexion partielle'}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5 tabular-nums">
                  {successCount} reussie{successCount > 1 ? 's' : ''}
                  {failedCount > 0 && ` · ${failedCount} echec${failedCount > 1 ? 's' : ''}`}
                  {skippedCount > 0 && ` · ${skippedCount} ignoree${skippedCount > 1 ? 's' : ''}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div>
            {!result.overallSuccess && (
              <UiAlert variant="warning" className="mb-3">
                <AlertCircle />
                <AlertDescription>
                  Certaines etapes ont echoue. Tant que <b>DEACTIVATE_CHANNEL</b> est OK pour
                  chaque OTA, vos hosts ont repris la main — le reste peut etre nettoye plus
                  tard manuellement.
                </AlertDescription>
              </UiAlert>
            )}

            <div className="flex flex-col gap-1.5">
              {result.steps.map((step, idx) => (
                <StepRow key={`${step.code}-${step.targetId ?? idx}`} step={step} />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-1.5">
            {/* Seule action de la phase RESULT → `default`. L'issue (succes / partiel)
                est deja portee par l'icone et le titre, pas par la couleur du bouton. */}
            <Button size="sm" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        </>
      )}
      </DialogContent>
    </Dialog>
  );
}
