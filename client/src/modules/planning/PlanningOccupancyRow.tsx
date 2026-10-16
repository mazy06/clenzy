import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { toDateStr } from './utils/dateUtils';
import { useDateFormat } from '../../hooks/useDateFormat';
import { WEEKEND_HEADER_BG } from './constants';
import type { PlanningEvent } from './types';

// ─── Rangée « Occupation » (projection Planning) ─────────────────────────────
//
// Pied de grille repris de BPlanningSectionDemo : un pourcentage d'occupation
// par jour sous les lignes de logements, coloré comme la projection (complet =
// ok, ≥ 60 % = neutre, en dessous = warn). Calculé par la page sur TOUTES les
// propriétés filtrées et les événements AVANT filtre de légende : masquer un
// canal dans la légende change l'affichage des briques, pas l'occupation
// réelle du portefeuille. Seules les réservations comptent : un blocage
// propriétaire rend le jour indisponible, pas occupé.

/**
 * Pourcentage d'occupation par jour : propriétés distinctes couvertes par une
 * réservation non annulée (checkIn ≤ jour < checkOut — le jour du départ est
 * libre, convention planning), rapportées au total filtré.
 */
export function computeDayOccupancy(
  days: Date[],
  events: PlanningEvent[],
  totalPropertyCount: number,
): number[] {
  return computeDayOccupiedCounts(days, events).map((count) => totalPropertyCount > 0 ? Math.round(count / totalPropertyCount * 100) : 0);
}

/** Comptage exact : ne pas reconstruire le nombre à partir d'un pourcentage arrondi. */
export function computeDayOccupiedCounts(days: Date[], events: PlanningEvent[]): number[] {
  const orderedDays = days.map((day, index) => ({ date: toDateStr(day), index }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const lowerBound = (date: string) => {
    let low = 0, high = orderedDays.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (orderedDays[middle].date < date) low = middle + 1; else high = middle;
    }
    return low;
  };
  const intervals = new Map<number, { start: string; end: string }[]>();
  for (const event of events) {
    if (event.type !== 'reservation' || event.status === 'cancelled' || event.startDate >= event.endDate) continue;
    const list = intervals.get(event.propertyId) ?? [];
    list.push({ start: event.startDate, end: event.endDate });
    intervals.set(event.propertyId, list);
  }
  const differences = new Int32Array(days.length + 1);
  for (const list of intervals.values()) {
    list.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
    let range: { start: string; end: string } | undefined;
    const addRange = () => {
      if (!range) return;
      differences[lowerBound(range.start)]++;
      differences[lowerBound(range.end)]--;
    };
    for (const stay of list) {
      if (range && stay.start <= range.end) {
        if (stay.end > range.end) range.end = stay.end;
      } else {
        addRange();
        range = { ...stay };
      }
    }
    addRange();
  }
  const counts = new Array<number>(days.length);
  let count = 0;
  orderedDays.forEach((day, i) => { count += differences[i]; counts[day.index] = count; });
  return counts;
}

/** Couleur de la projection : 100 % ok, ≥ 60 % neutre, sinon warn. */
function occupancyColor(pct: number): string {
  if (pct === 100) return 'var(--bui-success-ink)';
  if (pct >= 60) return 'var(--body)';
  return 'var(--bui-warning-ink)';
}

interface PlanningOccupancyRowProps {
  days: Date[];
  dayWidth: number;
  totalGridWidth: number;
  propertyColWidth: number;
  /** Un pourcentage par jour, aligné sur `days` (cf. computeDayOccupancy). */
  occupancy: number[];
  occupiedCounts?: number[];
  totalPropertyCount?: number;
  /** Colonne logements repliée en rail (mobile) : le libellé n'y tient plus. */
  collapsed?: boolean;
}

const PlanningOccupancyRow: React.FC<PlanningOccupancyRowProps> = React.memo(({
  days,
  dayWidth,
  totalGridWidth,
  propertyColWidth,
  occupancy,
  occupiedCounts,
  totalPropertyCount,
  collapsed = false,
}) => {
  const { t } = useTranslation();
  // Vendredi-samedi en arabe, samedi-dimanche ailleurs.
  const { isWeekend } = useDateFormat();

  return (
    // La marge automatique ancre la synthèse en bas de la grille Baitly.
    <div className="mt-auto flex bg-[var(--pl-surface-2)]" style={{ borderTop: '1px solid var(--bui-border)' }}>
      {/* Coin sticky aligné sur la colonne logements */}
      <div
        className={cn(
          'sticky start-0 z-[11] flex shrink-0 items-center overflow-hidden border-e border-solid border-[var(--bui-border)] bg-[var(--pl-surface-2)] py-1.5',
          collapsed ? 'px-0' : 'px-4',
        )}
        style={{ width: propertyColWidth, minWidth: propertyColWidth }}
      >
        {/* Repliée, la cellule fait 28 px : le libellé (nowrap, sans clipping)
            débordait sur la grille et se superposait aux pourcentages. */}
        {!collapsed && (
          <span className="font-bold text-xs text-[var(--bui-muted-foreground)] uppercase tracking-[0.05em] whitespace-nowrap">
            <span title={t('planning.grid.occupancyScope', 'Tous les logements filtrés, toutes les pages et tous les canaux.')}>{t('planning.grid.occupancy', 'Occupation')}</span>
          </span>
        )}
      </div>

      <div className="flex" style={{ width: totalGridWidth }}>
        {days.map((day, index) => (
          <div
            key={day.getTime()}
            role="img"
            aria-label={occupiedCounts && totalPropertyCount != null ? t('planning.grid.occupiedCount', { count: occupiedCounts[index] ?? 0, total: totalPropertyCount, defaultValue: '{{count}} logements occupés sur {{total}}' }) : `${occupancy[index] ?? 0}%`}
            title={occupiedCounts && totalPropertyCount != null ? t('planning.grid.occupiedCount', { count: occupiedCounts[index] ?? 0, total: totalPropertyCount, defaultValue: '{{count}} logements occupés sur {{total}}' }) : undefined}
            className="flex items-center justify-center py-1.5 border-e border-solid border-e-[var(--bui-border)] last:border-e-0 select-none"
            style={{
              width: dayWidth,
              minWidth: dayWidth,
              backgroundColor: isWeekend(day) ? WEEKEND_HEADER_BG : 'transparent',
            }}
          >
            <span
              className="text-xs font-medium tabular-nums leading-none"
              style={{ color: occupancyColor(occupancy[index] ?? 0) }}
            >
              {occupancy[index] ?? 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

PlanningOccupancyRow.displayName = 'PlanningOccupancyRow';
export default PlanningOccupancyRow;
