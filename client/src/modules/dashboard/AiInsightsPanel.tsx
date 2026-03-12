import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp,
  Warning as WarningIcon,
  Lightbulb,
  BugReport,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import type { AiInsight } from '../../services/api/aiApi';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AiInsightsPanelProps {
  insights: AiInsight[] | undefined;
  loading: boolean;
  error: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<AiInsight['type'], { icon: React.ReactNode; color: string }> = {
  ANOMALY:        { icon: <BugReport sx={{ fontSize: 16 }} />,    color: '#E57373' },
  TREND:          { icon: <TrendingUp sx={{ fontSize: 16 }} />,   color: '#64B5F6' },
  RECOMMENDATION: { icon: <Lightbulb sx={{ fontSize: 16 }} />,    color: '#81C784' },
  WARNING:        { icon: <WarningIcon sx={{ fontSize: 16 }} />,  color: '#FFB74D' },
};

const SEVERITY_COLOR: Record<AiInsight['severity'], 'default' | 'warning' | 'error' | 'info'> = {
  LOW:      'default',
  MEDIUM:   'info',
  HIGH:     'warning',
  CRITICAL: 'error',
};

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

// ─── Component ──────────────────────────────────────────────────────────────

const AiInsightsPanel: React.FC<AiInsightsPanelProps> = React.memo(
  ({ insights, loading, error }) => {
    const { t } = useTranslation();

    // ── Loading state ─────────────────────────────────────────────────
    if (loading) {
      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <Lightbulb sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.insights.title')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={56} />
            ))}
          </Box>
        </Paper>
      );
    }

    // ── Error state ───────────────────────────────────────────────────
    if (error) {
      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <Lightbulb sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.insights.title')}
            </Typography>
          </Box>
          <Alert severity="error" sx={{ fontSize: '0.75rem' }}>
            {t('common.error')}
          </Alert>
        </Paper>
      );
    }

    // ── Empty state ───────────────────────────────────────────────────
    if (!insights || insights.length === 0) {
      return (
        <Paper sx={CARD_SX}>
          <Box sx={HEADER_SX}>
            <Lightbulb sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
              {t('bookingEngine.ai.insights.title')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" fontSize="0.75rem">
            {t('bookingEngine.ai.insights.noInsights')}
          </Typography>
        </Paper>
      );
    }

    // ── Content ───────────────────────────────────────────────────────
    return (
      <Paper sx={CARD_SX}>
        <Box sx={HEADER_SX}>
          <Lightbulb sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
            {t('bookingEngine.ai.insights.title')}
          </Typography>
          <Chip
            label={`${insights.length}`}
            size="small"
            color="primary"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {insights.map((insight, idx) => {
            const typeConf = TYPE_CONFIG[insight.type];
            return (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  gap: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  alignItems: 'flex-start',
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    height: 28,
                    borderRadius: 0.75,
                    bgcolor: `${typeConf.color}20`,
                    color: typeConf.color,
                    mt: 0.25,
                  }}
                >
                  {typeConf.icon}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      fontSize="0.75rem"
                      noWrap
                      sx={{ flex: 1 }}
                    >
                      {insight.title}
                    </Typography>
                    <Chip
                      label={insight.severity}
                      size="small"
                      color={SEVERITY_COLOR[insight.severity]}
                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', lineHeight: 1.3, fontSize: '0.7rem' }}
                  >
                    {insight.description}
                  </Typography>
                  {insight.recommendation && (
                    <Typography
                      variant="caption"
                      color="primary.main"
                      sx={{
                        display: 'block',
                        mt: 0.25,
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        lineHeight: 1.3,
                      }}
                    >
                      → {insight.recommendation}
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    );
  },
);

AiInsightsPanel.displayName = 'AiInsightsPanel';

export default AiInsightsPanel;
