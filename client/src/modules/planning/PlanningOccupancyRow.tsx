import React from 'react';
import { isWeekend, toDateStr } from './utils/dateUtils';
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
  if (totalPropertyCount <= 0) return days.map(() => 0);
  const reservations = events.filter(
    (event) => event.type === 'reservation' && event.status !== 'cancelled',
  );
  return days.map((day) => {
    const dayStr = toDateStr(day);
    const occupied = new Set<number>();
    for (const event of reservations) {
      if (event.startDate <= dayStr && dayStr < event.endDate) occupied.add(event.propertyId);
    }
    return Math.round((occupied.size / totalPropertyCount) * 100);
  });
}

/** Couleur de la projection : 100 % ok, ≥ 60 % neutre, sinon warn. */
function occupancyColor(pct: number): string {
  if (pct === 100) return 'var(--ok)';
  if (pct >= 60) return 'var(--body)';
  return 'var(--warn)';
}

interface PlanningOccupancyRowProps {
  days: Date[];
  dayWidth: number;
  totalGridWidth: number;
  propertyColWidth: number;
  /** Un pourcentage par jour, aligné sur `days` (cf. computeDayOccupancy). */
  occupancy: number[];
}

const PlanningOccupancyRow: React.FC<PlanningOccupancyRowProps> = React.memo(({
  days,
  dayWidth,
  totalGridWidth,
  propertyColWidth,
  occupancy,
}) => {
  return (
    <div className="flex bg-[var(--surface-2)]" style={{ borderTop: '1px solid var(--line)' }}>
      {/* Coin sticky aligné sur la colonne logements */}
      <div
        className="sticky left-0 z-[11] flex shrink-0 items-center border-r border-solid border-[var(--line)] bg-[var(--surface-2)] px-4 py-1.5"
        style={{ width: propertyColWidth, minWidth: propertyColWidth }}
      >
        <span className="font-bold text-[10.5px] text-[var(--faint)] uppercase tracking-[0.05em] whitespace-nowrap">
          Occupation
        </span>
      </div>

      <div className="flex" style={{ width: totalGridWidth }}>
        {days.map((day, index) => (
          <div
            key={day.getTime()}
            className="flex items-center justify-center py-1.5 border-e border-solid border-e-[var(--line)] last:border-e-0 select-none"
            style={{
              width: dayWidth,
              minWidth: dayWidth,
              backgroundColor: isWeekend(day) ? WEEKEND_HEADER_BG : 'transparent',
            }}
          >
            <span
              className="text-[0.625rem] font-medium tabular-nums leading-none"
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
