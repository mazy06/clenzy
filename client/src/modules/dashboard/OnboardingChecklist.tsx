import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Button,
  Progress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
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
import { cn } from '../../utils/cn';

// Le @keyframes du halo vivait dans le `sx` MUI, qui l'injectait lui-meme dans
// le document. Sans MUI il faut une vraie feuille : posee une seule fois au
// chargement du module (idempotent).
const ONBOARDING_KEYFRAMES_ID = 'onboarding-checklist-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(ONBOARDING_KEYFRAMES_ID)) {
  const styleEl = document.createElement('style');
  styleEl.id = ONBOARDING_KEYFRAMES_ID;
  styleEl.textContent =
    '@keyframes onboarding-shadow-pulse{0%,100%{box-shadow:none}'
    + '50%{box-shadow:0 6px 28px color-mix(in srgb, var(--accent) 25%, transparent), 0 0 0 1.5px color-mix(in srgb, var(--accent) 20%, transparent)}}';
  document.head.appendChild(styleEl);
}

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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReshow}
            className="h-auto px-[9px] py-[1.5px] text-[0.65rem] rounded-[var(--radius-md)] border border-dashed border-[var(--line-2)] text-[var(--faint)] hover:bg-transparent hover:text-[var(--accent)] hover:border-[var(--accent)]"
          >
            <span className="inline-flex me-0.5"><Replay size={12} strokeWidth={1.75} /></span>
            <span className="text-[0.65rem] font-semibold">
              {t('dashboard.onboarding.reshowShort')}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('dashboard.onboarding.reshow')}</TooltipContent>
      </Tooltip>
    );
  }

  // Auto-hide when all completed
  if (isAllCompleted) return null;

  const activeVisual = activeStep ? (STEP_VISUALS[activeStep.key] ?? DEFAULT_VISUAL) : null;

  return (
    <>
      {/* px: 2 = 12 px, py: 1.25 = 7,5 px (theme.spacing vaut 6 dans ce projet). */}
      <div
        className={cn(
          'bg-[var(--card)] border border-solid border-[var(--line)] rounded-[var(--radius-lg)] px-3 py-[7.5px] h-full',
          'animate-[onboarding-shadow-pulse_3s_ease-in-out_infinite] motion-reduce:animate-none',
        )}
      >
        {/* ── Header row: title + progress + bar + dismiss ────────── */}
        <div className="flex items-center gap-2 mb-1.5">
          <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)] leading-[1] whitespace-nowrap">
            {t('dashboard.onboarding.title')}
          </p>
          <span className="cn-text-caption text-[0.625rem] text-muted-foreground opacity-60 font-semibold tabular-nums whitespace-nowrap">
            {t('dashboard.onboarding.progress', { completed: completedCount, total: totalCount })}
          </span>
          <Progress
            value={progressPercent}
            className="flex-1 min-w-[40px] h-[4px] rounded-full bg-[var(--field)] [&_[data-slot=progress-indicator]]:bg-[var(--accent)] [&_[data-slot=progress-indicator]]:rounded-full"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('dashboard.onboarding.dismiss', 'Masquer')}
            onClick={handleDismiss}
            className="text-[var(--faint)] hover:bg-transparent hover:text-[var(--muted)]"
          >
            <Close size={14} strokeWidth={1.75} />
          </Button>
        </div>

        {/* ── Steps: horizontal row with wrapping ─────────────────── */}
        <div className="flex gap-1.5 flex-wrap">
          {steps.map((step) => {
            const isActive = step === activeStep;
            const visual = STEP_VISUALS[step.key] ?? DEFAULT_VISUAL;

            return (
              <div
                key={step.key}
                onClick={() => handleStepClick(step)}
                // sm MUI = 600px (breakpoints par defaut), pas le sm=640 de Tailwind.
                className={cn(
                  'flex-auto min-w-[calc(50%_-_4px)] min-[600px]:min-w-[auto] flex items-center gap-1.5',
                  'px-[7.5px] py-[4.5px] rounded-[var(--radius-md)] border border-solid',
                  '[transition:all_0.15s_ease] motion-reduce:[transition:none]',
                  step.completed
                    ? 'border-[color-mix(in_srgb,var(--ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--ok)_5%,transparent)]'
                    : isActive
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] bg-transparent',
                  step.locked
                    ? 'cursor-default opacity-45'
                    : 'cursor-pointer hover:border-[var(--accent)] hover:-translate-y-px hover:shadow-[var(--shadow-card)] motion-reduce:hover:translate-y-0',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
                    step.completed
                      ? 'bg-[var(--ok-soft)] text-[var(--ok)]'
                      : isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--hover)] text-[var(--muted)]',
                  )}
                >
                  {visual.icon}
                </div>

                {/* Label */}
                <p className={cn('cn-text-body1 text-[0.75rem] leading-[1.3] flex-1 min-w-0 truncate', isActive ? 'font-bold' : 'font-semibold', step.completed ? 'text-[var(--faint)]' : isActive ? 'text-[var(--ink)]' : 'text-[var(--muted)]', step.completed ? 'decoration-[line-through]' : 'decoration-[none]')}>
                  {t(step.labelKey)}
                </p>

                {/* Status */}
                {step.completed ? (
                  <span className="inline-flex text-[var(--ok)] shrink-0"><CheckCircle size={14} strokeWidth={1.75} /></span>
                ) : step.locked ? (
                  <span className="inline-flex text-muted-foreground opacity-60 shrink-0"><Lock size={12} strokeWidth={1.75} /></span>
                ) : (
                  <span className="inline-flex text-muted-foreground opacity-60 shrink-0"><RadioButtonUnchecked size={14} strokeWidth={1.75} /></span>
                )}
              </div>
            );
          })}
        </div>

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
      </div>

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
  <div className="mt-[9px] pt-[9px] border-t border-solid border-t-[var(--line)] flex items-center gap-3">
    <div className="w-[36px] h-[36px] rounded-[var(--radius-md)] flex items-center justify-center shrink-0" style={{ background: gradient, boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 20%, transparent)` }}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="cn-text-body1 text-[0.85rem] font-bold text-foreground leading-[1.3]">
        {title}
      </p>
      <p className="cn-text-body1 text-[0.75rem] text-muted-foreground leading-[1.5] mt-0.5">
        {description}
      </p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {skippable && onSkip && (
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {skipLabel || 'Skip'}
        </Button>
      )}
      {/* Le CTA portait un aplat par etape (var(--accent)/--ok/--warn) : c'est
          deja la pastille d'icone a gauche qui porte ce signal. Le bouton reprend
          l'encre pleine du kit, une seule action principale par zone. */}
      <Button size="sm" onClick={onAction}>
        {actionIcon}
        {actionLabel}
      </Button>
    </div>
  </div>
);
