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
import {
  Alert,
  AlertAction,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Spinner,
} from '../../../components/ui';
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
    <div className="border border-solid border-[var(--line)] rounded-[1px] p-2 bg-[var(--surface-2)]">
      <div className="flex flex-col gap-[5px]">
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
          <p className={cn('cn-text-body2', !snapshot.otaCountKnown && 'text-[var(--muted)]')}>
            {!snapshot.otaCountKnown
              ? 'inconnu — hub injoignable'
              : snapshot.activeOtaCount > 0
                ? `${snapshot.activeOtaCount} OTA${snapshot.activeOtaCount > 1 ? 's' : ''} actif${snapshot.activeOtaCount > 1 ? 's' : ''}`
                : 'aucun'}
          </p>
        </div>
        {snapshot.lastSyncError && snapshot.status === 'ERROR' && (
          <div className="pt-[3px] mt-[1.5px] border-t border-dashed border-t-[var(--line)]">
            <span className="cn-text-caption text-muted-foreground block mb-0.5 font-medium">
              Derniere erreur
            </span>
            <p className="cn-text-body2 text-[0.78rem] text-[var(--err)] font-mono break-words leading-[1.45]">
              {snapshot.lastSyncError}
            </p>
          </div>
        )}
      </div>
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
    <div
      className={cn(
        'flex gap-[7.5px] p-[7.5px] rounded-[8px] border border-solid items-start',
        isPrimary
          ? 'border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[var(--accent-soft)]'
          : 'border-[var(--line)] bg-transparent',
      )}
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
          size="sm"
          variant={isPrimary ? 'default' : 'outline'}
          disabled={busy}
          onClick={onClick}
        >
          {busy ? <Spinner className="size-3.5" /> : <Icon size={14} />}
          {busy ? 'En cours…' : action.label}
        </Button>
      </div>
    </div>
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[600px] max-h-[85vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start gap-[9px]">
            <div className="w-[36px] h-[36px] rounded-[8px] flex items-center justify-center shrink-0 mt-[1.5px]" style={{ backgroundColor: `${accent}1A`, color: accent }}>
              <StatusIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-semibold leading-[1.3] text-[1.05rem]">
                Diagnostic Channex
              </DialogTitle>
              {report && (
                <DialogDescription className="mt-0.5 leading-[1.5]">
                  « {report.propertyName} » · {report.summary}
                </DialogDescription>
              )}
            </div>
            {/* Icone seule : taille carree du kit, jamais une taille texte. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-[var(--muted)]"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={18} />
            </Button>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col gap-[7.5px] mt-1.5">
            <Skeleton className="h-[120px]" />
            <Skeleton className="h-[80px]" />
            <Skeleton className="h-[80px]" />
          </div>
        )}

        {error && !loading && (
          <Alert variant="destructive" className="mt-1.5">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => void fetchReport()}>
                Reessayer
              </Button>
            </AlertAction>
          </Alert>
        )}

        {report && !loading && (
          <div className="flex flex-col gap-[9px] mt-1.5">
            <SyncSnapshotPanel snapshot={report.sync} />

            {actionResult && (
              <Alert variant={actionResult.ok ? 'success' : 'warning'}>
                {actionResult.ok ? <CheckCircle2 /> : <AlertCircle />}
                <AlertDescription>{actionResult.message}</AlertDescription>
              </Alert>
            )}

            <div>
              <span className="cn-text-caption block mb-1.5 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
                Actions recommandees
              </span>
              <div className="flex flex-col gap-1.5">
                {report.recommendedActions.map((action) => (
                  <ActionButton
                    key={action.code}
                    action={action}
                    busy={busyAction === action.code}
                    onClick={() => void handleAction(action)}
                  />
                ))}
              </div>
            </div>

            {/* Phase 3 : historique de sync replie par defaut. Fetch lazy au deplie. */}
            <ChannexSyncLogsList propertyId={propertyId} defaultCollapsed />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
