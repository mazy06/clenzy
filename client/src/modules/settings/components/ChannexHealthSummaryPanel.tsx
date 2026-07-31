/**
 * Channex Health Summary Panel — Phase 2.
 *
 * <p>Tableau de bord agrege de la sante Channex pour l'organisation, alimente
 * par {@code GET /integrations/channex/health-summary} (meme calcul que celui
 * du watchdog scheduler cote backend).</p>
 *
 * <p>Affichage :</p>
 * <ul>
 *   <li>Header : compteur total + chips par status (Active/Pending/Error/Disabled)</li>
 *   <li>Liste des items meritant attention (max 5 visibles, expand pour le reste)
 *       avec severite + raison. Click → callback {@code onAttentionItemClick} pour
 *       laisser le parent ouvrir le diagnose dialog pour cette property.</li>
 * </ul>
 */
import React, { useCallback, useEffect, useState } from 'react';
import StatusChip from '../../../components/StatusChip';
import { Spinner } from '../../../components/ui';
import { Box, Typography, IconButton, Stack, Skeleton, Tooltip, Button } from '@mui/material';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Activity,
  ChevronRight,
} from 'lucide-react';

import { channexApi, CHANNEX_STATUS_META } from '../../../services/api/channexApi';
import type {
  ChannexHealthSummary,
  ChannexAttentionItem,
  ChannexAttentionSeverity,
  ChannexSyncStatus,
} from '../../../services/api/channexApi';

interface ChannexHealthSummaryPanelProps {
  /** Click sur un attention item → callback parent (typique : ouvrir diagnose pour cette property). */
  onAttentionItemClick?: (item: ChannexAttentionItem) => void;
  /** Combien d'items afficher avant "Voir +N de plus". Default 5. */
  maxVisibleItems?: number;
}

const SEVERITY_META: Record<ChannexAttentionSeverity, { color: string; Icon: typeof AlertCircle; label: string }> = {
  ERROR:   { color: 'var(--err)', Icon: AlertCircle,   label: 'Erreur' },
  WARNING: { color: 'var(--warn)', Icon: AlertTriangle, label: 'Attention' },
  INFO:    { color: 'var(--info)', Icon: Info,          label: 'Info' },
};

const STATUS_ORDER: ChannexSyncStatus[] = ['ACTIVE', 'PENDING', 'ERROR', 'DISABLED'];

function formatRelative(iso: string | null): string {
  if (!iso) return 'jamais';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "a l'instant";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h`;
    return `${Math.floor(hours / 24)} j`;
  } catch {
    return iso;
  }
}

function AttentionRow({
  item,
  onClick,
}: {
  item: ChannexAttentionItem;
  onClick?: () => void;
}) {
  const meta = SEVERITY_META[item.severity];
  const Icon = meta.Icon;
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.25,
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        p: 1,
        borderRadius: 0.75,
        border: '1px solid',
        borderColor: `color-mix(in srgb, ${meta.color} 13%, transparent)`,
        bgcolor: `color-mix(in srgb, ${meta.color} 3%, transparent)`,
        background: `color-mix(in srgb, ${meta.color} 3%, transparent)`,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        ...(onClick && {
          '&:hover': {
            borderColor: `color-mix(in srgb, ${meta.color} 33%, transparent)`,
            bgcolor: `color-mix(in srgb, ${meta.color} 6%, transparent)`,
            transform: 'translateX(2px)',
          },
          '&:focus-visible': {
            outline: `2px solid ${meta.color}`,
            outlineOffset: 2,
          },
        }),
      }}
    >
      <Box sx={{ mt: 0.2, color: meta.color, flexShrink: 0 }}>
        <Icon size={16} strokeWidth={2.2} />
      </Box>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1 mb-0.5">
          <p className="cn-text-body2 font-semibold leading-[1.3] text-foreground">
            {item.propertyName}
          </p>
          <Typography variant="caption" sx={{ color: meta.color, fontWeight: 500, fontSize: '0.65rem' }}>
            #{item.clenzyPropertyId}
          </Typography>
        </div>
        <span className="cn-text-caption text-muted-foreground block leading-[1.45]">
          {item.reason}
        </span>
        {item.lastSyncAt && (
          <span className="cn-text-caption block mt-0.5 text-muted-foreground opacity-60 text-[0.65rem]">
            Derniere sync : il y a {formatRelative(item.lastSyncAt)}
          </span>
        )}
      </div>
      {onClick && (
        <Box sx={{ color: meta.color, mt: 0.4, flexShrink: 0 }}>
          <ChevronRight size={14} />
        </Box>
      )}
    </Box>
  );
}

export default function ChannexHealthSummaryPanel({
  onAttentionItemClick,
  maxVisibleItems = 5,
}: ChannexHealthSummaryPanelProps) {
  const [summary, setSummary] = useState<ChannexHealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await channexApi.healthSummary();
      setSummary(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement du resume Channex');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  if (loading && !summary) {
    return (
      <div className="border border-[divider] rounded-[1px] p-2">
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={32} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'color-mix(in srgb, var(--err) 30%, transparent)',
          borderRadius: 1,
          p: 1.25,
          bgcolor: 'color-mix(in srgb, var(--err) 5%, transparent)',
        }}
      >
        <span className="cn-text-caption text-destructive block mb-0.5">
          {error}
        </span>
        <Button size="small" onClick={() => void fetchSummary()} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
          Reessayer
        </Button>
      </Box>
    );
  }

  if (!summary) return null;

  if (summary.totalMappings === 0) {
    return (
      <div className="border border-[divider] rounded-[1px] p-2 bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5">
          <Activity size={16} color="var(--muted)" strokeWidth={2.2} />
          <span className="cn-text-caption text-muted-foreground">
            Aucune propriete connectee a Channex pour l'instant.
          </span>
        </div>
      </div>
    );
  }

  const visibleItems = showAll
    ? summary.attentionItems
    : summary.attentionItems.slice(0, maxVisibleItems);
  const hiddenCount = summary.attentionItems.length - visibleItems.length;

  return (
    <div className="border border-[divider] rounded-[1px] p-2 bg-[var(--surface-2)]">
      {/* Header : total + chips par status + refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: summary.attentionItems.length > 0 ? 1.25 : 0 }}>
        <Activity size={16} color="var(--accent)" strokeWidth={2.2} />
        <span className="cn-text-caption font-semibold text-foreground">
          {summary.totalMappings} propriete{summary.totalMappings > 1 ? 's' : ''} connectee{summary.totalMappings > 1 ? 's' : ''}
        </span>
        <div className="flex gap-0.5 ms-auto flex-wrap">
          {STATUS_ORDER.map((st) => {
            const n = summary.countsByStatus[st] ?? 0;
            if (n === 0) return null;
            const meta = CHANNEX_STATUS_META[st];
            return (
              <StatusChip tokens={{ color: meta.color, bg: `color-mix(in srgb, ${meta.color} 10%, transparent)` }} label={`${n} ${meta.label.toLowerCase()}`} className="h-[20px] text-[0.65rem]" key={st} />
            );
          })}
        </div>
        <Tooltip title="Rafraichir" arrow placement="top">
          <span>
            <IconButton
              size="small"
              disabled={loading}
              onClick={() => void fetchSummary()}
              sx={{ width: 24, height: 24, ml: 0.25 }}
            >
              {loading ? <Spinner className="size-3" /> : <RefreshCw size={12} strokeWidth={2.2} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Liste des items meritant attention */}
      {summary.attentionItems.length > 0 && (
        <Stack spacing={0.65}>
          {visibleItems.map((item) => (
            <AttentionRow
              key={`${item.clenzyPropertyId}-${item.severity}`}
              item={item}
              onClick={onAttentionItemClick ? () => onAttentionItemClick(item) : undefined}
            />
          ))}
          {hiddenCount > 0 && (
            <Button
              size="small"
              onClick={() => setShowAll(true)}
              sx={{ textTransform: 'none', fontSize: '0.72rem', alignSelf: 'flex-start' }}
            >
              Voir {hiddenCount} item{hiddenCount > 1 ? 's' : ''} de plus
            </Button>
          )}
        </Stack>
      )}
    </div>
  );
}
