import React from 'react';
import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  type Locale,
} from 'date-fns';
import { cn } from '../../utils/cn';

/**
 * Des PLAGES posees sur des mois — pas un selecteur de dates.
 *
 * <p>Le composant `Calendar` du kit est fait pour SAISIR : ses cellules ont la
 * taille d'un bouton, sa legende celle d'un titre, et chaque jour retenu y
 * devient une pastille isolee. Trois creneaux de vingt nuits y ressemblaient a
 * soixante pastilles, sur deux mois qui debordaient de leur cadre.</p>
 *
 * <p>Ici une plage est une BANDE : les cellules se touchent, l'arrondi ne tombe
 * qu'aux extremites — celles de la plage, et celles de la semaine, sinon la
 * bande se terminerait carre au milieu d'une ligne. Chaque plage porte sa
 * propre teinte, prise aux jetons de serie du theme, et la meme teinte revient
 * dans la liste en dessous : c'est ce qui permet de rattacher « −7 % » a
 * l'endroit du calendrier qui le porte.</p>
 *
 * <p>Purement decoratif, et assume comme tel : `aria-hidden`, hors du parcours
 * clavier. Ce qu'il montre est dit en toutes lettres par la liste qui
 * l'accompagne, et c'est elle qu'une synthese vocale lira.</p>
 */

export interface CalendarRange {
  from: Date;
  /** Borne EXCLUSIVE — la convention des parametres d'action. */
  toExclusive: Date;
  /** Couleur de la plage (jeton de serie), teintee a l'affichage. */
  color: string;
}

/** Nombre maximum de mois rendus — au-dela, la liste suffit a lire le plan. */
const MAX_MONTHS = 4;

/** Fond d'une bande : la teinte du theme pour une couleur arbitraire. */
function bandBackground(color: string) {
  return `color-mix(in srgb, ${color} var(--bui-tint-bg, 14%), transparent)`;
}

/** Encre d'une bande, lisible sur son propre fond en clair comme en sombre. */
function bandInk(color: string) {
  return `color-mix(in srgb, ${color} var(--bui-tint-text, 82%), var(--bui-ink))`;
}

/** Plage couvrant ce jour, ou `null`. */
function rangeAt(ranges: CalendarRange[], day: Date): CalendarRange | null {
  return ranges.find((range) => day >= range.from && day < range.toExclusive) ?? null;
}

function Month({
  month,
  ranges,
  locale,
  today,
}: {
  month: Date;
  ranges: CalendarRange[];
  locale: Locale;
  today: Date;
}) {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first, { locale });
  const last = endOfMonth(month);

  // Semaines entieres, de la premiere a celle qui contient le dernier jour.
  const cells: Date[] = [];
  for (let day = gridStart; day <= last || cells.length % 7 !== 0; day = addDays(day, 1)) {
    cells.push(day);
    if (cells.length > 42) break; // garde-fou : six semaines couvrent tout mois
  }

  const weekdays = Array.from({ length: 7 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="w-[196px] shrink-0">
      <p className="m-0 mb-2 truncate text-xs font-semibold text-foreground first-letter:uppercase">
        {format(first, 'MMMM yyyy', { locale })}
      </p>

      <div className="grid grid-cols-7">
        {weekdays.map((day) => (
          <span
            key={day.toISOString()}
            className="flex h-5 items-center justify-center text-2xs font-medium text-muted-foreground"
          >
            {format(day, 'EEEEEE', { locale })}
          </span>
        ))}
      </div>

      <div className="mt-0.5 grid grid-cols-7 gap-y-0.5">
        {cells.map((day, index) => {
          if (!isSameMonth(day, first)) return <span key={day.toISOString()} className="h-7" />;

          const range = rangeAt(ranges, day);
          // L'arrondi tombe aux extremites de la PLAGE et a celles de la
          // SEMAINE : une bande qui se termine carre au milieu d'une ligne se
          // lirait comme coupee.
          const opensBand = range
            ? isSameDay(day, range.from) || index % 7 === 0
            : false;
          const closesBand = range
            ? isSameDay(addDays(day, 1), range.toExclusive) || index % 7 === 6
            : false;

          return (
            <span
              key={day.toISOString()}
              className={cn(
                'flex h-7 items-center justify-center text-xs tabular-nums',
                range ? 'font-semibold' : 'text-muted-foreground',
                opensBand && 'rounded-s-md',
                closesBand && 'rounded-e-md',
                !range && isSameDay(day, today) && 'font-semibold text-foreground underline underline-offset-4',
              )}
              style={range
                ? { backgroundColor: bandBackground(range.color), color: bandInk(range.color) }
                : undefined}
            >
              {format(day, 'd')}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function RangeCalendar({
  ranges,
  locale,
  className,
}: {
  ranges: CalendarRange[];
  locale: Locale;
  className?: string;
}) {
  const today = React.useMemo(() => new Date(), []);

  const months = React.useMemo(() => {
    if (ranges.length === 0) return [];
    const first = startOfMonth(ranges.reduce((min, r) => (r.from < min ? r.from : min), ranges[0].from));
    const lastNight = ranges.reduce((max, r) => {
      const end = addDays(r.toExclusive, -1);
      return end > max ? end : max;
    }, addDays(ranges[0].toExclusive, -1));
    const count = Math.min(MAX_MONTHS, differenceInCalendarMonths(startOfMonth(lastNight), first) + 1);
    return Array.from({ length: Math.max(1, count) }, (_, index) => addMonths(first, index));
  }, [ranges]);

  if (months.length === 0) return null;

  return (
    <div aria-hidden="true" className={cn('flex flex-wrap gap-x-6 gap-y-4', className)}>
      {months.map((month) => (
        <Month
          key={month.toISOString()}
          month={month}
          ranges={ranges}
          locale={locale}
          today={today}
        />
      ))}
    </div>
  );
}
