import * as React from 'react';
import { CheckIcon, ChevronDownIcon, LockIcon } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Baitly — socle partagé du parcours de démarrage.
 *
 * Types + liste d'étapes en accordéon, utilisés par les deux surfaces :
 *  - `OnboardingChecklist` — le guide plein écran (maître-détail) ;
 *  - `OnboardingDock` — le dock flottant qui suit l'utilisateur d'écran en écran.
 *
 * Les deux DOIVENT rester d'accord sur les états, les glyphes et le
 * comportement d'ouverture — d'où la factorisation ici.
 */
export type OnboardingStepState = 'done' | 'todo' | 'locked';

export interface OnboardingStep {
  key: string;
  title: string;
  description?: React.ReactNode;
  /** Défaut : 'todo'. */
  state?: OnboardingStepState;
  /** Estimation affichée à côté de l'action (ex. « ≈ 1 min »). */
  duration?: string;
  /** Marqueur à droite du titre (ex. <Badge>Offre Pro</Badge>). */
  badge?: React.ReactNode;
  action?: { label: string; onClick?: () => void };
  onSkip?: () => void;
  skipLabel?: string;
}

export interface OnboardingGroup {
  key: string;
  title: string;
  /** Visuel du groupe (illustration ou icône). */
  media?: React.ReactNode;
  steps: OnboardingStep[];
}

export const countDoneSteps = (steps: OnboardingStep[]) =>
  steps.filter((step) => step.state === 'done').length;

export const formatStepProgress = (done: number, total: number) => `${done}/${total} terminées`;

/** Glyphe d'état — trois valeurs distinctes, jamais un simple gris « désactivé ». */
export function OnboardingStepGlyph({ state }: { state: OnboardingStepState }) {
  if (state === 'done') {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&>svg]:size-3.5">
        <CheckIcon strokeWidth={3} />
      </span>
    );
  }
  if (state === 'locked') {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
        <LockIcon />
      </span>
    );
  }
  return <span className="inline-flex size-6 shrink-0 rounded-full border-2 border-border" />;
}

export interface OnboardingStepListProps {
  steps: OnboardingStep[];
  /** Clé de l'étape dépliée. `undefined` = première étape non terminée. */
  openKey?: string;
  onOpenChange: (key: string) => void;
  /** Sépare les étapes par un filet (guide plein écran) ou non (dock teinté). */
  separators?: boolean;
  className?: string;
}

/** Première étape actionnable — celle qu'on déplie d'office. */
export const firstOpenableStep = (steps: OnboardingStep[]) =>
  steps.find((step) => (step.state ?? 'todo') !== 'done')?.key;

export function OnboardingStepList({
  steps,
  openKey,
  onOpenChange,
  separators = true,
  className,
}: OnboardingStepListProps) {
  const expandedKey = openKey ?? firstOpenableStep(steps);

  return (
    <ul className={cn('m-0 flex list-none flex-col p-0', className)}>
      {steps.map((step) => {
        const state = step.state ?? 'todo';
        const expanded = step.key === expandedKey;
        return (
          <li
            key={step.key}
            className={cn(separators && 'border-b border-border last:border-b-0')}
          >
            <div className="flex items-center gap-3 py-3">
              <OnboardingStepGlyph state={state} />
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => onOpenChange(expanded ? '' : step.key)}
                className={cn(
                  'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-start',
                  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                )}
              >
                <span
                  className={cn(
                    'min-w-0 flex-1 text-sm font-medium text-foreground',
                    state === 'done' && 'text-muted-foreground line-through'
                  )}
                >
                  {step.title}
                </span>
                {step.badge}
                <ChevronDownIcon
                  className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform duration-150',
                    expanded && 'rotate-180'
                  )}
                />
              </button>
            </div>

            {expanded && (step.description || step.action) && (
              <div className="pb-4 ps-9">
                {step.description && (
                  <p className="m-0 text-sm text-muted-foreground">{step.description}</p>
                )}
                {step.action && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={step.action.onClick} disabled={state === 'locked'}>
                      {step.action.label}
                    </Button>
                    {step.onSkip && (
                      <Button size="sm" variant="ghost" onClick={step.onSkip}>
                        {step.skipLabel ?? 'Passer'}
                      </Button>
                    )}
                    {step.duration && (
                      <span className="text-xs text-muted-foreground">{step.duration}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
