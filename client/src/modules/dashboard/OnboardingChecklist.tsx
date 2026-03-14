import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Tooltip,
  Button,
  useTheme,
} from '@mui/material';
import {
  CheckCircle,
  RadioButtonUnchecked,
  Home,
  Tune,
  Euro,
  Sync,
  Receipt,
  Close,
  Replay,
  Add,
  CalendarMonth,
  Settings,
  Lock,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { STORAGE_KEYS, getItem, setItem, removeItem } from '../../services/storageService';
import ICalImportModal from './ICalImportModal';

// ─── Props ──────────────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  hasProperties: boolean;
  hasPropertyDetails: boolean;
  hasPricing: boolean;
  hasChannels: boolean;
  hasBillingProfile: boolean;
}

// ─── Step CTA config ────────────────────────────────────────────────────────

interface StepCta {
  icon: React.ReactNode;
  gradient: string;
  titleKey: string;
  descriptionKey: string;
  actionKey: string;
  actionIcon: React.ReactNode;
  accentColor: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = React.memo(({
  hasProperties,
  hasPropertyDetails,
  hasPricing,
  hasChannels,
  hasBillingProfile,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [dismissed, setDismissed] = useState(
    () => getItem(STORAGE_KEYS.ONBOARDING_DISMISSED) === 'true',
  );
  const [icalOpen, setIcalOpen] = useState(false);

  const steps = useMemo(() => [
    { label: t('dashboard.onboarding.createProperty'), done: hasProperties, path: '/properties/new', icon: <Home sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.configureDetails'), done: hasPropertyDetails, path: '/properties', icon: <Tune sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.definePricing'), done: hasPricing, path: '/properties?tab=1', icon: <Euro sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.connectChannels'), done: hasChannels, path: '/channels', icon: <Sync sx={{ fontSize: 16 }} /> },
    { label: t('dashboard.onboarding.configureBilling'), done: hasBillingProfile, path: '/settings?tab=4', icon: <Receipt sx={{ fontSize: 16 }} /> },
  ], [t, hasProperties, hasPropertyDetails, hasPricing, hasChannels, hasBillingProfile]);

  // CTA config for each step
  const stepCtas: StepCta[] = useMemo(() => [
    {
      icon: <Home sx={{ fontSize: 18, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
      titleKey: 'dashboard.emptyState.title',
      descriptionKey: 'dashboard.emptyState.description',
      actionKey: 'dashboard.emptyState.cta',
      actionIcon: <Add sx={{ fontSize: 14 }} />,
      accentColor: '#6B8A9A',
    },
    {
      icon: <Tune sx={{ fontSize: 18, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
      titleKey: 'dashboard.onboarding.detailsCta.title',
      descriptionKey: 'dashboard.onboarding.detailsCta.description',
      actionKey: 'dashboard.onboarding.detailsCta.action',
      actionIcon: <Tune sx={{ fontSize: 14 }} />,
      accentColor: '#6B8A9A',
    },
    {
      icon: <Euro sx={{ fontSize: 18, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
      titleKey: 'dashboard.onboarding.pricingCta.title',
      descriptionKey: 'dashboard.onboarding.pricingCta.description',
      actionKey: 'dashboard.onboarding.pricingCta.action',
      actionIcon: <Euro sx={{ fontSize: 14 }} />,
      accentColor: '#4A9B8E',
    },
    {
      icon: <CalendarMonth sx={{ fontSize: 18, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #FF5A5F 0%, #FF8A8E 100%)',
      titleKey: 'dashboard.onboarding.channelsCta.title',
      descriptionKey: 'dashboard.onboarding.channelsCta.description',
      actionKey: 'dashboard.onboarding.channelsCta.action',
      actionIcon: <Sync sx={{ fontSize: 14 }} />,
      accentColor: '#FF5A5F',
    },
    {
      icon: <Settings sx={{ fontSize: 18, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #D4A574 0%, #E8C49A 100%)',
      titleKey: 'dashboard.onboarding.billingCta.title',
      descriptionKey: 'dashboard.onboarding.billingCta.description',
      actionKey: 'dashboard.onboarding.billingCta.action',
      actionIcon: <Receipt sx={{ fontSize: 14 }} />,
      accentColor: '#D4A574',
    },
  ], []);

  const completedCount = steps.filter((s) => s.done).length;
  const allCompleted = completedCount === steps.length;
  const progressPercent = (completedCount / steps.length) * 100;

  // Active step = first uncompleted step (sequential order)
  const activeStepIdx = steps.findIndex((s) => !s.done);

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.ONBOARDING_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  const handleReshow = useCallback(() => {
    removeItem(STORAGE_KEYS.ONBOARDING_DISMISSED);
    setDismissed(false);
  }, []);

  const handleStepClick = useCallback((idx: number) => {
    const step = steps[idx];
    // Allow click on completed steps or the current active step
    if (step.done || idx === activeStepIdx) {
      // Step 4 (channels) opens iCal modal instead of navigating
      if (idx === 3 && !step.done) {
        setIcalOpen(true);
      } else {
        navigate(step.path);
      }
    }
  }, [steps, activeStepIdx, navigate]);

  const handleCtaAction = useCallback((idx: number) => {
    // Step 4 (channels) opens iCal modal
    if (idx === 3) {
      setIcalOpen(true);
    } else {
      navigate(steps[idx].path);
    }
  }, [steps, navigate]);

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

  const activeCta = activeStepIdx >= 0 ? stepCtas[activeStepIdx] : null;

  return (
    <>
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

        {/* ── Steps: horizontal row with wrapping ─────────────────── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {steps.map((step, idx) => {
            const isActive = idx === activeStepIdx;
            const isLocked = !step.done && idx > activeStepIdx;

            return (
              <Box
                key={idx}
                onClick={() => handleStepClick(idx)}
                sx={{
                  flex: '1 1 auto',
                  minWidth: { xs: 'calc(50% - 4px)', sm: 'auto' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: step.done
                    ? (isDark ? 'rgba(74,155,142,0.25)' : 'rgba(74,155,142,0.15)')
                    : isActive
                      ? 'primary.main'
                      : 'divider',
                  bgcolor: step.done
                    ? (isDark ? 'rgba(74,155,142,0.06)' : 'rgba(74,155,142,0.03)')
                    : isActive
                      ? (isDark ? 'rgba(107,138,154,0.08)' : 'rgba(107,138,154,0.04)')
                      : 'transparent',
                  cursor: isLocked ? 'default' : 'pointer',
                  opacity: isLocked ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  ...(!isLocked && {
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-1px)',
                      boxShadow: isDark
                        ? '0 2px 8px rgba(0,0,0,0.15)'
                        : '0 2px 8px rgba(107,138,154,0.10)',
                    },
                  }),
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
                      : isActive
                        ? (isDark ? 'rgba(107,138,154,0.15)' : 'rgba(107,138,154,0.10)')
                        : (isDark ? 'rgba(107,138,154,0.10)' : 'rgba(107,138,154,0.06)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: step.done ? 'success.main' : isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {step.icon}
                </Box>

                {/* Label */}
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 600,
                    lineHeight: 1.3,
                    flex: 1,
                    minWidth: 0,
                    color: step.done ? 'text.disabled' : isActive ? 'text.primary' : 'text.secondary',
                    textDecoration: step.done ? 'line-through' : 'none',
                  }}
                  noWrap
                >
                  {step.label}
                </Typography>

                {/* Status */}
                {step.done ? (
                  <CheckCircle sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                ) : isLocked ? (
                  <Lock sx={{ fontSize: 12, color: 'text.disabled', flexShrink: 0 }} />
                ) : (
                  <RadioButtonUnchecked sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                )}
              </Box>
            );
          })}
        </Box>

        {/* ── CTA: always show for the current active step ─────────── */}
        {activeCta && (
          <CtaSection
            icon={activeCta.icon}
            gradient={activeCta.gradient}
            title={t(activeCta.titleKey)}
            description={t(activeCta.descriptionKey)}
            actionLabel={t(activeCta.actionKey)}
            actionIcon={activeCta.actionIcon}
            onAction={() => handleCtaAction(activeStepIdx)}
            isDark={isDark}
            accentColor={activeCta.accentColor}
          />
        )}
      </Box>

      {/* iCal Import Modal */}
      <ICalImportModal
        open={icalOpen}
        onClose={() => setIcalOpen(false)}
      />
    </>
  );
});

OnboardingChecklist.displayName = 'OnboardingChecklist';

export default OnboardingChecklist;

// ─── Reusable CTA Section ────────────────────────────────────────────────────

interface CtaSectionProps {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  isDark: boolean;
  accentColor?: string;
}

const CtaSection: React.FC<CtaSectionProps> = ({
  icon,
  gradient,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  isDark,
  accentColor = '#6B8A9A',
}) => (
  <Box
    sx={{
      mt: 1.5,
      pt: 1.5,
      borderTop: '1px solid',
      borderTopColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
    }}
  >
    <Box
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 2px 8px ${accentColor}33`,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5, mt: 0.25 }}>
        {description}
      </Typography>
    </Box>
    <Button
      variant="contained"
      size="small"
      startIcon={actionIcon}
      onClick={onAction}
      sx={{
        background: gradient,
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.75rem',
        textTransform: 'none',
        borderRadius: '8px',
        px: 2,
        py: 0.5,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : `0 2px 8px ${accentColor}40`,
        '&:hover': {
          filter: 'brightness(0.9)',
          boxShadow: `0 4px 12px ${accentColor}55`,
        },
      }}
    >
      {actionLabel}
    </Button>
  </Box>
);
