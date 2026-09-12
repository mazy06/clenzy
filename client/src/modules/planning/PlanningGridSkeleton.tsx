import React from 'react';
import { Card, Skeleton } from '../../components/ui';
import { cn } from '../../utils/cn';
import PlanningDateHeaders from './PlanningDateHeaders';
import PlanningRowBackdrop from './PlanningRowBackdrop';
import { BAR_BORDER_RADIUS, PAGINATION_BAR_HEIGHT, ROW_CONFIG } from './constants';
import { scrollLeftForDateIn } from './hooks/useInfiniteTimeline';
import type { DensityMode, ZoomLevel } from './types';

/**
 * La grille du planning, en attente de ses données.
 *
 * <p>Un sursis tournant occupait cette place. Il ne pouvait pas être au même
 * endroit que celui qui le précédait : quand il paraît, le titre de l'écran et
 * la toolbar sont déjà peints, donc il se centre sur ce qui reste. Trois
 * attentes, trois positions : c'est le déplacement qu'on voyait.</p>
 *
 * <p>Ici, <b>la même grille</b> — pas une évocation. La rangée des dates est le
 * composant RÉEL ({@link ./PlanningDateHeaders}), le fond des lignes est le
 * composant RÉEL ({@link ./PlanningRowBackdrop}, partagé avec
 * {@link ./PlanningRow}), et le reste reprend la structure de
 * {@link ./PlanningTimeline} classe par classe : carte, défileur, colonne
 * logements collante sur son filet, lignes à la hauteur de la densité. Seuls
 * changent les CONTENUS — un bloc battant là où viendront le nom du logement,
 * sa ville et ses briques.</p>
 *
 * <p>La barre de pagination est du lot. Elle a une hauteur FIXE que le calcul
 * du nombre de lignes par page réserve déjà ({@code PAGINATION_BAR_HEIGHT}) :
 * l'omettre laissait la carte occuper toute la hauteur, puis la faisait
 * raccourcir de 44 px à l'arrivée des données — toute la grille remontait d'un
 * cran au moment précis où l'on commençait à la lire.</p>
 *
 * <p>Conséquence recherchée : quand les données arrivent, la grille ne se
 * redessine pas, elle se remplit.</p>
 */

/**
 * Briques d'une rangée, en JOURS (début, durée) — comme de vrais séjours.
 *
 * <p>Table fixe et non tirage aléatoire : un motif au sort se redessinerait à
 * chaque rendu, et l'attente se mettrait à clignoter.</p>
 */
const BAR_PATTERN: readonly (readonly [startDay: number, nights: number])[] = [
  [0, 3], [4, 2], [8, 4], [14, 3],
  [1, 5], [7, 2], [11, 6],
  [2, 2], [5, 3], [10, 2], [13, 5],
  [0, 6], [8, 3], [12, 4],
  [3, 4], [9, 5],
  [1, 2], [6, 7], [15, 2],
];

/** Découpe du motif commun pour une rangée donnée. */
function rowBars(row: number): readonly (readonly [number, number])[] {
  const count = 2 + (row % 2);
  const from = (row * 3) % BAR_PATTERN.length;
  return Array.from({ length: count }, (_, i) => BAR_PATTERN[(from + i) % BAR_PATTERN.length]);
}

export default function PlanningGridSkeleton({
  days,
  dayWidth,
  zoom,
  density,
  anchorDate,
  propertyColWidth,
  totalGridWidth,
  collapsed = false,
}: {
  days: Date[];
  dayWidth: number;
  zoom: ZoomLevel;
  density: DensityMode;
  /** Jour que la grille pose en 3e colonne — le squelette s'ouvre dessus. */
  anchorDate: Date;
  propertyColWidth: number;
  totalGridWidth: number;
  collapsed?: boolean;
}) {
  const { rowHeight, reservationBarHeight, barPadding } = ROW_CONFIG[density];

  // Le defileur s'ouvre sur la MEME fenetre de dates que la grille reelle, qui
  // se recale sur son ancre des qu'elle est peinte. Sans cela, le squelette
  // montrerait le bord gauche du buffer — plusieurs semaines avant — et la
  // grille sauterait lateralement en apparaissant.
  const openAt = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const left = scrollLeftForDateIn(days, anchorDate, dayWidth);
      if (left !== null) el.scrollLeft = left;
    },
    [days, anchorDate, dayWidth],
  );

  // Assez de rangées pour remplir n'importe quelle hauteur d'écran : la carte
  // est en `overflow-hidden`, elle coupe le surplus exactement comme la grille
  // réelle borne le sien au nombre de logements que la page peut tenir.
  const rows = Array.from({ length: 16 }, (_, i) => i);

  return (
    <>
    <Card
      aria-busy
      aria-label="Chargement du planning"
      className="gap-0 py-0 flex-1 min-h-[0px] flex flex-col bg-[var(--bui-card)] overflow-hidden rounded-none ring-0 min-[900px]:rounded-xl min-[900px]:ring-1"
    >
      {/* Memes classes que le defileur de PlanningTimeline. */}
      <div
        ref={openAt}
        className="flex-1 relative overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className="min-w-full flex flex-col min-h-full [&>*]:shrink-0"
          style={{ width: propertyColWidth + totalGridWidth }}
        >
          {/* La rangée des dates est la VRAIE : les jours sont connus avant les
              données, il n'y a donc rien à simuler. */}
          <PlanningDateHeaders
            days={days}
            dayWidth={dayWidth}
            zoom={zoom}
            totalGridWidth={totalGridWidth}
            propertyColWidth={propertyColWidth}
            propertyCount={0}
            collapsed={collapsed}
          />

          <div className="flex relative">
            {/* Colonne logements — mêmes classes que PlanningPropertyColumn :
                collante, fond de carte, filet de séparation borné aux lignes. */}
            <div
              className="sticky start-0 z-[10] shrink-0"
              style={{ width: propertyColWidth, minWidth: propertyColWidth }}
            >
              <div className="relative bg-[var(--bui-card)] border-e border-[var(--bui-border)]">
                {rows.map((row) => (
                  <div
                    key={row}
                    className="relative flex flex-row items-center gap-0 px-0 bg-[var(--bui-card)]"
                    style={{ height: rowHeight, borderBottom: '1px solid var(--bui-border)' }}
                  >
                    {!collapsed && (
                      <div className="flex-1 min-w-0 flex flex-col gap-[0.75px] ps-4 pe-2">
                        {/* Hauteurs calées sur la spec .pl-name : le nom
                            (12.5px / 11.5px compact) puis la ville (10.5px /
                            9.5px), pour que la ligne ne change pas de rythme
                            quand le texte arrive. */}
                        <Skeleton
                          className={cn('w-full', density === 'compact' ? 'h-[11.5px]' : 'h-[12.5px]')}
                          style={{ maxWidth: row % 3 === 0 ? '68%' : row % 3 === 1 ? '84%' : '56%' }}
                        />
                        <Skeleton
                          className={cn('w-full', density === 'compact' ? 'h-[9.5px]' : 'h-[10.5px]')}
                          style={{ maxWidth: row % 2 === 0 ? '44%' : '52%' }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Grille — même conteneur que PlanningTimeline. */}
            <div className="relative shrink-0" style={{ width: totalGridWidth }}>
              {rows.map((row) => (
                <div
                  key={row}
                  className="relative bg-[transparent]"
                  style={{
                    height: rowHeight,
                    width: totalGridWidth,
                    borderBottom: '1px solid var(--bui-border)',
                  }}
                >
                  <PlanningRowBackdrop
                    days={days}
                    dayWidth={dayWidth}
                    totalGridWidth={totalGridWidth}
                  />
                  {rowBars(row)
                    .filter(([start]) => start < days.length)
                    .map(([start, nights], i) => (
                      <Skeleton
                        key={i}
                        className="absolute"
                        style={{
                          left: start * dayWidth,
                          width: Math.min(nights, days.length - start) * dayWidth,
                          top: barPadding,
                          height: reservationBarHeight,
                          borderRadius: BAR_BORDER_RADIUS,
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>

    {/* La barre de pagination, en attente elle aussi.
        Elle vit SOUS la carte, pas dedans : mêmes classes d'écartement que
        dans la grille réelle, même hauteur fixe, même filet haut. Sans elle,
        la carte occupait toute la hauteur puis se faisait raccourcir de 44 px
        à l'arrivée des données — toute la grille remontait d'un cran. */}
    <div className="shrink-0 mt-0 mx-0 min-[900px]:-mx-2 min-[900px]:mt-1.5">
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 bg-[var(--bui-card)]"
        style={{
          height: PAGINATION_BAR_HEIGHT,
          minHeight: PAGINATION_BAR_HEIGHT,
          borderTop: '1px solid var(--bui-border)',
        }}
      >
        {/* « 1-10 sur 24 », à gauche */}
        <Skeleton className="h-3 w-24" />
        {/* « ‹ Précédent · 1 · Suivant › », centré */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <span aria-hidden />
      </div>
    </div>
    </>
  );
}
