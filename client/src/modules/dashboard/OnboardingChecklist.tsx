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
    + '50%{box-shadow:0 6px 28px color-mix(in srgb, var(--bui-primary) 25%, transparent), 0 0 0 1.5px color-mix(in srgb, var(--bui-primary) 20%, transparent)}}';
  document.head.appendChild(styleEl);
}

// ─── Step icon & CTA style mapping ─────────────────────────────────────────

interface StepVisual {
  icon: React.ReactNode;
  /** Teinte vive du registre — fond pastel de la pastille et halo. */
  tint: string;
  /** Encre du même registre — seule variante qui passe AA en texte/icône. */
  ink: string;
  actionIcon: React.ReactNode;
}

// Registres Baitly UI. Chaque étape porte un COUPLE : la teinte vive tapisse
// (fond pastel obtenu par color-mix), l'encre écrit — les mélanger, c'est de
// l'icône à 2,2:1. Le canal Airbnb garde sa couleur de marque (§2.5).
const STEP_VISUALS: Record<string, StepVisual> = {
  create_property: {
    icon: <Home size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-primary)',
    ink: 'var(--bui-primary)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  configure_details: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-primary)',
    ink: 'var(--bui-primary)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  define_pricing: {
    icon: <Euro size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-success)',
    ink: 'var(--bui-success-ink)',
    actionIcon: <Euro size={14} strokeWidth={1.75} />,
  },
  connect_channels: {
    icon: <CalendarMonth size={16} strokeWidth={1.75} />,
    tint: 'var(--airbnb)',
    ink: 'var(--airbnb)',
    actionIcon: <Sync size={14} strokeWidth={1.75} />,
  },
  configure_billing: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-warning)',
    ink: 'var(--bui-warning-ink)',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  configure_org: {
    icon: <Settings size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-primary)',
    ink: 'var(--bui-primary)',
    actionIcon: <Settings size={14} strokeWidth={1.75} />,
  },
  invite_members: {
    icon: <Group size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-success)',
    ink: 'var(--bui-success-ink)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
  setup_settings: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-warning)',
    ink: 'var(--bui-warning-ink)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_fiscal: {
    icon: <Receipt size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-warning)',
    ink: 'var(--bui-warning-ink)',
    actionIcon: <Receipt size={14} strokeWidth={1.75} />,
  },
  setup_notifications: {
    icon: <Notifications size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-info)',
    ink: 'var(--bui-info-ink)',
    actionIcon: <Notifications size={14} strokeWidth={1.75} />,
  },
  setup_general: {
    icon: <Tune size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-primary)',
    ink: 'var(--bui-primary)',
    actionIcon: <Tune size={14} strokeWidth={1.75} />,
  },
  setup_integrations: {
    icon: <Extension size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-info)',
    ink: 'var(--bui-info-ink)',
    actionIcon: <Extension size={14} strokeWidth={1.75} />,
  },
  setup_payment: {
    icon: <Payment size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-warning)',
    ink: 'var(--bui-warning-ink)',
    actionIcon: <Payment size={14} strokeWidth={1.75} />,
  },
  setup_messaging: {
    icon: <ChatBubbleOutline size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-info)',
    ink: 'var(--bui-info-ink)',
    actionIcon: <ChatBubbleOutline size={14} strokeWidth={1.75} />,
  },
  setup_payouts: {
    icon: <AccountBalanceWallet size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-success)',
    ink: 'var(--bui-success-ink)',
    actionIcon: <AccountBalanceWallet size={14} strokeWidth={1.75} />,
  },
  complete_profile: {
    icon: <Person size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-primary)',
    ink: 'var(--bui-primary)',
    actionIcon: <Person size={14} strokeWidth={1.75} />,
  },
  view_interventions: {
    icon: <Assignment size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-success)',
    ink: 'var(--bui-success-ink)',
    actionIcon: <Build size={14} strokeWidth={1.75} />,
  },
  create_team: {
    icon: <Group size={16} strokeWidth={1.75} />,
    tint: 'var(--bui-success)',
    ink: 'var(--bui-success-ink)',
    actionIcon: <Add size={14} strokeWidth={1.75} />,
  },
};

const DEFAULT_VISUAL: StepVisual = {
  icon: <Settings size={16} strokeWidth={1.75} />,
  tint: 'var(--bui-primary)',
  ink: 'var(--bui-primary)',
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
            className="h-auto rounded-md border border-dashed border-border px-[9px] py-[1.5px] text-2xs text-faint hover:border-primary hover:bg-transparent hover:text-primary"
          >
            <span className="me-0.5 inline-flex"><Replay size={12} strokeWidth={1.75} /></span>
            <span className="text-2xs font-semibold">
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
          'h-full rounded-lg border border-solid border-border bg-card px-3 py-[7.5px]',
          'animate-[onboarding-shadow-pulse_3s_ease-in-out_infinite] motion-reduce:animate-none',
        )}
      >
        {/* ── Header row: title + progress + bar + dismiss ────────── */}
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-2xs font-semibold uppercase tracking-wide whitespace-nowrap text-faint leading-[1]">
            {t('dashboard.onboarding.title')}
          </p>
          <span className="text-2xs font-semibold tabular-nums whitespace-nowrap text-muted-foreground opacity-60">
            {t('dashboard.onboarding.progress', { completed: completedCount, total: totalCount })}
          </span>
          <Progress
            value={progressPercent}
            className="h-[4px] min-w-[40px] flex-1 rounded-full bg-field [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-primary"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('dashboard.onboarding.dismiss', 'Masquer')}
            onClick={handleDismiss}
            className="text-faint hover:bg-transparent hover:text-muted-foreground"
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
                  'flex min-w-[calc(50%_-_4px)] flex-auto items-center gap-1.5 min-[600px]:min-w-[auto]',
                  'rounded-md border border-solid px-[7.5px] py-[4.5px]',
                  'transition-all duration-150 ease-out-quart motion-reduce:transition-none',
                  step.completed
                    ? 'border-success/25 bg-success/5'
                    : isActive
                      ? 'border-primary bg-primary-soft'
                      : 'border-border bg-transparent',
                  step.locked
                    ? 'cursor-default opacity-45'
                    : 'cursor-pointer hover:-translate-y-px hover:border-primary hover:shadow-sm motion-reduce:hover:translate-y-0',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-sm',
                    step.completed
                      ? 'bg-success-soft text-success-ink'
                      : isActive
                        ? 'bg-primary-soft text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {visual.icon}
                </div>

                {/* Label */}
                <p className={cn('min-w-0 flex-1 truncate text-xs leading-[1.3]', isActive ? 'font-bold' : 'font-semibold', step.completed ? 'text-faint line-through' : isActive ? 'text-foreground' : 'text-muted-foreground')}>
                  {t(step.labelKey)}
                </p>

                {/* Status */}
                {step.completed ? (
                  <span className="inline-flex shrink-0 text-success-ink"><CheckCircle size={14} strokeWidth={1.75} /></span>
                ) : step.locked ? (
                  <span className="inline-flex shrink-0 text-muted-foreground opacity-60"><Lock size={12} strokeWidth={1.75} /></span>
                ) : (
                  <span className="inline-flex shrink-0 text-muted-foreground opacity-60"><RadioButtonUnchecked size={14} strokeWidth={1.75} /></span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── CTA: always show for the current active step ─────────── */}
        {activeStep && activeVisual && (
          <CtaSection
            icon={React.cloneElement(activeVisual.icon as React.ReactElement, { size: 18 })}
            tint={activeVisual.tint}
            title={t(activeStep.labelKey)}
            description={t(activeStep.descriptionKey)}
            actionLabel={t(activeStep.labelKey)}
            actionIcon={activeVisual.actionIcon}
            onAction={handleCtaAction}
            ink={activeVisual.ink}
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
  /** Teinte vive du registre de l'étape — tapisse la pastille (fond pastel). */
  tint: string;
  title: string;
  description: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: () => void;
  /** Encre du même registre — c'est elle qui dessine l'icône. */
  ink?: string;
  skippable?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}

const CtaSection: React.FC<CtaSectionProps> = ({
  icon,
  tint,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  ink = 'var(--bui-primary)',
  skippable,
  onSkip,
  skipLabel,
}) => (
  <div className="mt-[9px] flex items-center gap-3 border-t border-solid border-t-border pt-[9px]">
    {/* Pastille du registre de l'étape : fond pastel + encre. L'aplat plein
        renvoyait une icône blanche à 2,3:1 sur les teintes claires (succès,
        avertissement) — le couple soft/ink passe AA partout. */}
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)`, color: ink }}
    >
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold leading-[1.3] text-foreground">
        {title}
      </p>
      <p className="mt-0.5 text-xs leading-[1.5] text-muted-foreground">
        {description}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {skippable && onSkip && (
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {skipLabel || 'Skip'}
        </Button>
      )}
      {/* Le CTA portait un aplat par etape : c'est deja la pastille d'icone a
          gauche qui porte ce signal. Le bouton reprend l'encre pleine du kit,
          une seule action principale par zone. */}
      <Button size="sm" onClick={onAction}>
        {actionIcon}
        {actionLabel}
      </Button>
    </div>
  </div>
);
