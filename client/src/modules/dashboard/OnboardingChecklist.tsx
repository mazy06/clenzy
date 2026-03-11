import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Tooltip,
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
  Replay,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { STORAGE_KEYS, getItem, setItem, removeItem } from '../../services/storageService';

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
    { label: t('dashboard.onboarding.definePricing'), done: hasPricing, path: '/tarification', icon: <Euro sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.connectChannels'), done: hasChannels, path: '/channels', icon: <Sync sx={{ fontSize: 16 }} /> },
  ], [t, hasProperties, hasPropertyDetails, hasPricing, hasChannels]);

  const completedCount = steps.filter((s) => s.done).length;
  const allCompleted = completedCount === steps.length;
  const progressPercent = (completedCount / steps.length) * 100;

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.ONBOARDING_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  const handleReshow = useCallback(() => {
    removeItem(STORAGE_KEYS.ONBOARDING_DISMISSED);
    setDismissed(false);
  }, []);

  // Show a mini "re-show" button when dismissed and not all completed
  if (dismissed && !allCompleted) {
    return (
      <Tooltip title={t('dashboard.onboarding.reshow')} arrow>
        <IconButton
          size="small"
          onClick={handleReshow}
          sx={{
            color: 'text.disabled',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: '8px',
            px: 1.5,
            py: 0.25,
            fontSize: '0.65rem',
            '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
          }}
        >
          <Replay sx={{ fontSize: 12, mr: 0.5 }} />
          <Typography component="span" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
            {t('dashboard.onboarding.reshowShort')}
          </Typography>
        </IconButton>
      </Tooltip>
    );
  }

  // Auto-hide when all completed
  if (allCompleted) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '10px',
        borderLeft: '3px solid',
        borderLeftColor: 'primary.main',
        boxShadow: isDark
          ? '0 1px 6px rgba(0,0,0,0.3)'
          : '0 1px 6px rgba(107,138,154,0.10)',
        px: 2,
        py: 1.25,
        height: '100%',
      }}
    >
      {/* ── Header row: title + progress + bar + dismiss ────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'text.secondary',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {t('dashboard.onboarding.title')}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.625rem',
            color: 'text.disabled',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {t('dashboard.onboarding.progress', { completed: completedCount, total: steps.length })}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            minWidth: 40,
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 2,
              background: 'linear-gradient(90deg, #6B8A9A 0%, #4A9B8E 100%)',
            },
          }}
        />
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'text.secondary' } }}
        >
          <Close sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* ── Steps: single horizontal row ─────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {steps.map((step, idx) => (
          <Box
            key={idx}
            onClick={() => navigate(step.path)}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: '8px',
              border: '1px solid',
              borderColor: step.done
                ? (isDark ? 'rgba(74,155,142,0.25)' : 'rgba(74,155,142,0.15)')
                : 'divider',
              bgcolor: step.done
                ? (isDark ? 'rgba(74,155,142,0.06)' : 'rgba(74,155,142,0.03)')
                : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-1px)',
                boxShadow: isDark
                  ? '0 2px 8px rgba(0,0,0,0.15)'
                  : '0 2px 8px rgba(107,138,154,0.10)',
              },
            }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: step.done
                  ? (isDark ? 'rgba(74,155,142,0.12)' : 'rgba(74,155,142,0.08)')
                  : (isDark ? 'rgba(107,138,154,0.10)' : 'rgba(107,138,154,0.06)'),
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
              noWrap
            >
              {step.label}
            </Typography>

            {/* Status */}
            {step.done ? (
              <CheckCircle sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
            ) : (
              <RadioButtonUnchecked sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
});

OnboardingChecklist.displayName = 'OnboardingChecklist';

export default OnboardingChecklist;
