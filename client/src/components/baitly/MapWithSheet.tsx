import * as React from 'react';
import { Drawer as Vaul } from 'vaul';
import { useIsMobile } from '../../hooks/use-mobile';
import { cn } from '../../utils/cn';

/**
 * Vue « carte + liste » — surface UNIQUE des trois écrans qui l'utilisent
 * (demandes de service, interventions, logements).
 *
 * <h2>Pourquoi cette primitive existe</h2>
 * <p>Les trois écrans empilaient verticalement une carte à hauteur fixe et une
 * liste. C'est une mise en page de bureau pliée : sur un écran de 812 px, les
 * blocs réclamaient ~907 px, et surtout <b>les deux surfaces demandent
 * l'attention entière</b>. En lisant la liste, 400 px de carte étaient morts
 * au-dessus ; en manipulant la carte, la liste était hors champ. Aucun réglage
 * de hauteur ne corrige cela — il fallait changer de structure.</p>
 *
 * <h2>Ce que fait ce composant</h2>
 * <ul>
 *   <li><b>Sous 640 px</b> : la carte occupe toute la zone, la liste devient une
 *       feuille que l'on tire depuis le bas, à trois crans — aperçu, moitié,
 *       plein. La carte reste manipulable à tout moment.</li>
 *   <li><b>À partir de 640 px</b> : la mise en page d'origine est conservée
 *       telle quelle, carte puis liste dessous. Rien ne change sur desktop.</li>
 * </ul>
 *
 * <h2>Deux choix d'implémentation à connaître</h2>
 * <p>La feuille compose directement `vaul` au lieu du `DrawerContent` du kit :
 * celui-ci rend TOUJOURS un `DrawerOverlay` en `fixed inset-0`, qui masquerait
 * la carte et intercepterait les gestes. Ici la feuille doit cohabiter avec
 * elle, d'où `modal={false}` (pas de blocage du fond, pas de piège de focus) et
 * `dismissible={false}` (la liste ne se ferme pas : elle se replie au cran
 * d'aperçu).</p>
 *
 * <p>L'en-tête de la feuille est un vrai `<button>` qui fait tourner les crans.
 * Le glissement est un geste de pointeur ; sans cette alternative, la liste
 * serait inatteignable au clavier.</p>
 */

/** Crans de la feuille : aperçu (le compteur + le premier élément), moitié, plein. */
const SNAP_POINTS = ['150px', 0.55, 0.92] as const;

export interface MapWithSheetProps {
  /** La carte. Elle remplit toute la zone en mobile. */
  map: React.ReactNode;
  /** Ligne de titre de la liste (ex. « 10 demandes dans la zone visible »). */
  listTitle: React.ReactNode;
  /** La liste elle-même. */
  children: React.ReactNode;
  /** Rendu quand il n'y a rien à lister — remplace la liste, pas la carte. */
  emptyState?: React.ReactNode;
  /** Hauteur de la carte sur desktop (la mise en page d'origine y est figée). */
  desktopMapHeight?: number;
  className?: string;
}

export default function MapWithSheet({
  map,
  listTitle,
  children,
  emptyState,
  desktopMapHeight = 400,
  className,
}: MapWithSheetProps) {
  const isNarrow = useIsMobile(640);
  const [snap, setSnap] = React.useState<number | string | null>(SNAP_POINTS[0]);

  const list = emptyState ?? children;

  // ── Desktop : mise en page d'origine, carte puis liste ─────────────────────
  if (!isNarrow) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}>
        <div className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">
          <div style={{ height: desktopMapHeight }}>{map}</div>
        </div>
        <div className="mt-2 flex min-h-[320px] flex-1 flex-col">
          <p className="mb-1.5 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
            {listTitle}
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pe-0.5">
            {list}
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile : carte pleine zone + feuille à crans ───────────────────────────
  const cycleSnap = () => {
    const i = SNAP_POINTS.indexOf(snap as never);
    setSnap(SNAP_POINTS[(i + 1) % SNAP_POINTS.length]);
  };

  return (
    <div className={cn('relative flex min-h-0 flex-1 overflow-hidden rounded-xl', className)}>
      {/* La carte prend toute la zone : plus de hauteur fixe qui la rogne. */}
      <div className="absolute inset-0">{map}</div>

      <Vaul.Root
        open
        modal={false}
        dismissible={false}
        snapPoints={SNAP_POINTS as unknown as (number | string)[]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <Vaul.Portal>
          <Vaul.Content
            data-slot="map-sheet"
            aria-label={typeof listTitle === 'string' ? listTitle : 'Liste'}
            // `paddingBottom: var(--snap-point-height)` — indispensable.
            // La feuille est ancree en bas PUIS translatee vers le bas de la
            // valeur du cran courant, que vaul expose dans cette variable. Son
            // bord inferieur passe donc sous l'ecran, et le bas de la liste avec
            // lui : le dernier element restait coupe (mesure : bas de carte a
            // 861 px pour un ecran de 812, soit 49 px hors champ).
            // Poser la marge ICI plutot que sur la zone qui defile est ce qui
            // rend le correctif juste : elle retranche la partie cachee de la
            // hauteur disponible, sans gonfler la hauteur de defilement — sinon
            // on aurait pu faire defiler dans le vide au cran d'apercu.
            style={{ paddingBottom: 'var(--snap-point-height, 0px)' }}
            className="fixed inset-x-0 bottom-0 z-40 flex h-full max-h-[92dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_24px_-12px_rgba(27,42,53,.25)] outline-none"
          >
            {/* Poignée + titre : un seul bouton, donc atteignable au clavier. */}
            <button
              type="button"
              onClick={cycleSnap}
              aria-label="Déplier ou replier la liste"
              className="shrink-0 cursor-pointer rounded-t-2xl px-4 pt-2 pb-2.5 text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span aria-hidden className="mx-auto mb-2 block h-1 w-9 rounded-full bg-border" />
              <span className="block text-2xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
                {listTitle}
              </span>
            </button>

            {/* `overscroll-contain` : arrivé en bout de liste, le geste ne
                repart pas dans la page derrière la feuille. */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 pb-4">
              {list}
            </div>
          </Vaul.Content>
        </Vaul.Portal>
      </Vaul.Root>
    </div>
  );
}
