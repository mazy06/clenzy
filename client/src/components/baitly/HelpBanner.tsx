import * as React from 'react';
import { XIcon } from 'lucide-react';
import { Button } from '../ui';
import { useUserPreference } from '../../hooks/useUserPreference';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/HelpBanner.tsx (MUI).
 * Bandeau pédagogique dismissable — même mécanique de persistance backend
 * (useUserPreference, clé `help.<storageKey normalisé>`, cross-devices).
 */
export type HelpStepAccent = 'primary' | 'success' | 'warning' | 'info' | 'default';

export interface HelpStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: HelpStepAccent;
}

export interface HelpBannerProps {
  storageKey: string;
  title: string;
  description: string;
  steps: HelpStep[];
  dismissLabel?: string;
}

const ACCENT_CLASSES: Record<HelpStepAccent, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  default: 'text-muted-foreground',
};

/** Cycle 3 tons quand l'accent n'est pas fourni — les étapes restent distinctes. */
const ACCENT_CYCLE: HelpStepAccent[] = ['primary', 'info', 'success'];

export default function HelpBanner({
  storageKey,
  title,
  description,
  steps,
  dismissLabel = 'Masquer cette aide',
}: HelpBannerProps) {
  const normalized = storageKey
    .replace(/^clenzy_/, '')
    .replace(/_dismissed$/, '')
    .replace(/_help$/, '');
  const [dismissed, setDismissed, { isLoaded }] = useUserPreference<boolean>(
    `help.${normalized}`,
    false
  );

  if (!isLoaded || dismissed) return null;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-sm font-semibold text-foreground">{title}</h2>
          <p className="m-0 mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={dismissLabel}
          title={dismissLabel}
          onClick={() => setDismissed(true)}
        >
          <XIcon />
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => {
          const accent = step.accent ?? ACCENT_CYCLE[index % ACCENT_CYCLE.length];
          return (
            <div key={index} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted [&>svg]:size-3.5',
                  ACCENT_CLASSES[accent]
                )}
              >
                {step.icon}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
