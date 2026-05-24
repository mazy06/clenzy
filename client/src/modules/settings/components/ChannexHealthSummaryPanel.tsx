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
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Stack,
  Skeleton,
  Tooltip,
  Chip,
  Button,
} from '@mui/material';
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
  ERROR:   { color: '#EF4444', Icon: AlertCircle,   label: 'Erreur' },
  WARNING: { color: '#D97706', Icon: AlertTriangle, label: 'Attention' },
  INFO:    { color: '#0EA5E9', Icon: Info,          label: 'Info' },
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
        borderColor: `${meta.color}22`,
        bgcolor: `${meta.color}06`,
        background: `${meta.color}06`,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        ...(onClick && {
          '&:hover': {
            borderColor: `${meta.color}55`,
            bgcolor: `${meta.color}10`,
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
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.2 }}>
          <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3, color: 'text.primary' }}>
            {item.propertyName}
          </Typography>
          <Typography variant="caption" sx={{ color: meta.color, fontWeight: 500, fontSize: '0.65rem' }}>
            #{item.clenzyPropertyId}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.45 }}>
          {item.reason}
        </Typography>
        {item.lastSyncAt && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.disabled', fontSize: '0.65rem' }}>
            Derniere sync : il y a {formatRelative(item.lastSyncAt)}
          </Typography>
        )}
      </Box>
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
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
        }}
      >
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={32} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      </Box>
    );
  }

  if (error && !summary) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          borderRadius: 1,
          p: 1.25,
          bgcolor: 'rgba(239, 68, 68, 0.04)',
        }}
      >
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
          {error}
        </Typography>
        <Button size="small" onClick={() => void fetchSummary()} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
          Reessayer
        </Button>
      </Box>
    );
  }

  if (!summary) return null;

  if (summary.totalMappings === 0) {
    return (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          bgcolor: 'rgba(0,0,0,0.015)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Activity size={16} color="#6B7280" strokeWidth={2.2} />
          <Typography variant="caption" color="text.secondary">
            Aucune propriete connectee a Channex pour l'instant.
          </Typography>
        </Box>
      </Box>
    );
  }

  const visibleItems = showAll
    ? summary.attentionItems
    : summary.attentionItems.slice(0, maxVisibleItems);
  const hiddenCount = summary.attentionItems.length - visibleItems.length;

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
        bgcolor: 'rgba(0,0,0,0.015)',
      }}
    >
      {/* Header : total + chips par status + refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: summary.attentionItems.length > 0 ? 1.25 : 0 }}>
        <Activity size={16} color="#6B8A9A" strokeWidth={2.2} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {summary.totalMappings} propriete{summary.totalMappings > 1 ? 's' : ''} connectee{summary.totalMappings > 1 ? 's' : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto', flexWrap: 'wrap' }}>
          {STATUS_ORDER.map((st) => {
            const n = summary.countsByStatus[st] ?? 0;
            if (n === 0) return null;
            const meta = CHANNEX_STATUS_META[st];
            return (
              <Chip
                key={st}
                size="small"
                label={`${n} ${meta.label.toLowerCase()}`}
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  bgcolor: `${meta.color}1A`,
                  color: meta.color,
                  border: `1px solid ${meta.color}40`,
                }}
              />
            );
          })}
        </Box>
        <Tooltip title="Rafraichir" arrow placement="top">
          <span>
            <IconButton
              size="small"
              disabled={loading}
              onClick={() => void fetchSummary()}
              sx={{ width: 24, height: 24, ml: 0.25 }}
            >
              {loading ? <CircularProgress size={12} /> : <RefreshCw size={12} strokeWidth={2.2} />}
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
    </Box>
  );
}
