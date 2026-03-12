import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Skeleton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  AutoAwesome,
  TrendingUp,
  TrendingDown,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiPricingPredictions } from '../../hooks/useAi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiPricingRecommendationsProps {
  propertyId: number;
  from: string;
  to: string;
  enabled?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  p: 1.5,
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  mb: 1.5,
} as const;

function isAiNotConfiguredError(error: unknown): boolean {
  const apiErr = error as { details?: Record<string, unknown> } | undefined;
  const errorCode = apiErr?.details?.errorCode;
  return errorCode === 'AI_NOT_CONFIGURED' || errorCode === 'AI_FEATURE_DISABLED';
}

function confidenceColor(confidence: number): 'success' | 'warning' | 'error' {
  if (confidence >= 0.7) return 'success';
  if (confidence >= 0.4) return 'warning';
  return 'error';
}

// ─── Component ──────────────────────────────────────────────────────────────

const AiPricingRecommendations: React.FC<AiPricingRecommendationsProps> = React.memo(
  ({ propertyId, from, to, enabled = true }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data, isLoading, isError, error } = useAiPricingPredictions(
      propertyId,
      from,
      to,
      enabled,
    );

    // ── Loading state ─────────────────────────────────────────────────
    if (isLoading) {
      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.pricing.title')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Box>
        </Paper>
      );
    }

    // ── Error state ───────────────────────────────────────────────────
    if (isError) {
      const aiNotConfigured = isAiNotConfiguredError(error);

      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.pricing.title')}
            </Typography>
          </Box>
          {aiNotConfigured ? (
            <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
              <Typography variant="body2" fontSize="0.75rem" sx={{ mb: 1 }}>
                {t('bookingEngine.ai.guidance.pricing.text')}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
                onClick={() => navigate('/settings')}
                sx={{ textTransform: 'none', fontSize: '0.7rem' }}
              >
                {t('bookingEngine.ai.guidance.pricing.button')}
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

    // ── Empty state ───────────────────────────────────────────────────
    if (!data || data.length === 0) {
      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.pricing.title')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
            {t('bookingEngine.ai.pricing.loading')}
          </Typography>
        </Paper>
      );
    }

    // ── Content ───────────────────────────────────────────────────────
    return (
      <Paper sx={CARD_SX}>
        <Box sx={HEADER_SX}>
          <AutoAwesome sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.pricing.title')}
          </Typography>
          <Chip
            label={`${data.length}`}
            size="small"
            color="primary"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.map((rec, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              {/* Date */}
              <Box sx={{ minWidth: 60 }}>
                <Typography variant="caption" fontWeight={600} fontSize="0.7rem">
                  {rec.date}
                </Typography>
              </Box>

              {/* Suggested Price */}
              <Box sx={{ minWidth: 70, textAlign: 'right' }}>
                <Typography variant="body2" fontWeight={700} fontSize="0.85rem" color="primary.main">
                  {rec.suggestedPrice.toFixed(0)} €
                </Typography>
              </Box>

              {/* Confidence */}
              <Tooltip title={`${t('bookingEngine.ai.pricing.confidence')}: ${(rec.confidence * 100).toFixed(0)}%`}>
                <Chip
                  label={`${(rec.confidence * 100).toFixed(0)}%`}
                  size="small"
                  color={confidenceColor(rec.confidence)}
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                />
              </Tooltip>

              {/* Explanation */}
              <Typography
                variant="caption"
                color="text.secondary"
                fontSize="0.7rem"
                sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {rec.explanation}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Market comparison from first recommendation */}
        {data[0]?.marketComparison && (
          <Box
            sx={{
              mt: 1.5,
              pt: 1,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
              {t('bookingEngine.ai.pricing.marketComparison')}: {data[0].marketComparison}
            </Typography>
          </Box>
        )}
      </Paper>
    );
  },
);

AiPricingRecommendations.displayName = 'AiPricingRecommendations';

export default AiPricingRecommendations;
