import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  Tooltip,
  Button,
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

// Aplats tokens Signature — les anciens dégradés deviennent des fonds unis
// (le champ `gradient` reste le fond du CTA, désormais une couleur token).
const STEP_VISUALS: Record<string, StepVisual> = {
  create_property: {
    icon: <Home size={16} strokeWidth={1.75} />,
    gradient: 'var(--accent)',
    accentColor: 'var(--accent)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  configure_details: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'var(--accent)',
    accentColor: 'var(--accent)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  define_pricing: {
    icon: <Euro size={16} strokeWidth={1.75} />,
    gradient: 'var(--ok)',
    accentColor: 'var(--ok)',
    actionIcon: <Euro size={14} strokeWidth={1.75} />,
  },
  connect_channels: {
    icon: <CalendarMonth size={16} strokeWidth={1.75} />,
    gradient: 'var(--airbnb)',
    accentColor: 'var(--airbnb)',
    actionIcon: <Sync size={14} strokeWidth={1.75} />,
  },
  configure_billing: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    gradient: 'var(--warn)',
    accentColor: 'var(--warn)',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  configure_org: {
    icon: <Settings size={16} strokeWidth={1.75} />,
    gradient: 'var(--accent)',
    accentColor: 'var(--accent)',
    actionIcon: <Settings size={14} strokeWidth={1.75} />,
  },
  invite_members: {
    icon: <Group size={16} strokeWidth={1.75} />,
    gradient: 'var(--ok)',
    accentColor: 'var(--ok)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  setup_settings: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'var(--warn)',
    accentColor: 'var(--warn)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_fiscal: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    gradient: 'var(--warn)',
    accentColor: 'var(--warn)',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  setup_notifications: {
    icon: <Notifications size={16} strokeWidth={1.75} />,
    gradient: 'var(--info)',
    accentColor: 'var(--info)',
    actionIcon: <Notifications size={14} strokeWidth={1.75} />,
  },
  setup_general: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    gradient: 'var(--accent)',
    accentColor: 'var(--accent)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_integrations: {
    icon: <Extension size={16} strokeWidth={1.75} />,
    gradient: 'var(--info)',
    accentColor: 'var(--info)',
    actionIcon: <Extension size={14} strokeWidth={1.75} />,
  },
  setup_payment: {
    icon: <Payment size={16} strokeWidth={1.75} />,
    gradient: 'var(--warn)',
    accentColor: 'var(--warn)',
    actionIcon: <Payment size={14} strokeWidth={1.75} />,
  },
  setup_messaging: {
    icon: <ChatBubbleOutline size={16} strokeWidth={1.75} />,
    gradient: 'var(--info)',
    accentColor: 'var(--info)',
    actionIcon: <ChatBubbleOutline size={14} strokeWidth={1.75} />,
  },
  setup_payouts: {
    icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />,
    gradient: 'var(--ok)',
    accentColor: 'var(--ok)',
    actionIcon: <AccountBalanceWallet size={14} strokeWidth={1.75} />,
  },
  complete_profile: {
    icon: <Person size={16} strokeWidth={1.75} />,
    gradient: 'var(--accent)',
    accentColor: 'var(--accent)',
    actionIcon: <Person size={14} strokeWidth={1.75} />,
  },
  view_interventions: {
    icon: <Assignment size={16} strokeWidth={1.75} />,
    gradient: 'var(--ok)',
    accentColor: 'var(--ok)',
    actionIcon: <Build size={14} strokeWidth={1.75} />,
  },
  create_team: {
    icon: <Group size={16} strokeWidth={1.75} />,
    gradient: 'var(--ok)',
    accentColor: 'var(--ok)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
};

const DEFAULT_VISUAL: StepVisual = {
  icon: <Settings size={16} strokeWidth={1.75} />,
  gradient: 'var(--accent)',
  accentColor: 'var(--accent)',
  actionIcon: <Settings size={14} strokeWidth={1.75} />,
};

// ─── Component ──────────────────────────────────────────────────────────────

const OnboardingChecklist: React.FC<{ onReady?: () => void }> = React.memo(({ onReady }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
            borderColor: 'var(--line-2)',
            borderRadius: 'var(--radius-md)',
            px: 1.5,
            py: 0.25,
            fontSize: '0.65rem',
            '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
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
          bgcolor: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          px: 2,
          py: 1.25,
          height: '100%',
          '@keyframes shadowPulse': {
            '0%': {
              boxShadow: 'none',
            },
            '50%': {
              boxShadow: '0 6px 28px color-mix(in srgb, var(--accent) 25%, transparent), 0 0 0 1.5px color-mix(in srgb, var(--accent) 20%, transparent)',
            },
            '100%': {
              boxShadow: 'none',
            },
          },
          animation: 'shadowPulse 3s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
        }}
      >
        {/* ── Header row: title + progress + bar + dismiss ────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Typography
            sx={{
              fontSize: '10.5px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--faint)',
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
              bgcolor: 'var(--field)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: 'var(--accent)',
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
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  borderColor: step.completed
                    ? 'color-mix(in srgb, var(--ok) 25%, transparent)'
                    : isActive
                      ? 'var(--accent)'
                      : 'var(--line)',
                  bgcolor: step.completed
                    ? 'color-mix(in srgb, var(--ok) 5%, transparent)'
                    : isActive
                      ? 'var(--accent-soft)'
                      : 'transparent',
                  cursor: step.locked ? 'default' : 'pointer',
                  opacity: step.locked ? 0.45 : 1,
                  transition: 'all 0.15s ease',
                  ...(!step.locked && {
                    '&:hover': {
                      borderColor: 'var(--accent)',
                      transform: 'translateY(-1px)',
                      boxShadow: 'var(--shadow-card)',
                    },
                  }),
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                    '&:hover': { transform: 'none' },
                  },
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--radius-sm)',
                    bgcolor: step.completed
                      ? 'var(--ok-soft)'
                      : isActive
                        ? 'var(--accent-soft)'
                        : 'var(--hover)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: step.completed ? 'var(--ok)' : isActive ? 'var(--accent)' : 'text.secondary',
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
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)', flexShrink: 0 }}><CheckCircle size={14} strokeWidth={1.75} /></Box>
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
            icon={React.cloneElement(activeVisual.icon as React.ReactElement, { sx: { fontSize: 18, color: 'var(--on-accent)' } })}
            gradient={activeVisual.gradient}
            title={t(activeStep.labelKey)}
            description={t(activeStep.descriptionKey)}
            actionLabel={t(activeStep.labelKey)}
            actionIcon={activeVisual.actionIcon}
            onAction={handleCtaAction}
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
  accentColor = 'var(--accent)',
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
        borderRadius: 'var(--radius-md)',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 20%, transparent)`,
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
              bgcolor: 'var(--hover)',
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
          color: 'var(--on-accent)',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'none',
          borderRadius: 'var(--radius-md)',
          px: 2,
          py: 0.5,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 25%, transparent)`,
          '&:hover': {
            filter: 'brightness(0.9)',
            boxShadow: `0 4px 12px color-mix(in srgb, ${accentColor} 33%, transparent)`,
          },
        }}
      >
        {actionLabel}
      </Button>
    </Box>
  </Box>
);
