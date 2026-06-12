/**
 * Channex Diagnose & Repair Dialog — Quick Win #5.
 *
 * <p>Cas d'usage : l'utilisateur voit un badge rouge sur une propriete et clique
 * dessus → ce dialog s'ouvre, fetche le diagnostic, et propose 1-3 actions en
 * 1 clic pour debloquer la situation (force re-sync, smart disconnect, ouvrir
 * le hub Channex).</p>
 *
 * <p><b>Layout</b> :</p>
 * <ul>
 *   <li>Header : icone d'etat (vert/orange/rouge/gris) + nom property + summary humain</li>
 *   <li>Bloc Snapshot : status, derniere sync, OTAs actifs, derniere erreur si presente</li>
 *   <li>Actions : 1 bouton primary + N boutons secondary, chacun avec son detail</li>
 * </ul>
 *
 * <p>Les actions sont mappees par code :</p>
 * <ul>
 *   <li>FORCE_RESYNC    : execute inline (progress + result)</li>
 *   <li>FULL_DISCONNECT : remonte au parent via {@code onFullDisconnect}</li>
 *   <li>OPEN_HUB        : remonte au parent via {@code onOpenHub}</li>
 * </ul>
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Skeleton,
  Chip,
} from '@mui/material';
import {
  CheckCircle2,
  AlertCircle,
  Pause,
  Clock,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
  Stethoscope,
  X,
} from 'lucide-react';

import { channexApi, CHANNEX_STATUS_META } from '../../../services/api/channexApi';
import type {
  ChannexDiagnosisReport,
  ChannexRecommendedAction,
  ChannexSyncStatus,
  ChannexSyncSnapshot,
} from '../../../services/api/channexApi';
import ChannexSyncLogsList from './ChannexSyncLogsList';

interface ChannexDiagnoseDialogProps {
  open: boolean;
  onClose: () => void;
  propertyId: number;
  /** Callback declenche quand l'utilisateur choisit FULL_DISCONNECT. */
  onFullDisconnect: () => void;
  /** Callback declenche quand l'utilisateur choisit OPEN_HUB. */
  onOpenHub: () => void;
  /** Callback declenche apres un FORCE_RESYNC reussi (rafraichir le parent). */
  onResyncSuccess?: () => void;
}

const STATUS_ICONS: Record<ChannexSyncStatus, typeof CheckCircle2> = {
  ACTIVE: CheckCircle2,
  PENDING: Clock,
  ERROR: AlertCircle,
  DISABLED: Pause,
};

const ACTION_ICONS: Record<ChannexRecommendedAction['code'], typeof RefreshCw> = {
  FORCE_RESYNC: RefreshCw,
  FULL_DISCONNECT: ShieldAlert,
  OPEN_HUB: ExternalLink,
};

function formatRelative(iso: string | null): string {
  if (!iso) return 'jamais';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  } catch {
    return iso;
  }
}

function SyncSnapshotPanel({ snapshot }: { snapshot: ChannexSyncSnapshot }) {
  const meta = CHANNEX_STATUS_META[snapshot.status];
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        bgcolor: 'var(--surface-2)',
      }}
    >
      <Stack spacing={0.85}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 500 }}>
            Statut sync
          </Typography>
          <Chip
            size="small"
            label={meta.label}
            sx={{
              height: 20,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: `${meta.color}1A`,
              color: meta.color,
              border: `1px solid ${meta.color}40`,
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 500 }}>
            Derniere sync
          </Typography>
          <Typography variant="body2">{formatRelative(snapshot.lastSyncAt)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, fontWeight: 500 }}>
            OTAs actifs
          </Typography>
          <Typography variant="body2">
            {snapshot.activeOtaCount > 0
              ? `${snapshot.activeOtaCount} OTA${snapshot.activeOtaCount > 1 ? 's' : ''} actif${snapshot.activeOtaCount > 1 ? 's' : ''}`
              : 'aucun'}
          </Typography>
        </Box>
        {snapshot.lastSyncError && snapshot.status === 'ERROR' && (
          <Box sx={{ pt: 0.5, mt: 0.25, borderTop: '1px dashed', borderTopColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3, fontWeight: 500 }}>
              Derniere erreur
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.78rem',
                color: 'var(--err)',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
                lineHeight: 1.45,
              }}
            >
              {snapshot.lastSyncError}
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function ActionButton({
  action,
  busy,
  onClick,
}: {
  action: ChannexRecommendedAction;
  busy: boolean;
  onClick: () => void;
}) {
  const Icon = ACTION_ICONS[action.code];
  const isPrimary = action.priority === 'PRIMARY';
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        p: 1.25,
        borderRadius: 1,
        border: '1px solid',
        borderColor: isPrimary ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'divider',
        bgcolor: isPrimary ? 'var(--accent-soft)' : 'transparent',
        alignItems: 'flex-start',
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 0.75,
          bgcolor: isPrimary ? 'var(--accent-soft)' : 'var(--hover)',
          color: isPrimary ? 'var(--accent)' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3, mb: 0.3 }}>
          {action.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.45, mb: 1 }}>
          {action.detail}
        </Typography>
        <Button
          size="small"
          variant={isPrimary ? 'contained' : 'outlined'}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <Icon size={14} />}
          disabled={busy}
          onClick={onClick}
          sx={{ textTransform: 'none', fontSize: '0.78rem' }}
        >
          {busy ? 'En cours…' : action.label}
        </Button>
      </Box>
    </Box>
  );
}

export default function ChannexDiagnoseDialog({
  open,
  onClose,
  propertyId,
  onFullDisconnect,
  onOpenHub,
  onResyncSuccess,
}: ChannexDiagnoseDialogProps) {
  const [report, setReport] = useState<ChannexDiagnosisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionResult(null);
    try {
      const res = await channexApi.diagnose(propertyId);
      setReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic impossible.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (open) {
      void fetchReport();
    } else {
      // Reset a la fermeture pour un fetch frais a la prochaine ouverture
      setReport(null);
      setError(null);
      setActionResult(null);
      setBusyAction(null);
    }
  }, [open, fetchReport]);

  const handleAction = async (action: ChannexRecommendedAction) => {
    setBusyAction(action.code);
    setActionResult(null);
    try {
      switch (action.code) {
        case 'FORCE_RESYNC': {
          const result = await channexApi.resync(propertyId, 6);
          setActionResult({
            ok: result.success,
            message: result.success
              ? `Re-sync OK : ${result.availabilityUpdates} jours pousses.`
              : `Re-sync KO : ${result.message}`,
          });
          if (result.success) {
            onResyncSuccess?.();
            // Re-fetcher pour refleter le nouveau state (status, lastSyncAt)
            void fetchReport();
          }
          break;
        }
        case 'FULL_DISCONNECT':
          onClose();
          onFullDisconnect();
          break;
        case 'OPEN_HUB':
          onClose();
          onOpenHub();
          break;
      }
    } catch (err) {
      setActionResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur inattendue.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const StatusIcon = report ? STATUS_ICONS[report.sync.status] : Stethoscope;
  const accent = report
    ? CHANNEX_STATUS_META[report.sync.status].color
    : 'var(--accent)';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
            bgcolor: `${accent}1A`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          <StatusIcon size={20} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '1.05rem' }}>
            Diagnostic Channex
          </Typography>
          {report && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.4, lineHeight: 1.5 }}
            >
              « {report.propertyName} » · {report.summary}
            </Typography>
          )}
        </Box>
        <Button
          onClick={onClose}
          size="small"
          sx={{ minWidth: 0, p: 0.5, color: 'text.secondary' }}
          aria-label="Fermer"
        >
          <X size={18} />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        {loading && (
          <Stack spacing={1.25} sx={{ mt: 1 }}>
            <Skeleton variant="rounded" height={120} />
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={80} />
          </Stack>
        )}

        {error && !loading && (
          <Alert severity="error" sx={{ mt: 1 }} action={
            <Button size="small" onClick={() => void fetchReport()} sx={{ textTransform: 'none' }}>
              Reessayer
            </Button>
          }>
            {error}
          </Alert>
        )}

        {report && !loading && (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <SyncSnapshotPanel snapshot={report.sync} />

            {actionResult && (
              <Alert severity={actionResult.ok ? 'success' : 'warning'}>
                {actionResult.message}
              </Alert>
            )}

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}
              >
                Actions recommandees
              </Typography>
              <Stack spacing={1}>
                {report.recommendedActions.map((action) => (
                  <ActionButton
                    key={action.code}
                    action={action}
                    busy={busyAction === action.code}
                    onClick={() => void handleAction(action)}
                  />
                ))}
              </Stack>
            </Box>

            {/* Phase 3 : historique de sync replie par defaut. Fetch lazy au deplie. */}
            <ChannexSyncLogsList propertyId={propertyId} defaultCollapsed />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
