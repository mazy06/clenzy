import * as React from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Maximize2Icon,
  Minimize2Icon,
  PartyPopperIcon,
} from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils/cn';
import {
  OnboardingStepList,
  countDoneSteps,
  formatStepProgress,
  type OnboardingGroup,
} from './OnboardingSteps';

/**
 * Baitly — dock de démarrage flottant et persistant.
 *
 * Variante compacte d'`OnboardingChecklist` : au lieu de vivre uniquement sur
 * une page d'accueil que l'utilisateur quitte au premier clic, le guide **le
 * suit d'écran en écran**, replié, et se déplie à la demande.
 *
 * Différence structurante avec le guide plein écran : ici on ne peut pas
 * afficher la liste des groupes à côté des étapes, donc la navigation entre
 * groupes passe par un **pager en pied de carte** (‹ / ›), le titre de la carte
 * indiquant le groupe courant. La progression **globale** reste visible dans les
 * deux états — repliée comme dépliée : c'est elle qui justifie que le dock
 * occupe l'écran.
 *
 * Trois états : replié, déplié, terminé (`completion`). Le dock est toujours
 * **rejetable** (`onDismiss`) — un guide qu'on ne peut pas faire taire devient
 * une nuisance.
 *
 * Usage :
 *   <OnboardingDock
 *     groups={groups}
 *     onDismiss={() => setPref('onboarding.dockDismissed', true)}
 *   />
 */
export interface OnboardingDockProps {
  groups: OnboardingGroup[];
  /** Sur-titre de la carte. Défaut : « Guide de démarrage ». */
  title?: React.ReactNode;
  /** Déploiement contrôlé. Sinon état interne. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** Groupe courant, contrôlé. Sinon état interne. */
  groupKey?: string;
  onGroupChange?: (key: string) => void;
  defaultGroupKey?: string;
  /** Sans `onDismiss`, aucun lien de rejet n'est affiché. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /**
   * Contenu affiché à la place des étapes quand tout est terminé. Un guide
   * doit avoir une fin visible, sinon l'utilisateur ne sait jamais qu'il a fini.
   */
  completion?: React.ReactNode;
  /** `false` pour intégrer la carte dans le flux (démos, aperçus). */
  floating?: boolean;
  formatProgress?: (done: number, total: number) => string;
  className?: string;
}

export default function OnboardingDock({
  groups,
  title = 'Guide de démarrage',
  open,
  onOpenChange,
  defaultOpen = false,
  groupKey,
  onGroupChange,
  defaultGroupKey,
  onDismiss,
  dismissLabel = 'Masquer',
  completion,
  floating = true,
  formatProgress = formatStepProgress,
  className,
}: OnboardingDockProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [internalGroupKey, setInternalGroupKey] = React.useState(
    defaultGroupKey ?? groups[0]?.key
  );
  const activeGroupKey = groupKey ?? internalGroupKey;
  const activeIndex = Math.max(
    0,
    groups.findIndex((g) => g.key === activeGroupKey)
  );
  const activeGroup = groups[activeIndex] ?? groups[0];

  const selectGroupAt = (index: number) => {
    const next = groups[index];
    if (!next) return;
    if (groupKey === undefined) setInternalGroupKey(next.key);
    onGroupChange?.(next.key);
  };

  const [openStepKey, setOpenStepKey] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    setOpenStepKey(undefined);
  }, [activeGroupKey]);

  const totalSteps = groups.reduce((sum, g) => sum + g.steps.length, 0);
  const totalDone = groups.reduce((sum, g) => sum + countDoneSteps(g.steps), 0);
  const allDone = totalSteps > 0 && totalDone === totalSteps;

  return (
    <section
      aria-label={typeof title === 'string' ? title : 'Guide de démarrage'}
      className={cn(
        'flex w-full max-w-md flex-col gap-3 rounded-2xl border border-border bg-card p-4',
        floating && 'fixed bottom-4 start-4 z-40',
        className
      )}
      // Ombre teintée vers la couleur de marque plutôt qu'un noir générique.
      style={{
        boxShadow: '0 16px 40px -12px color-mix(in oklab, var(--bui-primary) 30%, transparent)',
      }}
    >
      <header className="flex items-start gap-3">
        {activeGroup?.media && (
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/15 [&>svg]:size-5">
            {activeGroup.media}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
          <div className="cn-font-heading truncate text-base font-semibold text-foreground">
            {allDone ? 'Configuration terminée' : activeGroup?.title}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Replier le guide' : 'Déplier le guide'}
          title={isOpen ? 'Replier le guide' : 'Déplier le guide'}
          onClick={() => setOpen(!isOpen)}
        >
          {isOpen ? <Minimize2Icon /> : <Maximize2Icon />}
        </Button>
      </header>

      {isOpen && (
        <>
          {allDone ? (
            <div className="flex items-start gap-3 rounded-xl bg-primary-soft p-4">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground [&>svg]:size-4">
                <PartyPopperIcon />
              </span>
              <div className="min-w-0 text-sm text-foreground">
                {completion ?? 'Toutes les étapes sont terminées. Bonne exploitation.'}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-muted/60 px-3">
                <OnboardingStepList
                  steps={activeGroup?.steps ?? []}
                  openKey={openStepKey}
                  onOpenChange={setOpenStepKey}
                />
              </div>

              {groups.length > 1 && (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Groupe précédent"
                    disabled={activeIndex === 0}
                    onClick={() => selectGroupAt(activeIndex - 1)}
                  >
                    <ChevronLeftIcon className="rtl:rotate-180" />
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatProgress(
                      countDoneSteps(activeGroup?.steps ?? []),
                      activeGroup?.steps.length ?? 0
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Groupe suivant"
                    disabled={activeIndex === groups.length - 1}
                    onClick={() => selectGroupAt(activeIndex + 1)}
                  >
                    <ChevronRightIcon className="rtl:rotate-180" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="flex items-center gap-3">
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

      {onDismiss && (
        <div>
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'cursor-pointer rounded-md text-sm font-medium text-primary',
              'outline-none transition-colors duration-150 hover:text-foreground',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50'
            )}
          >
            {dismissLabel}
          </button>
        </div>
      )}
    </section>
  );
}
