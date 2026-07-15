import React from 'react';
import {
  Box,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  Alert,
  Skeleton,
  Button,
} from '@mui/material';
import { DataUsage, Settings as SettingsIcon } from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiUsageStats } from '../../hooks/useAi';

// ─── Constants ──────────────────────────────────────────────────────────────

const FEATURE_COLORS: Record<string, string> = {
  DESIGN:    'var(--info)',
  PRICING:   'var(--ok)',
  MESSAGING: 'var(--warn)',
  ANALYTICS: 'var(--accent)',
  SENTIMENT: 'var(--err)',
};

const cardSx = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  p: 1.5,
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'var(--line-2)' },
} as const;

const headerSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  mb: 1.5,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isAiNotConfiguredError(error: unknown): boolean {
  const apiErr = error as { details?: Record<string, unknown> } | undefined;
  const errorCode = apiErr?.details?.errorCode;
  return errorCode === 'AI_NOT_CONFIGURED' || errorCode === 'AI_FEATURE_DISABLED';
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiUsageWidgetProps {
  /** "inline" renders features in a horizontal row for the main content area */
  layout?: 'default' | 'inline';
}

// ─── Component ──────────────────────────────────────────────────────────────

const AiUsageWidget: React.FC<AiUsageWidgetProps> = React.memo(({ layout = 'default' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAiUsageStats();

  const isInline = layout === 'inline';

  // ── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Paper sx={cardSx}>
        <Box sx={headerSx}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><DataUsage size={18} strokeWidth={1.75} /></Box>
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.usage.title')}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: isInline ? 'row' : 'column',
            gap: isInline ? 3 : 1.5,
          }}
        >
          {[1, 2, 3].map((i) => (
            <Box key={i} sx={{ flex: isInline ? 1 : undefined }}>
              <Skeleton variant="text" width="60%" height={16} />
              <Skeleton variant="rounded" height={8} sx={{ mt: 0.5 }} />
            </Box>
          ))}
        </Box>
      </Paper>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (isError) {
    const aiNotConfigured = isAiNotConfiguredError(error);

    return (
      <Paper sx={cardSx}>
        <Box sx={headerSx}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><DataUsage size={18} strokeWidth={1.75} /></Box>
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.usage.title')}
          </Typography>
        </Box>
        {aiNotConfigured ? (
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            <Typography variant="body2" fontSize="0.75rem" sx={{ mb: 1 }}>
              {t('bookingEngine.ai.guidance.usage.text')}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SettingsIcon size={14} strokeWidth={1.75} />}
              onClick={() => navigate('/settings')}
              sx={{ textTransform: 'none', fontSize: '0.7rem' }}
            >
              {t('bookingEngine.ai.guidance.usage.button')}
            </Button>
          </Alert>
        ) : (
          <Alert severity="error" sx={{ fontSize: '0.75rem' }}>
            {t('common.error')}
          </Alert>
        )}
      </Paper>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────
  const featureEntries = data ? Object.entries(data.usageByFeature) : [];

  if (!data || featureEntries.length === 0) {
    return (
      <Paper sx={cardSx}>
        <Box sx={headerSx}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><DataUsage size={18} strokeWidth={1.75} /></Box>
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.usage.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
          {t('bookingEngine.ai.usage.noData')}
        </Typography>
      </Paper>
    );
  }

  // ── Content ────────────────────────────────────────────────────────
  return (
    <Paper sx={cardSx}>
      {/* Header row with title + total chip + budget remaining */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><DataUsage size={18} strokeWidth={1.75} /></Box>
        <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
          {t('bookingEngine.ai.usage.title')}
        </Typography>
        <Chip
          label={formatTokenCount(data.totalUsed)}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, ml: 'auto' }}
        />
        {data.totalBudget > 0 && (
          <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
            {t('bookingEngine.ai.usage.remaining')}: {formatTokenCount(data.totalBudget - data.totalUsed)}
          </Typography>
        )}
      </Box>

      {/* Feature bars — inline = grille responsive qui WRAPPE (le catalogue IA compte
          maintenant ~11 features ; une seule ligne flex les écrasait -> libellés chevauchés).
          Stacked = colonne verticale. */}
      <Box
        sx={{
          display: isInline ? 'grid' : 'flex',
          ...(isInline
            ? {
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(auto-fill, minmax(170px, 1fr))',
                },
              }
            : { flexDirection: 'column' }),
          gap: isInline ? 1.5 : 1.25,
        }}
      >
        {featureEntries.map(([feature, tokens]) => {
          const limit = data.budgetByFeature[feature] ?? 0;
          const pct = limit > 0 ? Math.min((tokens / limit) * 100, 100) : 0;
          const color = FEATURE_COLORS[feature] ?? 'var(--faint)';

          return (
            <Box key={feature} sx={{ minWidth: 0 }}>
              {/* Label row — le libellé tronque (ellipsis + tooltip) pour ne jamais
                  déborder sur le compteur voisin ; le compteur ne rétrécit pas. */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.5, mb: 0.25 }}>
                <Typography variant="caption" fontWeight={600} fontSize="0.7rem" noWrap title={feature} sx={{ minWidth: 0 }}>
                  {feature}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontSize="0.65rem"
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTokenCount(tokens)}
                  {limit > 0 && ` / ${formatTokenCount(limit)}`}
                </Typography>
              </Box>

              {/* Progress bar */}
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'var(--field)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: color,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
});

AiUsageWidget.displayName = 'AiUsageWidget';

export default AiUsageWidget;
