import React from 'react';
import { WEEKEND_CELL_BG } from './constants';
import { isWeekend, isToday } from './utils/dateUtils';

/**
 * Le FOND d'une rangée de la grille : colonnes teintées et filets entre jours.
 *
 * <p>Extrait de {@link ./PlanningRow} pour que le squelette de chargement
 * dessine EXACTEMENT la même grille — même teinte de week-end, même colonne du
 * jour, mêmes séparateurs au pixel. Deux copies auraient divergé à la première
 * retouche, et un squelette qui ne ressemble pas à ce qu'il annonce est pire
 * qu'un disque qui tourne : il promet une mise en page, puis en livre une
 * autre.</p>
 *
 * <p>À poser dans un parent `position: relative` de la largeur de la grille.</p>
 */
const PlanningRowBackdrop: React.FC<{
  days: Date[];
  dayWidth: number;
  totalGridWidth: number;
}> = React.memo(({ days, dayWidth, totalGridWidth }) => (
  <>
    {/* Day column backgrounds (weekends + today) */}
    {days.map((day, idx) => {
      const weekend = isWeekend(day);
      const today = isToday(day);
      if (!weekend && !today) return null;
      // `inset-y-0` et non `height: effectiveRowHeight` : en box-sizing
      // border-box cette hauteur inclut le filet du bas de la ligne, que le
      // fond recouvrait — les cellules week-end et celle du jour perdaient
      // leur bordure horizontale. Un absolu se cale sur le padding box, donc
      // s'arrête juste avant le filet.
      return (
        <div
          className="absolute inset-y-0 pointer-events-none"
          style={{
            left: idx * dayWidth,
            width: dayWidth,
            backgroundColor: today
              ? 'color-mix(in srgb, var(--accent) 6%, transparent)'
              : weekend
                ? WEEKEND_CELL_BG
                : 'transparent',
          }}
          key={day.getTime()}
        />
      );
    })}

    {/* Hairlines verticales entre jours — couche AU-DESSUS des fonds
        week-end/today (posés juste avant) pour que les séparateurs restent
        visibles sur les colonnes teintées. Clip 1px avant le bord droit
        (dernier jour sans séparateur). pointer-events:none → n'intercepte
        pas les clics ; sous les briques (rendues après dans le DOM). */}
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${dayWidth - 1}px, var(--bui-border) ${dayWidth - 1}px ${dayWidth}px)`,
        backgroundSize: `${totalGridWidth - 1}px 100%`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  </>
));

PlanningRowBackdrop.displayName = 'PlanningRowBackdrop';

export default PlanningRowBackdrop;
