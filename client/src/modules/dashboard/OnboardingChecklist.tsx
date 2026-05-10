import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  Person,
  Assignment,
  Group,
  Build,
  Notifications,
  Extension,
  Payment,
  ChatBubbleOutline,
  AccountBalanceWallet,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useOnboarding } from '../../hooks/useOnboarding';
import type { OnboardingStepWithStatus } from '../../hooks/useOnboarding';
import ICalImportModal from './ICalImportModal';

// ─── Step icon & CTA style mapping ─────────────────────────────────────────

interface StepVisual {
  icon: React.ReactNode;
  gradient: string;
  accentColor: string;
  actionIcon: React.ReactNode;
}

const STEP_VISUALS: Record<string, StepVisual> = {
  create_property: {
    icon: <Home size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
    accentColor: '#6B8A9A',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  configure_details: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
    accentColor: '#6B8A9A',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  define_pricing: {
    icon: <Euro size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
    accentColor: '#4A9B8E',
    actionIcon: <Euro size={14} strokeWidth={1.75} />,
  },
  connect_channels: {
    icon: <CalendarMonth size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #FF5A5F 0%, #FF8A8E 100%)',
    accentColor: '#FF5A5F',
    actionIcon: <Sync size={14} strokeWidth={1.75} />,
  },
  configure_billing: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #D4A574 0%, #E8C49A 100%)',
    accentColor: '#D4A574',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  configure_org: {
    icon: <Settings size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
    accentColor: '#6B8A9A',
    actionIcon: <Settings size={14} strokeWidth={1.75} />,
  },
  invite_members: {
    icon: <Group size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
    accentColor: '#4A9B8E',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  setup_settings: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #D4A574 0%, #E8C49A 100%)',
    accentColor: '#D4A574',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_fiscal: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #D4A574 0%, #E8C49A 100%)',
    accentColor: '#D4A574',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  setup_notifications: {
    icon: <Notifications size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #5C7AEA 0%, #7B95F0 100%)',
    accentColor: '#5C7AEA',
    actionIcon: <Notifications size={14} strokeWidth={1.75} />,
  },
  setup_general: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
    accentColor: '#6B8A9A',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_integrations: {
    icon: <Extension size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #9B59B6 0%, #B07CC6 100%)',
    accentColor: '#9B59B6',
    actionIcon: <Extension size={14} strokeWidth={1.75} />,
  },
  setup_payment: {
    icon: <Payment size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #E67E22 0%, #F0A050 100%)',
    accentColor: '#E67E22',
    actionIcon: <Payment size={14} strokeWidth={1.75} />,
  },
  setup_messaging: {
    icon: <ChatBubbleOutline size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #3498DB 0%, #5DADE2 100%)',
    accentColor: '#3498DB',
    actionIcon: <ChatBubbleOutline size={14} strokeWidth={1.75} />,
  },
  setup_payouts: {
    icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #27AE60 0%, #52C47A 100%)',
    accentColor: '#27AE60',
    actionIcon: <AccountBalanceWallet size={14} strokeWidth={1.75} />,
  },
  complete_profile: {
    icon: <Person size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
    accentColor: '#6B8A9A',
    actionIcon: <Person size={14} strokeWidth={1.75} />,
  },
  view_interventions: {
    icon: <Assignment size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
    accentColor: '#4A9B8E',
    actionIcon: <Build size={14} strokeWidth={1.75} />,
  },
  create_team: {
    icon: <Group size={16} strokeWidth={1.75} />,
    gradient: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
    accentColor: '#4A9B8E',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
};

const DEFAULT_VISUAL: StepVisual = {
  icon: <Settings size={16} strokeWidth={1.75} />,
  gradient: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
  accentColor: '#6B8A9A',
  actionIcon: <Settings size={14} strokeWidth={1.75} />,
};

// ─── Component ──────────────────────────────────────────────────────────────

const OnboardingChecklist: React.FC<{ onReady?: () => void }> = React.memo(({ onReady }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [icalOpen, setIcalOpen] = useState(false);

  const {
    steps,
    completedCount,
    totalCount,
    isAllCompleted,
    isDismissed,
    progressPercent,
    activeStep,
    isLoading,
    completeStep,
    dismiss,
    reset,
  } = useOnboarding();

  const handleDismiss = useCallback(() => dismiss(), [dismiss]);
  const handleReshow = useCallback(() => reset(), [reset]);

  const handleStepClick = useCallback((step: OnboardingStepWithStatus) => {
    if (step.completed || (!step.locked && step === activeStep)) {
      if (step.isModal && !step.completed) {
        setIcalOpen(true);
      } else {
        navigate(step.navigationPath);
      }
    }
  }, [activeStep, navigate]);

  const handleCtaAction = useCallback(() => {
    if (!activeStep) return;
    if (activeStep.isModal) {
      setIcalOpen(true);
    } else {
      navigate(activeStep.navigationPath);
    }
  }, [activeStep, navigate]);

  // Signal readiness when loading completes
  const readyFired = useRef(false);
  useEffect(() => {
    if (!isLoading && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [isLoading, onReady]);

  // Don't render while loading
  if (isLoading || totalCount === 0) return null;

  // Show a mini "re-show" button when dismissed and not all completed
  if (isDismissed && !isAllCompleted) {
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
          <Box component="span" sx={{ display: 'inline-flex', mr: 0.5 }}><Replay size={12} strokeWidth={1.75} /></Box>
          <Typography component="span" sx={{ fontSize: '0.65rem', fontWeight: 600 }}>
            {t('dashboard.onboarding.reshowShort')}
          </Typography>
        </IconButton>
      </Tooltip>
    );
  }

  // Auto-hide when all completed
  if (isAllCompleted) return null;

  const activeVisual = activeStep ? (STEP_VISUALS[activeStep.key] ?? DEFAULT_VISUAL) : null;

  return (
    <>
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: '10px',
          borderLeft: '3px solid',
          borderLeftColor: 'primary.main',
          px: 2,
          py: 1.25,
          height: '100%',
          '@keyframes shadowPulse': {
            '0%': {
              boxShadow: isDark
                ? '0 1px 6px rgba(0,0,0,0.3)'
                : '0 1px 6px rgba(107,138,154,0.10)',
            },
            '50%': {
              boxShadow: isDark
                ? '0 4px 20px rgba(107,138,154,0.35), 0 0 0 1px rgba(107,138,154,0.15)'
                : '0 6px 28px rgba(107,138,154,0.30), 0 0 0 1.5px rgba(107,138,154,0.20)',
            },
            '100%': {
              boxShadow: isDark
                ? '0 1px 6px rgba(0,0,0,0.3)'
                : '0 1px 6px rgba(107,138,154,0.10)',
            },
          },
          animation: 'shadowPulse 3s ease-in-out infinite',
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
            {t('dashboard.onboarding.progress', { completed: completedCount, total: totalCount })}
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
            <Close size={14} strokeWidth={1.75} />
          </IconButton>
        </Box>

        {/* ── Steps: horizontal row with wrapping ─────────────────── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {steps.map((step) => {
            const isActive = step === activeStep;
            const visual = STEP_VISUALS[step.key] ?? DEFAULT_VISUAL;

            return (
              <Box
                key={step.key}
                onClick={() => handleStepClick(step)}
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
                  borderColor: step.completed
                    ? (isDark ? 'rgba(74,155,142,0.25)' : 'rgba(74,155,142,0.15)')
                    : isActive
                      ? 'primary.main'
                      : 'divider',
                  bgcolor: step.completed
                    ? (isDark ? 'rgba(74,155,142,0.06)' : 'rgba(74,155,142,0.03)')
                    : isActive
                      ? (isDark ? 'rgba(107,138,154,0.08)' : 'rgba(107,138,154,0.04)')
                      : 'transparent',
                  cursor: step.locked ? 'default' : 'pointer',
                  opacity: step.locked ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  ...(!step.locked && {
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
                    bgcolor: step.completed
                      ? (isDark ? 'rgba(74,155,142,0.12)' : 'rgba(74,155,142,0.08)')
                      : isActive
                        ? (isDark ? 'rgba(107,138,154,0.15)' : 'rgba(107,138,154,0.10)')
                        : (isDark ? 'rgba(107,138,154,0.10)' : 'rgba(107,138,154,0.06)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: step.completed ? 'success.main' : isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {visual.icon}
                </Box>

                {/* Label */}
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 600,
                    lineHeight: 1.3,
                    flex: 1,
                    minWidth: 0,
                    color: step.completed ? 'text.disabled' : isActive ? 'text.primary' : 'text.secondary',
                    textDecoration: step.completed ? 'line-through' : 'none',
                  }}
                  noWrap
                >
                  {t(step.labelKey)}
                </Typography>

                {/* Status */}
                {step.completed ? (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'success.main', flexShrink: 0 }}><CheckCircle size={14} strokeWidth={1.75} /></Box>
                ) : step.locked ? (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', flexShrink: 0 }}><Lock size={12} strokeWidth={1.75} /></Box>
                ) : (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', flexShrink: 0 }}><RadioButtonUnchecked size={14} strokeWidth={1.75} /></Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* ── CTA: always show for the current active step ─────────── */}
        {activeStep && activeVisual && (
          <CtaSection
            icon={React.cloneElement(activeVisual.icon as React.ReactElement, { sx: { fontSize: 18, color: '#fff' } })}
            gradient={activeVisual.gradient}
            title={t(activeStep.labelKey)}
            description={t(activeStep.descriptionKey)}
            actionLabel={t(activeStep.labelKey)}
            actionIcon={activeVisual.actionIcon}
            onAction={handleCtaAction}
            isDark={isDark}
            accentColor={activeVisual.accentColor}
            skippable={activeStep.skippable}
            onSkip={() => completeStep(activeStep.key)}
            skipLabel={t('onboarding.skip')}
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
  skippable?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
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
  skippable,
  onSkip,
  skipLabel,
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      {skippable && onSkip && (
        <Button
          variant="text"
          size="small"
          onClick={onSkip}
          sx={{
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            '&:hover': {
              color: 'text.primary',
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          {skipLabel || 'Skip'}
        </Button>
      )}
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
  </Box>
);
