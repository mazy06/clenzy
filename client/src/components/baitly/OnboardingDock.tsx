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
import { STORAGE_KEYS } from '../../services/storageService';
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

/** Marge minimale conservee entre la carte et les bords de l'ecran. */
const EDGE_MARGIN = 8;

interface DockPosition { x: number; y: number }

/**
 * Coin d'ancrage. On memorise le COIN et non des coordonnees : un point fixe en
 * pixels, mesure sur un grand ecran, atterrit n'importe ou sur une fenetre
 * etroite — le coin, lui, garde son sens quelle que soit la taille.
 */
type DockCorner = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

const CORNERS: DockCorner[] = ['top-start', 'top-end', 'bottom-start', 'bottom-end'];
const DEFAULT_CORNER: DockCorner = 'bottom-start';

function readStoredCorner(): DockCorner | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.ONBOARDING_DOCK_POSITION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return CORNERS.includes(parsed?.corner) ? (parsed.corner as DockCorner) : null;
  } catch {
    return null;
  }
}

/** Position en pixels d'un coin, pour une carte de taille donnee. */
function positionForCorner(corner: DockCorner, width: number, height: number): DockPosition {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);
  return {
    x: corner.endsWith('start') ? EDGE_MARGIN : maxX,
    y: corner.startsWith('top') ? EDGE_MARGIN : maxY,
  };
}

/** Coin le plus proche du CENTRE de la carte — pas de son coin haut-gauche. */
function nearestCorner(position: DockPosition, width: number, height: number): DockCorner {
  const centerX = position.x + width / 2;
  const centerY = position.y + height / 2;
  const vertical = centerY < window.innerHeight / 2 ? 'top' : 'bottom';
  const horizontal = centerX < window.innerWidth / 2 ? 'start' : 'end';
  return `${vertical}-${horizontal}` as DockCorner;
}

/**
 * Deplacement du guide a la souris comme au doigt, avec ANCRAGE PAR COIN.
 *
 * Pointer events et non mouse : le meme code sert au tactile, et
 * `setPointerCapture` garde le suivi meme si le doigt sort de la poignee.
 *
 * Pendant le geste la carte suit librement le pointeur ; au relachement elle se
 * cale au coin le plus proche. C'est ce qui l'empeche de finir au milieu du
 * contenu, ou elle recouvrait l'ecran — tout en laissant quatre placements au
 * choix. Le coin est recalcule a chaque redimensionnement, donc la carte reste
 * accrochee quand la fenetre change de taille.
 */
function useDockDrag(enabled: boolean) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [corner, setCorner] = React.useState<DockCorner>(() =>
    (enabled ? readStoredCorner() ?? DEFAULT_CORNER : DEFAULT_CORNER));
  /** Position libre PENDANT le geste ; hors geste, elle derive du coin. */
  const [dragPosition, setDragPosition] = React.useState<DockPosition | null>(null);
  const [anchored, setAnchored] = React.useState<DockPosition | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const offset = React.useRef<DockPosition>({ x: 0, y: 0 });

  const applyCorner = React.useCallback((next: DockCorner) => {
    const el = ref.current;
    if (!el) return;
    setAnchored(positionForCorner(next, el.offsetWidth, el.offsetHeight));
  }, []);

  // Ancrage initial et re-ancrage : au montage, quand la fenetre change de
  // taille, et quand la carte se deplie ou se replie (sa hauteur change).
  React.useLayoutEffect(() => {
    if (!enabled) return;
    applyCorner(corner);
  }, [enabled, corner, applyCorner]);

  React.useEffect(() => {
    if (!enabled) return;
    const onResize = () => applyCorner(corner);
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => applyCorner(corner))
      : null;
    if (observer && ref.current) observer.observe(ref.current);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [enabled, corner, applyCorner]);

  const clamp = React.useCallback((next: DockPosition): DockPosition => {
    const el = ref.current;
    const width = el?.offsetWidth ?? 0;
    const height = el?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(next.x, EDGE_MARGIN), Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN)),
      y: Math.min(Math.max(next.y, EDGE_MARGIN), Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN)),
    };
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    // Les commandes de la carte (replier, masquer, Continuer…) gardent leur clic.
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    offset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setDragPosition(clamp({ x: rect.left, y: rect.top }));
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    event.preventDefault();
    setDragPosition(clamp({ x: event.clientX - offset.current.x, y: event.clientY - offset.current.y }));
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragging) return;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const el = ref.current;
    if (el && dragPosition) {
      const next = nearestCorner(dragPosition, el.offsetWidth, el.offsetHeight);
      setCorner(next);
      applyCorner(next);
      try {
        window.localStorage.setItem(STORAGE_KEYS.ONBOARDING_DOCK_POSITION, JSON.stringify({ corner: next }));
      } catch { /* quota plein ou mode prive : le coin n'est pas critique */ }
    }
    setDragPosition(null);
  };

  return {
    ref,
    // Pendant le geste la carte suit le pointeur ; sinon elle occupe son coin.
    position: dragging ? dragPosition : anchored,
    dragging,
    handleProps: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  };
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
  const drag = useDockDrag(floating);

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

  /** Prochaine etape actionnable — l'essentiel de ce qu'on lit quand la carte est repliee. */
  const nextStep = groups
    .flatMap((group) => group.steps)
    .find((step) => (step.state ?? 'todo') === 'todo');

  return (
    <section
      ref={drag.ref as React.RefObject<HTMLElement>}
      aria-label={typeof title === 'string' ? title : 'Guide de démarrage'}
      className={cn(
        'flex w-full max-w-[min(21rem,calc(100vw-2rem))] flex-col gap-2 rounded-xl border border-border bg-card p-3',
        floating && 'fixed z-40',
        // Repli tant que le coin n'est pas encore mesure (premier rendu).
        floating && !drag.position && 'bottom-4 start-4',
        drag.dragging && 'select-none',
        // Glissement vers le coin au relachement — pas pendant le geste, ou la
        // carte doit coller au pointeur sans retard.
        floating && !drag.dragging && '[transition:left_180ms_cubic-bezier(0.22,1,0.36,1),top_180ms_cubic-bezier(0.22,1,0.36,1)]',
        'motion-reduce:transition-none',
        className
      )}
      style={{
        // Ombre teintée vers la couleur de marque plutôt qu'un noir générique.
        boxShadow: '0 16px 40px -12px color-mix(in oklab, var(--bui-primary) 30%, transparent)',
        // Coordonnees PHYSIQUES : un ecran n'a pas de sens de lecture, le coin
        // haut-droit reste le haut-droit en arabe. `left`/`top` priment sur les
        // classes d'ancrage par defaut.
        ...(floating && drag.position
          ? { left: drag.position.x, top: drag.position.y, right: 'auto', bottom: 'auto' }
          : null),
      }}
    >
      {/* L'en-tete est la POIGNEE : c'est la zone sans commande, celle qu'on
          attrape naturellement. `touch-none` empeche le navigateur de prendre le
          geste pour un defilement de page. */}
      <header
        {...(floating ? drag.handleProps : {})}
        className={cn(
          'flex items-center gap-2',
          floating && 'touch-none',
          floating && (drag.dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        {/* Plus de pastille d'icone : elle ne portait aucune information que le
            titre ne donne deja, et coutait 44px de largeur sur une carte qu'on
            veut discrete. Le titre tient sur une ligne. */}
        <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {allDone ? 'Configuration terminée' : title}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
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

      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={totalDone}
          aria-label={formatProgress(totalDone, totalSteps)}
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
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

      {/* Repliee, la carte doit quand meme dire OU on en est : une ligne, la
          prochaine etape, cliquable pour deplier. Sans elle, le guide replie ne
          disait plus rien d'autre qu'un pourcentage. */}
      {!isOpen && nextStep && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'cursor-pointer truncate rounded-md text-start text-xs text-muted-foreground',
            'outline-none transition-colors duration-150 hover:text-foreground',
            'focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        >
          Étape suivante : <span className="font-medium text-primary">{nextStep.title}</span>
        </button>
      )}

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
