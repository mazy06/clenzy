import React from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Alert, AlertDescription } from '../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Box, Typography, Paper, CircularProgress, Skeleton, Tooltip, Button } from '@mui/material';
import {
  AutoAwesome,
  TrendingUp,
  TrendingDown,
  Settings as SettingsIcon,
} from '../../icons';
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
  borderColor: 'var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 1.5,
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'var(--line-2)' },
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

function confidenceTone(confidence: number): StatusTone {
  if (confidence >= 0.7) return 'ok';
  if (confidence >= 0.4) return 'warn';
  return 'err';
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
            <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.pricing.title')}
            </Typography>
          </Box>
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </div>
        </Paper>
      );
    }

    // ── Error state ───────────────────────────────────────────────────
    if (isError) {
      const aiNotConfigured = isAiNotConfiguredError(error);

      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.pricing.title')}
            </Typography>
          </Box>
          {aiNotConfigured ? (
            <Alert variant="info" className="text-[0.75rem]">
              <Info />
              <AlertDescription><Typography variant="body2" fontSize="0.75rem" sx={{ mb: 1 }}>
                {t('bookingEngine.ai.guidance.pricing.text')}
              </Typography><Button
                size="small"
                variant="outlined"
                startIcon={<SettingsIcon size={14} strokeWidth={1.75} />}
                onClick={() => navigate('/settings')}
                sx={{ textTransform: 'none', fontSize: '0.7rem' }}
              >
                {t('bookingEngine.ai.guidance.pricing.button')}
              </Button></AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="text-[0.75rem]">
              <TriangleAlert />
              <AlertDescription>{t('common.error')}</AlertDescription>
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
            <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
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
          <span className="inline-flex text-primary"><AutoAwesome size={18} strokeWidth={1.75} /></span>
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.pricing.title')}
          </Typography>
          <Badge variant="default" className="h-[20px] text-[0.65rem] font-bold">{`${data.length}`}</Badge>
        </Box>

        <div className="flex flex-col gap-1.5">
          {data.map((rec) => (
            <div className="flex items-center gap-2 p-1.5 rounded-[1px] bg-[action.hover]" key={rec.date}>
              {/* Date */}
              <div className="min-w-[60px]">
                <Typography variant="caption" fontWeight={600} fontSize="0.7rem">
                  {rec.date}
                </Typography>
              </div>

              {/* Suggested Price */}
              <div className="min-w-[70px] text-end">
                <Typography variant="body2" fontWeight={700} fontSize="0.85rem" color="primary.main">
                  {rec.suggestedPrice.toFixed(0)} €
                </Typography>
              </div>

              {/* Confidence */}
              <Tooltip title={`${t('bookingEngine.ai.pricing.confidence')}: ${(rec.confidence * 100).toFixed(0)}%`}>
                {/* Le `span` porte la ref que Tooltip pose sur son enfant :
                    StatusChip est une fonction et n'en transmet pas. */}
                <span className="inline-flex">
                  <StatusChip
                    tone={confidenceTone(rec.confidence)}
                    size="sm"
                    label={`${(rec.confidence * 100).toFixed(0)}%`}
                    className="text-[0.6rem]"
                  />
                </span>
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
            </div>
          ))}
        </div>

        {/* Market comparison from first recommendation */}
        {data[0]?.marketComparison && (
          <div className="mt-2 pt-1.5 border-t border-[divider]">
            <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
              {t('bookingEngine.ai.pricing.marketComparison')}: {data[0].marketComparison}
            </Typography>
          </div>
        )}
      </Paper>
    );
  },
);

AiPricingRecommendations.displayName = 'AiPricingRecommendations';

export default AiPricingRecommendations;
