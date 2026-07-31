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
import { Alert as UiAlert, AlertDescription } from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Dialog, DialogContent, DialogTitle, Box, Button, Alert, Checkbox, FormControlLabel, Stack, Chip } from '@mui/material';
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

function StepIcon({ status }: { status: ChannexFullDisconnectStep['status'] }) {
  if (status === 'SUCCESS') {
    return <CheckCircle2 size={18} color="var(--ok)" strokeWidth={2.2} />;
  }
  if (status === 'FAILED') {
    return <XCircle size={18} color="var(--err)" strokeWidth={2.2} />;
  }
  return <MinusCircle size={18} color="var(--muted)" strokeWidth={2.2} />;
}

function StepRow({ step }: { step: ChannexFullDisconnectStep }) {
  const bg =
    step.status === 'SUCCESS'
      ? 'color-mix(in srgb, var(--ok) 6%, transparent)'
      : step.status === 'FAILED'
        ? 'color-mix(in srgb, var(--err) 6%, transparent)'
        : 'var(--hover)';
  const borderColor =
    step.status === 'SUCCESS'
      ? 'color-mix(in srgb, var(--ok) 20%, transparent)'
      : step.status === 'FAILED'
        ? 'color-mix(in srgb, var(--err) 20%, transparent)'
        : 'var(--line-2)';
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.25,
        borderRadius: 1,
        border: `1px solid ${borderColor}`,
        bgcolor: bg,
        alignItems: 'flex-start',
      }}
    >
      <div className="mt-0.5">
        <StepIcon status={step.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 mb-0.5">
          <p className="cn-text-body2 font-semibold leading-[1.3] text-foreground">
            {STEP_LABEL_FR[step.code] ?? step.label}
          </p>
          {step.targetId && (
            <Chip
              size="small"
              label={step.targetId.slice(0, 8)}
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                bgcolor: 'var(--hover)',
              }}
            />
          )}
        </div>
        <span className="cn-text-caption text-muted-foreground block leading-[1.45]">
          {step.detail}
        </span>
      </div>
    </Box>
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      // Bloque la fermeture par ESC/backdrop pendant le RUNNING
      disableEscapeKeyDown={phase === 'RUNNING'}
    >
      {/* ─── Phase CONFIRM ─────────────────────────────────────────────── */}
      {phase === 'CONFIRM' && (
        <>
          <DialogTitle
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              pb: 1,
            }}
          >
            <div className="w-[36px] h-[36px] rounded-[1px] bg-[var(--err-soft)] text-[var(--err)] flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h6 className="cn-text-h6 font-semibold leading-[1.3] text-[1.05rem]">
                Deconnexion complete de « {propertyName} »
              </h6>
              <span className="cn-text-caption text-muted-foreground block mt-0.5">
                Smart Disconnect orchestre · libere les OTA + nettoie le hub
              </span>
            </div>
          </DialogTitle>

          <DialogContent sx={{ pt: 1, pb: 1.5 }}>
            <p className="cn-text-body2 text-muted-foreground mb-3">
              Cette operation va executer en sequence&nbsp;:
            </p>
            <Stack
              spacing={0.75}
              sx={{
                mb: 2,
                pl: 2,
                borderLeft: '2px solid var(--line-2)',
              }}
            >
              <p className="cn-text-body2 text-foreground">
                1. <b>Detecter</b> tous les channels OTA actifs sur cette property
              </p>
              <p className="cn-text-body2 text-foreground">
                2. <b>Desactiver</b> chaque channel (les hosts reprennent la main immediatement)
              </p>
              <p className="cn-text-body2 text-foreground">
                3. <b>Supprimer</b> chaque channel du hub (tokens OAuth detruits)
              </p>
              <p className="cn-text-body2 text-foreground">
                4. <b>Nettoyer</b> le mapping local Baitly
              </p>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={deletePivot}
                  onChange={(e) => setDeletePivot(e.target.checked)}
                  sx={{ py: 0.25, '&.Mui-checked': { color: 'var(--err)' } }}
                />
              }
              label={
                <div>
                  <p className="cn-text-body2 font-semibold">
                    Reset complet : supprimer aussi la property cote hub
                  </p>
                  <span className="cn-text-caption text-muted-foreground block">
                    Plus de trace dans le dashboard Channex. Irreversible : il faudra recreer la
                    property pour reconnecter.
                  </span>
                </div>
              }
              sx={{
                m: 0,
                alignItems: 'flex-start',
                p: 1.25,
                border: '1px solid color-mix(in srgb, var(--err) 20%, transparent)',
                borderRadius: 1,
                bgcolor: 'color-mix(in srgb, var(--err) 4%, transparent)',
              }}
            />

            {submitError && (
              <UiAlert variant="destructive" className="mt-3">
                <TriangleAlert />
                <AlertDescription>{submitError}</AlertDescription>
              </UiAlert>
            )}
          </DialogContent>

          <div className="flex justify-end gap-1.5 px-4 pb-3">
            <Button
              onClick={handleClose}
              size="small"
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              size="small"
              variant="contained"
              startIcon={<Sparkles size={16} />}
              color="error"
              sx={{ textTransform: 'none' }}
            >
              {deletePivot ? 'Reset complet' : 'Deconnecter'}
            </Button>
          </div>
        </>
      )}

      {/* ─── Phase RUNNING ─────────────────────────────────────────────── */}
      {phase === 'RUNNING' && (
        <DialogContent sx={{ py: 5 }}>
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-[42px] text-[var(--err)]" />
            <div className="text-center">
              <h6 className="cn-text-subtitle1 font-semibold mb-0.5">
                Deconnexion en cours…
              </h6>
              <span className="cn-text-caption text-muted-foreground">
                Le hub libere les OTA et nettoie les channels. 5 a 10 secondes selon le nombre
                d'OTA connectes.
              </span>
            </div>
          </div>
        </DialogContent>
      )}

      {/* ─── Phase RESULT ──────────────────────────────────────────────── */}
      {phase === 'RESULT' && result && (
        <>
          <DialogTitle
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pb: 1 }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: result.overallSuccess
                  ? 'var(--ok-soft)'
                  : 'var(--warn-soft)',
                color: result.overallSuccess ? 'var(--ok)' : 'var(--warn)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              {result.overallSuccess ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
            </Box>
            <div className="min-w-0 flex-1">
              <h6 className="cn-text-h6 font-semibold leading-[1.3] text-[1.05rem]">
                {result.overallSuccess
                  ? 'Deconnexion reussie'
                  : 'Deconnexion partielle'}
              </h6>
              <span className="cn-text-caption text-muted-foreground block mt-0.5">
                {successCount} reussie{successCount > 1 ? 's' : ''}
                {failedCount > 0 && ` · ${failedCount} echec${failedCount > 1 ? 's' : ''}`}
                {skippedCount > 0 && ` · ${skippedCount} ignoree${skippedCount > 1 ? 's' : ''}`}
              </span>
            </div>
          </DialogTitle>

          <DialogContent sx={{ pt: 1, pb: 2 }}>
            {!result.overallSuccess && (
              <Alert
                severity="warning"
                icon={<AlertCircle size={18} />}
                sx={{ mb: 2 }}
              >
                Certaines etapes ont echoue. Tant que <b>DEACTIVATE_CHANNEL</b> est OK pour
                chaque OTA, vos hosts ont repris la main — le reste peut etre nettoye plus
                tard manuellement.
              </Alert>
            )}

            <Stack spacing={1}>
              {result.steps.map((step, idx) => (
                <StepRow key={`${step.code}-${step.targetId ?? idx}`} step={step} />
              ))}
            </Stack>
          </DialogContent>

          <div className="flex justify-end gap-1.5 px-4 pb-3">
            <Button
              onClick={handleClose}
              size="small"
              variant="contained"
              color={result.overallSuccess ? 'success' : 'inherit'}
              sx={{ textTransform: 'none' }}
            >
              Fermer
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
