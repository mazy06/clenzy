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
  Box,
  Typography,
  IconButton,
  Collapse,
  Stack,
  Skeleton,
  Chip,
  Tooltip,
  Button,
} from '@mui/material';
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

const STATUS_META: Record<ChannexSyncLogStatus, { color: string; Icon: typeof CheckCircle2; label: string }> = {
  SUCCESS: { color: 'var(--ok)', Icon: CheckCircle2, label: 'OK' },
  FAIL:    { color: 'var(--err)', Icon: XCircle,      label: 'Echec' },
  SKIPPED: { color: 'var(--muted)', Icon: MinusCircle,  label: 'Skip' },
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
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        py: 0.65,
        px: 0.85,
        // Pattern -soft baseline (pas de side-stripe — interdit absolu) ;
        // color-mix compatible var() ET hex.
        bgcolor: `color-mix(in srgb, ${statusMeta.color} 10%, transparent)`,
        borderRadius: '8px',
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ mt: 0.25, color: statusMeta.color, flexShrink: 0 }}>
        <statusMeta.Icon size={14} strokeWidth={2.2} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <TypeIcon size={11} strokeWidth={2} color="var(--muted)" />
          <Typography variant="caption" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '0.72rem' }}>
            {typeMeta.label}
          </Typography>
          {log.recordCount > 0 && (
            <Chip
              size="small"
              label={`${log.recordCount}`}
              sx={{
                height: 16,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: 'var(--accent-soft)',
                color: 'var(--accent)',
                '& .MuiChip-label': { px: 0.6 },
              }}
            />
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', ml: 'auto' }}>
            {formatDuration(log.durationMs)} · {formatRelative(log.startedAt)}
          </Typography>
        </Box>
        {log.errorMessage && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.3,
              fontSize: '0.66rem',
              color: 'var(--err)',
              fontFamily: 'monospace',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {log.errorMessage}
          </Typography>
        )}
      </Box>
    </Box>
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
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header cliquable pour collapse */}
      <Box
        onClick={() => setCollapsed((c) => !c)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 1,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { bgcolor: 'var(--hover)' },
        }}
      >
        <History size={14} color="var(--accent)" strokeWidth={2.2} />
        <Typography variant="caption" fontWeight={600} sx={{ flex: 1 }}>
          Historique de sync
          {logs.length > 0 && (
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5, fontWeight: 400 }}>
              · {logs.length} entree{logs.length > 1 ? 's' : ''}
            </Typography>
          )}
        </Typography>
        {!collapsed && (
          <Tooltip title="Rafraichir" arrow placement="top">
            <span>
              <IconButton
                size="small"
                disabled={loading}
                onClick={(e) => { e.stopPropagation(); void fetchLogs(); }}
                sx={{ width: 22, height: 22 }}
              >
                <RefreshCw size={11} strokeWidth={2.2} color="var(--accent)" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {collapsed
          ? <ChevronDown size={14} color="var(--accent)" />
          : <ChevronUp size={14} color="var(--accent)" />}
      </Box>

      <Collapse in={!collapsed}>
        <Box sx={{ px: 1.25, pb: 1.25, pt: 0.25 }}>
          {loading && logs.length === 0 && (
            <Stack spacing={0.5}>
              <Skeleton variant="rounded" height={32} />
              <Skeleton variant="rounded" height={32} />
              <Skeleton variant="rounded" height={32} />
            </Stack>
          )}
          {error && !loading && (
            <Box sx={{ py: 1 }}>
              <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
                {error}
              </Typography>
              <Button size="small" onClick={() => void fetchLogs()} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                Reessayer
              </Button>
            </Box>
          )}
          {!loading && !error && logs.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', py: 1, fontStyle: 'italic' }}>
              Aucune operation sync enregistree pour cette propriete.
            </Typography>
          )}
          {logs.length > 0 && (
            <Stack spacing={0.3}>
              {visibleLogs.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
              {hiddenCount > 0 && (
                <Button
                  size="small"
                  onClick={() => setShowAll(true)}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', alignSelf: 'flex-start' }}
                >
                  Voir {hiddenCount} entree{hiddenCount > 1 ? 's' : ''} de plus
                </Button>
              )}
            </Stack>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
