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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Stack,
  Chip,
} from '@mui/material';
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
      <Box sx={{ mt: 0.2 }}>
        <StepIcon status={step.status} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ lineHeight: 1.3, color: 'text.primary' }}
          >
            {STEP_LABEL_FR[step.code] ?? step.label}
          </Typography>
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
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', lineHeight: 1.45 }}
        >
          {step.detail}
        </Typography>
      </Box>
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
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: 'var(--err-soft)',
                color: 'var(--err)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <ShieldAlert size={20} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '1.05rem' }}>
                Deconnexion complete de « {propertyName} »
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Smart Disconnect orchestre · libere les OTA + nettoie le hub
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ pt: 1, pb: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Cette operation va executer en sequence&nbsp;:
            </Typography>
            <Stack
              spacing={0.75}
              sx={{
                mb: 2,
                pl: 2,
                borderLeft: '2px solid var(--line-2)',
              }}
            >
              <Typography variant="body2" color="text.primary">
                1. <b>Detecter</b> tous les channels OTA actifs sur cette property
              </Typography>
              <Typography variant="body2" color="text.primary">
                2. <b>Desactiver</b> chaque channel (les hosts reprennent la main immediatement)
              </Typography>
              <Typography variant="body2" color="text.primary">
                3. <b>Supprimer</b> chaque channel du hub (tokens OAuth detruits)
              </Typography>
              <Typography variant="body2" color="text.primary">
                4. <b>Nettoyer</b> le mapping local Baitly
              </Typography>
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
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Reset complet : supprimer aussi la property cote hub
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Plus de trace dans le dashboard Channex. Irreversible : il faudra recreer la
                    property pour reconnecter.
                  </Typography>
                </Box>
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
              <Alert severity="error" sx={{ mt: 2 }}>
                {submitError}
              </Alert>
            )}
          </DialogContent>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, pb: 2 }}>
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
          </Box>
        </>
      )}

      {/* ─── Phase RUNNING ─────────────────────────────────────────────── */}
      {phase === 'RUNNING' && (
        <DialogContent sx={{ py: 5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={42} sx={{ color: 'var(--err)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                Deconnexion en cours…
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Le hub libere les OTA et nettoie les channels. 5 a 10 secondes selon le nombre
                d'OTA connectes.
              </Typography>
            </Box>
          </Box>
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
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '1.05rem' }}>
                {result.overallSuccess
                  ? 'Deconnexion reussie'
                  : 'Deconnexion partielle'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {successCount} reussie{successCount > 1 ? 's' : ''}
                {failedCount > 0 && ` · ${failedCount} echec${failedCount > 1 ? 's' : ''}`}
                {skippedCount > 0 && ` · ${skippedCount} ignoree${skippedCount > 1 ? 's' : ''}`}
              </Typography>
            </Box>
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, pb: 2 }}>
            <Button
              onClick={handleClose}
              size="small"
              variant="contained"
              color={result.overallSuccess ? 'success' : 'inherit'}
              sx={{ textTransform: 'none' }}
            >
              Fermer
            </Button>
          </Box>
        </>
      )}
    </Dialog>
  );
}
