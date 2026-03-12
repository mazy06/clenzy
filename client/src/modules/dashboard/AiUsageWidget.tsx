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
import { DataUsage, Settings as SettingsIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiUsageStats } from '../../hooks/useAi';

// ─── Constants ──────────────────────────────────────────────────────────────

const FEATURE_COLORS: Record<string, string> = {
  DESIGN:    '#64B5F6',
  PRICING:   '#81C784',
  MESSAGING: '#FFB74D',
  ANALYTICS: '#BA68C8',
  SENTIMENT: '#4DB6AC',
};

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

  const cardSx = {
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1.5,
    p: 1.5,
    transition: 'border-color 0.15s ease',
    '&:hover': { borderColor: 'text.secondary' },
  } as const;

  const headerSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 1.5,
  } as const;

  // ── Loading state ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Paper sx={cardSx}>
        <Box sx={headerSx}>
          <DataUsage sx={{ fontSize: 18, color: 'primary.main' }} />
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
          <DataUsage sx={{ fontSize: 18, color: 'primary.main' }} />
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
              startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
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
          <DataUsage sx={{ fontSize: 18, color: 'primary.main' }} />
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
        <DataUsage sx={{ fontSize: 18, color: 'primary.main' }} />
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

      {/* Feature bars — inline (horizontal) or stacked (vertical) */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isInline ? { xs: 'column', sm: 'row' } : 'column',
          gap: isInline ? { xs: 1.25, sm: 2 } : 1.25,
        }}
      >
        {featureEntries.map(([feature, tokens]) => {
          const limit = data.budgetByFeature[feature] ?? 0;
          const pct = limit > 0 ? Math.min((tokens / limit) * 100, 100) : 0;
          const color = FEATURE_COLORS[feature] ?? '#90A4AE';

          return (
            <Box key={feature} sx={{ flex: isInline ? 1 : undefined, minWidth: 0 }}>
              {/* Label row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography variant="caption" fontWeight={600} fontSize="0.7rem">
                  {feature}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
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
                  bgcolor: 'action.hover',
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
