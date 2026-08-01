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
import { cn } from '../../../utils/cn';
import StatusChip from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Dialog, DialogContent, DialogTitle, Box, Typography, Button, Alert, Stack, Skeleton } from '@mui/material';
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
import type { ApiError } from '../../../services/apiClient';
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
    <div className="border border-[var(--line)] rounded-[1px] p-2 bg-[var(--surface-2)]">
      <Stack spacing={0.85}>
        <div className="flex items-center gap-2">
          <span className="cn-text-caption text-muted-foreground min-w-[110px] font-medium">
            Statut sync
          </span>
          <StatusChip tokens={{ color: meta.color, bg: `${meta.color}1A` }} label={meta.label} className="h-[20px] text-[0.7rem]" />
        </div>
        <div className="flex items-center gap-2">
          <span className="cn-text-caption text-muted-foreground min-w-[110px] font-medium">
            Derniere sync
          </span>
          <p className="cn-text-body2">{formatRelative(snapshot.lastSyncAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="cn-text-caption text-muted-foreground min-w-[110px] font-medium">
            OTAs actifs
          </span>
          <Typography
            variant="body2"
            color={snapshot.otaCountKnown ? undefined : 'text.secondary'}
          >
            {!snapshot.otaCountKnown
              ? 'inconnu — hub injoignable'
              : snapshot.activeOtaCount > 0
                ? `${snapshot.activeOtaCount} OTA${snapshot.activeOtaCount > 1 ? 's' : ''} actif${snapshot.activeOtaCount > 1 ? 's' : ''}`
                : 'aucun'}
          </Typography>
        </div>
        {snapshot.lastSyncError && snapshot.status === 'ERROR' && (
          <Box sx={{ pt: 0.5, mt: 0.25, borderTop: '1px dashed', borderTopColor: 'divider' }}>
            <span className="cn-text-caption text-muted-foreground block mb-0.5 font-medium">
              Derniere erreur
            </span>
            <p className="cn-text-body2 text-[0.78rem] text-[var(--err)] font-mono break-words leading-[1.45]">
              {snapshot.lastSyncError}
            </p>
          </Box>
        )}
      </Stack>
    </div>
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
      <div className={cn('w-[32px] h-[32px] rounded-[6px] flex items-center justify-center shrink-0', isPrimary ? 'bg-[var(--accent-soft)]' : 'bg-[var(--hover)]', isPrimary ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}>
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="cn-text-body2 font-semibold leading-[1.3] mb-0.5">
          {action.label}
        </p>
        <span className="cn-text-caption text-muted-foreground block leading-[1.45] mb-1.5">
          {action.detail}
        </span>
        <Button
          size="small"
          variant={isPrimary ? 'contained' : 'outlined'}
          startIcon={busy ? <Spinner className="size-3.5" /> : <Icon size={14} />}
          disabled={busy}
          onClick={onClick}
          sx={{ textTransform: 'none', fontSize: '0.78rem' }}
        >
          {busy ? 'En cours…' : action.label}
        </Button>
      </div>
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
      // apiClient rejette un objet ApiError nu, pas une instance d'Error :
      // tester `instanceof Error` masquerait le message serveur derriere un
      // libelle generique pour toute reponse HTTP en erreur.
      const message = (err as Partial<ApiError> | null)?.message;
      setError(message || 'Diagnostic impossible.');
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
          const result = await channexApi.resync(propertyId, 0);
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
        <div className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center shrink-0 mt-[1.5px]" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          <StatusIcon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h6 className="cn-text-h6 font-semibold leading-[1.3] text-[1.05rem]">
            Diagnostic Channex
          </h6>
          {report && (
            <span className="cn-text-caption text-muted-foreground block mt-0.5 leading-[1.5]">
              « {report.propertyName} » · {report.summary}
            </span>
          )}
        </div>
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

            <div>
              <span className="cn-text-caption block mb-1.5 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                Actions recommandees
              </span>
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
            </div>

            {/* Phase 3 : historique de sync replie par defaut. Fetch lazy au deplie. */}
            <ChannexSyncLogsList propertyId={propertyId} defaultCollapsed />
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
