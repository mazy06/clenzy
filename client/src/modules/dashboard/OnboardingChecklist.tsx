import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Grid,
  IconButton,
  useTheme,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Home,
  Tune,
  Euro,
  Sync,
  Close,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { STORAGE_KEYS, getItem, setItem } from '../../services/storageService';

// ─── Props ──────────────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  hasProperties: boolean;
  hasPropertyDetails: boolean;
  hasPricing: boolean;
  hasChannels: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = React.memo(({
  hasProperties,
  hasPropertyDetails,
  hasPricing,
  hasChannels,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [dismissed, setDismissed] = useState(
    () => getItem(STORAGE_KEYS.ONBOARDING_DISMISSED) === 'true',
  );

  const steps = useMemo(() => [
    { label: t('dashboard.onboarding.createProperty'), done: hasProperties, path: '/properties/new', icon: <Home sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.configureDetails'), done: hasPropertyDetails, path: '/properties', icon: <Tune sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.definePricing'), done: hasPricing, path: '/pricing', icon: <Euro sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.connectChannels'), done: hasChannels, path: '/settings', icon: <Sync sx={{ fontSize: 16 }} /> },
  ], [t, hasProperties, hasPropertyDetails, hasPricing, hasChannels]);

  const completedCount = steps.filter((s) => s.done).length;
  const allCompleted = completedCount === steps.length;
  const progressPercent = (completedCount / steps.length) * 100;

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.ONBOARDING_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  // Auto-hide when dismissed or all completed
  if (dismissed || allCompleted) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(107,138,154,0.12)',
        p: 2.5,
        mb: 2,
      }}
    >
      {/* ── Header row: title + progress + dismiss ────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'text.secondary',
              lineHeight: 1.2,
            }}
          >
            {t('dashboard.onboarding.title')}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6875rem',
              color: 'text.disabled',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('dashboard.onboarding.progress', { completed: completedCount, total: steps.length })}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{
            color: 'text.disabled',
            '&:hover': { color: 'text.secondary' },
          }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Progress bar with gradient ────────────────────────────── */}
      <LinearProgress
        variant="determinate"
        value={progressPercent}
        sx={{
          height: 6,
          borderRadius: 3,
          mb: 2,
          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            background: 'linear-gradient(90deg, #6B8A9A 0%, #4A9B8E 100%)',
          },
        }}
      />

      {/* ── Steps: horizontal cards on desktop, 2-up on tablet, stacked mobile ── */}
      <Grid container spacing={1.5}>
        {steps.map((step, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Box
              onClick={() => navigate(step.path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1.25,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: step.done
                  ? (isDark ? 'rgba(74,155,142,0.3)' : 'rgba(74,155,142,0.2)')
                  : 'divider',
                bgcolor: step.done
                  ? (isDark ? 'rgba(74,155,142,0.08)' : 'rgba(74,155,142,0.04)')
                  : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(107,138,154,0.02)'),
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: isDark
                    ? '0 4px 12px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(107,138,154,0.12)',
                },
              }}
            >
              {/* Icon circle */}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: step.done
                    ? (isDark ? 'rgba(74,155,142,0.15)' : 'rgba(74,155,142,0.10)')
                    : (isDark ? 'rgba(107,138,154,0.12)' : 'rgba(107,138,154,0.08)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: step.done ? 'success.main' : 'text.secondary',
                }}
              >
                {step.icon}
              </Box>

              {/* Label */}
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  flex: 1,
                  minWidth: 0,
                  color: step.done ? 'text.disabled' : 'text.primary',
                  textDecoration: step.done ? 'line-through' : 'none',
                }}
              >
                {step.label}
              </Typography>

              {/* Status indicator */}
              {step.done ? (
                <CheckCircle sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />
              ) : (
                <RadioButtonUnchecked sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />
              )}
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
});

OnboardingChecklist.displayName = 'OnboardingChecklist';

export default OnboardingChecklist;
