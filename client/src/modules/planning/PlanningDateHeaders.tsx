import React from 'react';
import { cn } from '../../utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { isToday, isWeekend, formatDayNumber, formatDayShort, formatFullDate } from './utils/dateUtils';
import { DATE_HEADER_HEIGHT, WEEKEND_HEADER_BG } from './constants';
import type { ZoomLevel } from './types';

interface PlanningDateHeadersProps {
  days: Date[];
  dayWidth: number;
  zoom: ZoomLevel;
  totalGridWidth: number;
  propertyColWidth: number;
  propertyCount: number;
}

const PlanningDateHeaders: React.FC<PlanningDateHeadersProps> = React.memo(({
  days,
  dayWidth,
  zoom,
  totalGridWidth,
  propertyColWidth,
  propertyCount,
}) => {
  return (
    <div className="sticky top-0 z-[12] flex bg-[var(--surface-2)]" style={{ borderBottom: '1px solid var(--line)', minHeight: DATE_HEADER_HEIGHT }}>
      {/* Coin « LOGEMENT » (spec .pl-corner) : cellule unique sur toute la
          hauteur de l'entête — overline 10.5px fw700, centrée verticalement
          (la hauteur vient de la rangée, pas de ce padding). */}
      <div
        className="sticky left-0 z-[14] flex shrink-0 items-center border-r border-solid border-[var(--line)] bg-[var(--surface-2)] px-4 py-1"
        style={{ width: propertyColWidth, minWidth: propertyColWidth }}
      >
        <span className="font-bold text-[10.5px] text-[var(--faint)] uppercase tracking-[0.05em] overflow-hidden text-ellipsis whitespace-nowrap tabular-nums">
          {propertyCount} {propertyCount > 1 ? 'logements' : 'logement'}
        </span>
      </div>

      {/* Day row (spec .pl-day : padding 8px 0, hairlines, dernier sans) :
          jour abrégé + numéro (aujourd'hui = carré accent 24×24).
          Le mois/année vit dans la toolbar (sélecteur ‹ Mois Année ›, suivi du
          scroll) — plus de rangée mois dans la grille. Le nom complet
          (jour + numero + mois + annee) reste au hover via Tooltip. */}
      <div className="flex" style={{ height: DATE_HEADER_HEIGHT, width: totalGridWidth }}>
          {days.map((day) => {
            const today = isToday(day);
            const weekend = isWeekend(day);
            return (
              <Tooltip key={day.getTime()} delayDuration={250}>
                {/* Le trigger cible directement la cellule : un <div> natif accepte
                    la ref d'ancrage de Radix, aucun span intermediaire requis. */}
                <TooltipTrigger asChild>
                {/* border-e-[1px_solid_var(--line)] laisse par le codemod ne produisait
                    rien : une largeur de bordure n'accepte pas une valeur raccourcie. */}
                <div className="flex flex-col items-center justify-center gap-px py-1 border-e border-solid border-e-[var(--line)] last:border-e-0 cursor-default select-none" style={{ width: dayWidth, minWidth: dayWidth, backgroundColor: weekend ? WEEKEND_HEADER_BG : 'transparent' }}>
                  {/* Jour abrégé (spec .wd : 9.5px fw700 .04em uppercase) */}
                  {dayWidth >= 34 && (
                    <span className={cn('text-[9.5px] font-bold tracking-[0.04em] uppercase leading-[1]', today ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}>
                      {formatDayShort(day).replace('.', '')}
                    </span>
                  )}
                  {/* Numéro (spec .dn : Space Grotesk 14px fw600) —
                      aujourd'hui dans un carré accent 24×24 radius 8 */}
                  {/* rounded-[8px] et non rounded-lg : l'echelle de rayons du
                      projet redefinit lg a 0.625rem (10px). */}
                  <p
                    className={cn(
                      'cn-text-body1 [font-family:var(--font-display)] text-[14px] font-semibold leading-none tabular-nums',
                      today
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-[8px] bg-[var(--accent)] text-[var(--on-accent)]'
                        // Spec .dn : var(--body), week-end inclus
                        : 'text-[var(--body)]',
                    )}
                  >
                    {formatDayNumber(day)}
                  </p>
                </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="capitalize text-[0.6875rem]">
                  {formatFullDate(day)}
                </TooltipContent>
              </Tooltip>
            );
          })}
      </div>
    </div>
  );
});

PlanningDateHeaders.displayName = 'PlanningDateHeaders';
export default PlanningDateHeaders;
