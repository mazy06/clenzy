import * as React from 'react';
import { cn } from '../../utils/cn';
import {
  OnboardingStepList,
  countDoneSteps,
  formatStepProgress,
  type OnboardingGroup,
  type OnboardingStep,
  type OnboardingStepState,
} from './OnboardingSteps';

export type { OnboardingGroup, OnboardingStep, OnboardingStepState };

/**
 * Baitly — guide de démarrage en maître-détail (surface plein écran).
 *
 * Colonne gauche : les groupes d'étapes, chacun avec sa propre progression.
 * Colonne droite : les étapes du groupe sélectionné, en accordéon (une seule
 * ouverte à la fois — la première non faite l'est par défaut).
 *
 * Trois partis pris repris d'un audit d'onboarding SaaS :
 *  - **deux granularités de progression** affichées ensemble (par groupe dans la
 *    liste, globale en pied de colonne) — l'utilisateur sait où il en est ET
 *    combien il reste ;
 *  - une étape peut être **verrouillée** (`locked`) par l'offre : cadenas +
 *    badge, plutôt qu'un item grisé qu'on croit cassé ;
 *  - chaque étape porte une **estimation de durée** et un **« Passer »**, pour
 *    que rien ne bloque la progression.
 *
 * La variante flottante et persistante est `OnboardingDock` — les deux
 * partagent le même socle (`OnboardingSteps.tsx`).
 */
export interface OnboardingChecklistProps {
  groups: OnboardingGroup[];
  title?: React.ReactNode;
  /** Actions de l'en-tête (tutoriel, prise de rendez-vous, centre d'aide…). */
  actions?: React.ReactNode;
  /** Sélection contrôlée du groupe. Sinon état interne. */
  groupKey?: string;
  onGroupChange?: (key: string) => void;
  defaultGroupKey?: string;
  /** Gabarit du compteur. Défaut : « 2/10 terminées ». */
  formatProgress?: (done: number, total: number) => string;
  className?: string;
}

export default function OnboardingChecklist({
  groups,
  title = 'Guide de démarrage',
  actions,
  groupKey,
  onGroupChange,
  defaultGroupKey,
  formatProgress = formatStepProgress,
  className,
}: OnboardingChecklistProps) {
  const [internalGroupKey, setInternalGroupKey] = React.useState(
    defaultGroupKey ?? groups[0]?.key
  );
  const activeGroupKey = groupKey ?? internalGroupKey;
  const activeGroup = groups.find((g) => g.key === activeGroupKey) ?? groups[0];

  const selectGroup = (key: string) => {
    if (groupKey === undefined) setInternalGroupKey(key);
    onGroupChange?.(key);
  };

  const [openStepKey, setOpenStepKey] = React.useState<string | undefined>(undefined);

  // Changer de groupe rouvre l'étape par défaut du nouveau groupe.
  React.useEffect(() => {
    setOpenStepKey(undefined);
  }, [activeGroupKey]);

  const totalSteps = groups.reduce((sum, g) => sum + g.steps.length, 0);
  const totalDone = groups.reduce((sum, g) => sum + countDoneSteps(g.steps), 0);

  return (
    <section className={cn('rounded-xl border border-border bg-card', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 pb-0">
        <h2 className="cn-font-heading m-0 text-base font-semibold text-foreground">{title}</h2>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>

      <div className="grid gap-0 p-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        {/* Colonne des groupes + progression globale ancrée en pied */}
        <div className="flex flex-col md:border-e md:border-border md:pe-4">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {groups.map((group) => {
              const done = countDoneSteps(group.steps);
              const selected = group.key === activeGroup?.key;
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => selectGroup(group.key)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-start',
                      'outline-none transition-colors duration-150 hover:bg-accent',
                      'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selected && 'bg-accent'
                    )}
                  >
                    {group.media && (
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary [&>svg]:size-5">
                        {group.media}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {group.title}
                      </span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {formatProgress(done, group.steps.length)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto flex items-center gap-3 pt-6">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-valuenow={totalDone}
              aria-label={formatProgress(totalDone, totalSteps)}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: totalSteps ? `${(totalDone / totalSteps) * 100}%` : '0%' }}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatProgress(totalDone, totalSteps)}
            </span>
          </div>
        </div>

        {/* Étapes du groupe sélectionné */}
        <OnboardingStepList
          steps={activeGroup?.steps ?? []}
          openKey={openStepKey}
          onOpenChange={setOpenStepKey}
          className="mt-4 md:mt-0 md:ps-4"
        />
      </div>
    </section>
  );
}
