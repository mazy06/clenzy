import React from 'react';
import { Card } from '../ui';
import { cn } from '../../utils/cn';
import { useViewportFill } from '../../hooks/useViewportFill';

/**
 * Hauteur sous laquelle une tuile cesse d'etre lisible.
 *
 * <p>Le bandeau d'une tuile — titre, precision, rembourrages — pese une
 * cinquantaine de pixels ; sous 220 il ne reste pas de quoi tracer une courbe,
 * et l'anneau comme la liste de reperes se font rogner.</p>
 */
const MIN_TILE_HEIGHT = 220;

/**
 * Corps d'une tuile qui porte un GRAPHIQUE.
 *
 * <p>Sous 1024 px les tuiles s'empilent et la rangee vaut `auto` : la tuile
 * prend la hauteur de son contenu, et le contenu d'un graphique est `flex-1`,
 * qui se resout a ZERO. Tous les graphiques disparaissaient sur telephone et
 * tablette — seules les tuiles de texte survivaient, parce qu'un paragraphe a
 * une hauteur minimale intrinseque, pas un `ResponsiveContainer`. Il faut donc
 * une hauteur DEFINIE, pas un minimum : `h-full` ne se resout pas contre un
 * parent en `auto`.</p>
 *
 * <p>Au-dessus de 1024 px la rangee porte deja sa hauteur (mesuree, ou le
 * plancher du mode defilant) : on rend la main a `flex-1` pour que les tuiles
 * se partagent l'espace.</p>
 */
const CHART_BODY_CLASS =
  '@container h-[280px] min-[768px]:h-[340px] min-[1024px]:h-auto min-[1024px]:min-h-0 min-[1024px]:flex-1';

/**
 * Corps d'une tuile qui porte du TEXTE — reperes, alertes, tableau.
 *
 * <p>Une liste se dimensionne toute seule. Lui imposer une hauteur sur mobile
 * la ferait defiler DANS la carte, alors que la page defile deja : deux
 * ascenseurs imbriques pour trois lignes d'alerte.</p>
 */
const FLUID_BODY_CLASS = '@container min-h-0 flex-1';

/** Les MEMES seuils que la grille : la mise en page et le compte doivent s'accorder. */
const COLUMN_QUERIES = ['(min-width: 1500px)', '(min-width: 1024px)'] as const;

function useGridColumns(): number {
  const read = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 1;
    if (window.matchMedia(COLUMN_QUERIES[0]).matches) return 3;
    if (window.matchMedia(COLUMN_QUERIES[1]).matches) return 2;
    return 1;
  };
  const [columns, setColumns] = React.useState(read);

  React.useEffect(() => {
    const lists = COLUMN_QUERIES.map((query) => window.matchMedia(query));
    const update = () => setColumns(read());
    lists.forEach((list) => list.addEventListener('change', update));
    update();
    return () => lists.forEach((list) => list.removeEventListener('change', update));
  }, []);

  return columns;
}

/**
 * Cadre d'un graphique.
 *
 * <p>Le titre est fixe (`shrink-0`) et le graphique prend le reste : c'est le
 * graphique qui doit maigrir quand la place manque, jamais son intitulé.</p>
 */
export const ChartTile: React.FC<{
  title: string;
  hint?: string;
  /** Rangée d'actions ou de filtres, à droite du titre. */
  action?: React.ReactNode;
  /** Le contenu se dimensionne seul (liste, tableau) plutot qu'un graphique. */
  fluid?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ title, hint, action, fluid, children, className }) => (
  <Card className={cn('flex min-h-0 flex-col gap-2 overflow-hidden border-border p-3.5', className)}>
    <div className="flex shrink-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        <h3 className="m-0 truncate text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {hint ? <p className="m-0 mt-0.5 truncate text-2xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    <div className={fluid ? FLUID_BODY_CLASS : CHART_BODY_CLASS}>{children}</div>
  </Card>
);

export interface Tile {
  key: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /** Largeur en colonnes de la grille, à partir de 1024 px. */
  span?: 1 | 2 | 3;
  /** Le contenu se dimensionne seul (liste, tableau) plutot qu'un graphique. */
  fluid?: boolean;
  render: () => React.ReactNode;
}

/** `false` filtré : une tuile sans donnée ne se déclare pas. */
export type TileOrNothing = Tile | false | null | undefined;

export const tiles = (list: TileOrNothing[]): Tile[] => list.filter(Boolean) as Tile[];

const SPAN_CLASS: Record<number, string> = {
  1: '',
  2: 'min-[1024px]:col-span-2',
  3: 'min-[1024px]:col-span-2 min-[1500px]:col-span-3',
};

/**
 * Grille de tuiles.
 *
 * <p>Tous les graphiques sont visibles À LA FOIS, dans la hauteur disponible.
 * La grille reçoit la hauteur mesurée et ses rangées valent `minmax(0, 1fr)` :
 * les tuiles se partagent l'espace au lieu de le réclamer.</p>
 *
 * <p>Sous la largeur où les tuiles s'empilent, la hauteur mesurée n'est pas
 * appliquée : entasser six graphiques dans un écran étroit les rendrait
 * illisibles, mieux vaut alors laisser la page défiler. Même chose quand
 * `fill` est refusé — un écran qui porte un tableau ou plus de six tuiles ne
 * tient pas dans une hauteur de fenêtre sans devenir un timbre-poste.</p>
 */
export const TileGrid: React.FC<{
  items: Tile[];
  /** Faux : les rangées reprennent une hauteur confortable et la page défile. */
  fill?: boolean;
  className?: string;
}> = ({ items, fill = true, className }) => {
  const [fillRef, fillHeight] = useViewportFill<HTMLDivElement>();
  const columns = useGridColumns();

  // Une fenetre BASSE ne se traite pas comme une fenetre etroite : la largeur
  // decide du nombre de colonnes, la hauteur decide si l'on tient dans l'ecran.
  // Six tuiles sur trois rangees dans 560 px donnent des bandes de 110 px ou la
  // courbe est un trait et l'anneau un disque coupe — mieux vaut alors defiler.
  const rows = Math.max(1, Math.ceil(items.length / columns));
  const fits = fillHeight !== undefined && fillHeight / rows >= MIN_TILE_HEIGHT;
  const stretched = fill && fits;

  return (
    <div
      ref={fillRef}
      style={stretched ? { height: fillHeight } : undefined}
      className={cn(
        'grid min-h-0 grid-cols-1 gap-3',
        // 1024 px, le MEME seuil que `useViewportFill` : entre 900 et 1024, une
        // grille a deux colonnes sans hauteur mesuree defile pour rien.
        'min-[1024px]:grid-cols-2 min-[1500px]:grid-cols-3',
        // Plancher a zero : sans `minmax(0, …)` une rangee `auto` se dimensionne
        // sur son contenu et deborde la hauteur imposee.
        stretched
          ? 'min-[1024px]:auto-rows-[minmax(0,1fr)]'
          : 'min-[1024px]:auto-rows-[minmax(280px,auto)]',
        className,
      )}
    >
      {items.map((tile) => (
        <ChartTile
          key={tile.key}
          title={tile.title}
          hint={tile.hint}
          action={tile.action}
          fluid={tile.fluid}
          className={tile.span ? SPAN_CLASS[tile.span] : undefined}
        >
          {tile.render()}
        </ChartTile>
      ))}
    </div>
  );
};

/**
 * Coque d'un écran de statistiques : le bandeau, puis la grille.
 *
 * <p>`min-h-0` sur le conteneur ET sur la grille : sans lui, le plancher
 * `min-height: auto` d'un élément flex empêche la grille de se comprimer, et
 * la hauteur mesurée serait aussitôt dépassée.</p>
 */
export const StatsLayout: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('flex min-h-0 flex-col gap-3', className)}>{children}</div>;
