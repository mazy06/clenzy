/**
 * Channex Sync Logs List — Phase 3.
 *
 * <p>Affiche l'historique des operations sync Channex pour une property donnee
 * sous forme de timeline compacte. Repliable (collapse) pour ne pas surcharger
 * le diagnose dialog par defaut.</p>
 *
 * <p>Chaque ligne : icone type/status + label type + duration + recordCount,
 * timestamp formate "il y a Xm/Xh", erreur tronquee en monospace si FAIL.</p>
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import {
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Upload,
  Download,
  Sparkles,
} from 'lucide-react';

import { channexApi } from '../../../services/api/channexApi';
import type {
  ChannexSyncLogDto,
  ChannexSyncLogStatus,
  ChannexSyncLogType,
} from '../../../services/api/channexApi';

interface ChannexSyncLogsListProps {
  propertyId: number;
  /** Replie par defaut. false pour montrer au mount. */
  defaultCollapsed?: boolean;
  /** Max items affiches avant "Voir plus". Default 10. */
  maxItems?: number;
}

/** Teintes VIVES : fond de ligne et icone, jamais du texte (contrat §2.4). */
const STATUS_META: Record<ChannexSyncLogStatus, { color: string; Icon: typeof CheckCircle2; label: string }> = {
  SUCCESS: { color: 'var(--bui-success)', Icon: CheckCircle2, label: 'OK' },
  FAIL:    { color: 'var(--bui-destructive)', Icon: XCircle,      label: 'Echec' },
  SKIPPED: { color: 'var(--bui-muted-foreground)', Icon: MinusCircle,  label: 'Skip' },
};

const TYPE_LABELS: Record<ChannexSyncLogType, { label: string; Icon: typeof Upload }> = {
  PUSH_PROPERTY:    { label: 'Push complet (avail + tarifs)', Icon: Upload },
  PUSH_AVAILABILITY:{ label: 'Push disponibilites',           Icon: Upload },
  PUSH_RATES:       { label: 'Push tarifs',                   Icon: Upload },
  PULL_BOOKINGS:    { label: 'Pull reservations',             Icon: Download },
  RESYNC_CONTENT:   { label: 'Re-sync contenu OTA',           Icon: Sparkles },
};

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.floor(hours / 24)} j`;
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function LogRow({ log }: { log: ChannexSyncLogDto }) {
  const statusMeta = STATUS_META[log.status];
  const typeMeta = TYPE_LABELS[log.syncType] ?? { label: log.syncType, Icon: Upload };
  const TypeIcon = typeMeta.Icon;
  return (
    <div className="flex gap-1.5 py-1 px-[5.1px] rounded-lg items-start" style={{ backgroundColor: `color-mix(in srgb, ${statusMeta.color} 10%, transparent)` }}>
      <div className="mt-[1.5px] shrink-0" style={{ color: statusMeta.color }}>
        <statusMeta.Icon size={14} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-0.5 flex-wrap">
          <TypeIcon size={11} strokeWidth={2} className="text-muted-foreground" />
          <span className="text-xs font-semibold leading-[1.3] text-foreground">
            {typeMeta.label}
          </span>
          {log.recordCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-2xs font-semibold tabular-nums bg-primary-soft text-primary">{`${log.recordCount}`}</Badge>
          )}
          <span className="text-2xs text-muted-foreground opacity-60 tabular-nums ms-auto">
            {formatDuration(log.durationMs)} · {formatRelative(log.startedAt)}
          </span>
        </div>
        {/* Message d'erreur = TEXTE → encre `-ink` (§2.4). */}
        {log.errorMessage && (
          <span className="block mt-0.5 text-2xs text-destructive-ink font-mono leading-[1.35] break-words">
            {log.errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChannexSyncLogsList({
  propertyId,
  defaultCollapsed = true,
  maxItems = 10,
}: ChannexSyncLogsListProps) {
  const [logs, setLogs] = useState<ChannexSyncLogDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await channexApi.syncLogs(propertyId, 50);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement de l historique');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  // Fetch lazy : ne charge que quand on deplie pour la 1ere fois
  useEffect(() => {
    if (!collapsed && logs.length === 0 && !loading && !error) {
      void fetchLogs();
    }
  }, [collapsed, logs.length, loading, error, fetchLogs]);

  const visibleLogs = showAll ? logs : logs.slice(0, maxItems);
  const hiddenCount = logs.length - visibleLogs.length;

  return (
    <div className="border border-solid border-border rounded-lg overflow-hidden">
      {/* Header cliquable pour collapse */}
      <div className="flex items-center gap-1.5 px-[7.5px] py-1.5 cursor-pointer select-none hover:bg-muted" onClick={() => setCollapsed((c) => !c)}>
        <History size={14} strokeWidth={2.2} className="text-primary" />
        <span className="text-xs font-semibold flex-1 text-foreground">
          Historique de sync
          {logs.length > 0 && (
            <span className="text-xs text-muted-foreground ms-0.5 font-normal tabular-nums">
              · {logs.length} entree{logs.length > 1 ? 's' : ''}
            </span>
          )}
        </span>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Le span porte le declencheur : un bouton desactive n'emet plus
                  d'evenement de survol, le tooltip ne s'ouvrirait jamais. */}
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Rafraichir"
                  disabled={loading}
                  onClick={(e) => { e.stopPropagation(); void fetchLogs(); }}
                  className="size-[22px]"
                >
                  <RefreshCw size={11} strokeWidth={2.2} className="text-primary" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Rafraichir</TooltipContent>
          </Tooltip>
        )}
        {collapsed
          ? <ChevronDown size={14} className="text-primary" />
          : <ChevronUp size={14} className="text-primary" />}
      </div>

      <Collapsible open={!collapsed}>
        <CollapsibleContent>
        <div className="px-2 pb-2 pt-0.5">
          {loading && logs.length === 0 && (
            <div className="flex flex-col gap-[3px]">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
            </div>
          )}
          {error && !loading && (
            <div className="py-1.5">
              <span className="text-xs text-destructive-ink block mb-0.5">
                {error}
              </span>
              {/* Outline et non ghost : seule voie de reprise apres une erreur de
                  chargement, elle doit rester reperable dans ce panneau dense. */}
              <Button variant="outline" size="sm" onClick={() => void fetchLogs()}>
                Reessayer
              </Button>
            </div>
          )}
          {!loading && !error && logs.length === 0 && (
            <span className="text-xs text-muted-foreground opacity-60 block py-1.5 italic">
              Aucune operation sync enregistree pour cette propriete.
            </span>
          )}
          {logs.length > 0 && (
            // spacing 0.3 = 1,8 px (theme.spacing vaut 6 dans ce projet).
            <div className="flex flex-col gap-[1.8px] items-stretch">
              {visibleLogs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
              {hiddenCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setShowAll(true)}
                >
                  Voir {hiddenCount} entree{hiddenCount > 1 ? 's' : ''} de plus
                </Button>
              )}
            </div>
          )}
        </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
