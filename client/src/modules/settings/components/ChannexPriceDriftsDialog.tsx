/**
 * Channex Price Drifts Dialog — Phase 3 OTA pricing (sync continue) + audit O1.
 *
 * <p>Liste les drifts de prix actifs (Baitly ↔ OTA) detectes par le
 * {@code ChannexRatesReconciliationScheduler} et permet a l'admin de les
 * resoudre en 1 clic :</p>
 * <ul>
 *   <li><b>KEEP_CLENZY</b> : on conserve le prix Baitly, push au prochain cycle ecrasera Channex</li>
 *   <li><b>KEEP_OTA</b>    : on cree un {@code RateOverride(source="OTA:RESOLVED")}
 *       avec le prix OTA → PriceEngine resoudra cette date avec ce prix</li>
 *   <li><b>DISMISSED</b>   : on ignore l'ecart (cas de difference attendue)</li>
 * </ul>
 *
 * <p>Optionnellement scope sur une property specifique via {@code propertyId}.
 * Sans propertyId : montre TOUS les drifts actifs de l'organisation.</p>
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  X,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

import { channexApi } from '../../../services/api/channexApi';
import type {
  ChannexPriceDriftDto,
  ChannexPriceDriftResolution,
} from '../../../services/api/channexApi';

interface ChannexPriceDriftsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si fourni, ne montre que les drifts de cette property. Sinon : tous. */
  propertyId?: number;
  /** Callback apres resolution d'un drift (pour rafraichir le parent). */
  onDriftResolved?: () => void;
}

const RESOLUTION_LABEL: Record<ChannexPriceDriftResolution, string> = {
  KEEP_CLENZY: 'Garder Baitly',
  KEEP_OTA: 'Garder OTA',
  DISMISSED: 'Ignorer',
};

const RESOLUTION_COLOR: Record<ChannexPriceDriftResolution, string> = {
  KEEP_CLENZY: 'var(--accent)',
  KEEP_OTA: 'var(--warn)',
  DISMISSED: 'var(--muted)',
};

function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

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

function DriftRow({
  drift,
  busyResolution,
  onResolve,
}: {
  drift: ChannexPriceDriftDto;
  busyResolution: ChannexPriceDriftResolution | null;
  onResolve: (resolution: ChannexPriceDriftResolution) => void;
}) {
  const clenzyHigher = drift.clenzyPrice > drift.otaPrice;
  const TrendIcon = clenzyHigher ? TrendingUp : TrendingDown;
  const trendColor = clenzyHigher ? 'var(--ok)' : 'var(--err)';
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.25,
        bgcolor: 'var(--surface-2)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{ color: trendColor, flexShrink: 0 }}>
          <TrendIcon size={18} strokeWidth={2.2} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600}>
              {drift.driftDate}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              · property #{drift.clenzyPropertyId}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
              {formatRelative(drift.detectedAt)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              size="small"
              label={`Baitly ${drift.clenzyPrice}${drift.currency}`}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                bgcolor: 'var(--accent-soft)',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            />
            <Typography variant="caption" color="text.disabled">vs</Typography>
            <Chip
              size="small"
              label={`OTA ${drift.otaPrice}${drift.currency}`}
              sx={{
                height: 22,
                fontSize: '0.72rem',
                bgcolor: 'var(--warn-soft)',
                color: 'var(--warn)',
                fontWeight: 600,
              }}
            />
            <Chip
              size="small"
              label={formatPct(drift.diffPercent)}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                bgcolor: `${trendColor}22`,
                color: trendColor,
                fontWeight: 700,
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Boutons d'action */}
      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
        {(['KEEP_CLENZY', 'KEEP_OTA', 'DISMISSED'] as ChannexPriceDriftResolution[]).map((r) => {
          const isBusy = busyResolution === r;
          const anyBusy = busyResolution !== null;
          return (
            <Button
              key={r}
              size="small"
              variant={r === 'KEEP_CLENZY' ? 'contained' : 'outlined'}
              disabled={anyBusy}
              onClick={() => onResolve(r)}
              startIcon={
                isBusy ? (
                  <CircularProgress size={12} sx={{ color: 'inherit' }} />
                ) : r === 'KEEP_CLENZY' || r === 'KEEP_OTA' ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <X size={12} />
                )
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.72rem',
                flex: 1,
                borderColor: RESOLUTION_COLOR[r],
                color: RESOLUTION_COLOR[r],
                ...(r === 'KEEP_CLENZY' && {
                  bgcolor: 'transparent',
                  border: '1px solid',
                  '&:hover': { bgcolor: 'var(--accent-soft)', borderColor: RESOLUTION_COLOR[r] },
                }),
              }}
            >
              {RESOLUTION_LABEL[r]}
            </Button>
          );
        })}
      </Stack>
    </Box>
  );
}

export default function ChannexPriceDriftsDialog({
  open,
  onClose,
  propertyId,
  onDriftResolved,
}: ChannexPriceDriftsDialogProps) {
  const [drifts, setDrifts] = useState<ChannexPriceDriftDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyResolutions, setBusyResolutions] = useState<Map<number, ChannexPriceDriftResolution>>(new Map());

  const fetchDrifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = propertyId != null
        ? await channexApi.listPriceDriftsForProperty(propertyId)
        : await channexApi.listPriceDrifts();
      setDrifts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des drifts');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (open) {
      void fetchDrifts();
    } else {
      setDrifts([]);
      setError(null);
      setBusyResolutions(new Map());
    }
  }, [open, fetchDrifts]);

  const handleResolve = async (drift: ChannexPriceDriftDto, resolution: ChannexPriceDriftResolution) => {
    setBusyResolutions((m) => {
      const next = new Map(m);
      next.set(drift.id, resolution);
      return next;
    });
    try {
      await channexApi.resolvePriceDrift(drift.id, resolution);
      // Retire le drift de la liste (il est resolu → plus actif)
      setDrifts((curr) => curr.filter((d) => d.id !== drift.id));
      onDriftResolved?.();
    } catch (err) {
      setError(err instanceof Error
        ? `Resolution KO : ${err.message}`
        : 'Resolution KO');
    } finally {
      setBusyResolutions((m) => {
        const next = new Map(m);
        next.delete(drift.id);
        return next;
      });
    }
  };

  const grouped = useMemo(() => {
    if (propertyId != null) return { all: drifts };
    const byProp = new Map<number, ChannexPriceDriftDto[]>();
    for (const d of drifts) {
      const arr = byProp.get(d.clenzyPropertyId) ?? [];
      arr.push(d);
      byProp.set(d.clenzyPropertyId, arr);
    }
    const result: Record<string, ChannexPriceDriftDto[]> = {};
    for (const [pid, arr] of byProp.entries()) {
      result[`Propriete #${pid}`] = arr;
    }
    return result;
  }, [drifts, propertyId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: 'var(--warn-soft)',
            color: 'var(--warn)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          <AlertTriangle size={20} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3, fontSize: '1.05rem' }}>
            Conflits de prix Baitly ↔ Channex
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
            {drifts.length === 0 && !loading
              ? 'Aucun conflit actif'
              : `${drifts.length} drift${drifts.length > 1 ? 's' : ''} en attente de résolution${propertyId ? ' pour cette propriete' : ''}`}
          </Typography>
        </Box>
        <Tooltip title="Rafraichir" arrow placement="top">
          <span>
            <IconButton size="small" disabled={loading} onClick={() => void fetchDrifts()}>
              {loading ? <CircularProgress size={14} /> : <RefreshCw size={14} />}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        {loading && drifts.length === 0 && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={100} />
            <Skeleton variant="rounded" height={100} />
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 1.5 }} action={
            <Button size="small" onClick={() => void fetchDrifts()} sx={{ textTransform: 'none' }}>
              Reessayer
            </Button>
          }>
            {error}
          </Alert>
        )}

        {!loading && drifts.length === 0 && !error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle2 size={36} color="var(--ok)" strokeWidth={2} />
            <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
              Tous les prix sont alignes entre Baitly et Channex.
            </Typography>
          </Box>
        )}

        {drifts.length > 0 && (
          <Stack spacing={1.25}>
            {Object.entries(grouped).map(([groupLabel, groupDrifts]) => (
              <Box key={groupLabel}>
                {propertyId == null && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.75,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      letterSpacing: 0.4,
                    }}
                  >
                    {groupLabel} · {groupDrifts.length} drift{groupDrifts.length > 1 ? 's' : ''}
                  </Typography>
                )}
                <Stack spacing={1}>
                  {groupDrifts.map((d) => (
                    <DriftRow
                      key={d.id}
                      drift={d}
                      busyResolution={busyResolutions.get(d.id) ?? null}
                      onResolve={(r) => void handleResolve(d, r)}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
