import type { PlanningEvent, BarLayout, DensityMode } from '../types';
import {
  ROW_CONFIG,
  BAR_MIN_WIDTH,
  BAR_MIN_DAY_FRACTION,
  DEFAULT_CHECK_IN_HOUR,
  DEFAULT_CHECK_OUT_HOUR,
  INTERVENTION_LANE_GAP,
  INTERVENTION_BOTTOM_PAD,
} from '../constants';
import { toDate, daysBetween, getHourOffsetPx } from './dateUtils';

/** Fraction de jour (0..1) d'une heure "HH:mm", avec heure de repli. */
function timeFractionOfDay(timeStr: string | undefined, fallbackHour: number): number {
  if (!timeStr) return fallbackHour / 24;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  if (Number.isNaN(h)) return fallbackHour / 24;
  const m = parseInt(parts[1] || '0', 10);
  return (h + (Number.isNaN(m) ? 0 : m) / 60) / 24;
}

// Largeur minimum d'une intervention pour afficher le label de type en
// entier (MENAGE / MAINTENANCE en uppercase bold ~8-9px + padding).
// Calcul approximatif : nbChars * 7.4px + 16px padding.
const INTERVENTION_TYPE_MIN_WIDTH: Record<string, number> = {
  cleaning: 64,     // "MÉNAGE" (6 chars) + padding
  maintenance: 104, // "MAINTENANCE" (11 chars) + padding
};

/**
 * Compute the pixel position and size of a bar within a row.
 */
export function computeBarLayout(
  event: PlanningEvent,
  days: Date[],
  dayWidth: number,
  density: DensityMode,
): BarLayout | null {
  if (days.length === 0) return null;

  const config = ROW_CONFIG[density];
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];
  const eventStart = toDate(event.startDate);
  const eventEnd = toDate(event.endDate);

  // Skip events completely outside the visible range
  if (eventEnd < rangeStart || eventStart > rangeEnd) return null;

  const startOffset = daysBetween(rangeStart, eventStart);
  const durationDays = daysBetween(eventStart, eventEnd);
  const isReservation = event.type === 'reservation';
  const isIntervention = event.type === 'cleaning' || event.type === 'maintenance';

  let left: number;
  let width: number;

  if (isReservation) {
    // ── Brique positionnée à l'heure (spec JS placeBar) ─────────────────────
    //   left  = (startDayIndex + checkInHour/24)  × dayWidth
    //   right = (startDayIndex + nuits + checkOutHour/24) × dayWidth
    //   width = max(3.5 % de la grille 14 jours ≈ 0.49 jour, right − left)
    // Heures de repli 15 h / 11 h quand la réservation n'en porte pas.
    // Seul le RENDU est décalé à l'heure : drag & resize restent snappés au
    // jour (Math.round(deltaX / dayWidth) dans usePlanningDrag), le ghost
    // repasse par ce calcul et reste donc cohérent.
    const checkInFrac = timeFractionOfDay(event.startTime, DEFAULT_CHECK_IN_HOUR);
    const checkOutFrac = timeFractionOfDay(event.endTime, DEFAULT_CHECK_OUT_HOUR);
    const leftDays = Math.max(0, startOffset + checkInFrac);
    const rightDays = Math.min(days.length, startOffset + durationDays + checkOutFrac);
    left = leftDays * dayWidth;
    width = Math.max(
      BAR_MIN_WIDTH,
      BAR_MIN_DAY_FRACTION * dayWidth,
      (rightDays - leftDays) * dayWidth,
    );
  } else {
    // ── Interventions / blocages : positionnement au jour (inchangé) ────────
    const clampedStartOffset = Math.max(0, startOffset);
    left = clampedStartOffset * dayWidth;
    if (startOffset >= 0) {
      left += getHourOffsetPx(event.startTime, dayWidth);
    }
    const visibleStart = Math.max(0, startOffset);
    const visibleEnd = Math.min(days.length, startOffset + durationDays);
    width = (visibleEnd - visibleStart) * dayWidth;

    // Interventions : occuper AU MINIMUM la largeur necessaire pour afficher
    // le type de prestation en entier (MENAGE / MAINTENANCE). Sans ca, le bar
    // tombe a BAR_MIN_WIDTH (28px) et le texte est tronque. On ne va PAS
    // jusqu'a une cellule jour complete pour ne pas masquer le voisin.
    if (isIntervention) {
      const minTypeWidth = INTERVENTION_TYPE_MIN_WIDTH[event.type] ?? 64;
      if (width < minTypeWidth) {
        width = minTypeWidth;
      }
    }

    width = Math.max(BAR_MIN_WIDTH, width);
  }

  const layer = isIntervention ? 'secondary' as const : 'primary' as const;

  return {
    event,
    left,
    width,
    top: isIntervention ? config.interventionTop : config.barPadding,
    height: isIntervention ? config.interventionBarHeight : config.reservationBarHeight,
    layer,
  };
}

// ─── Intervention lane stacking ─────────────────────────────────────────────

/** Check if two horizontal intervals overlap */
function horizontalOverlap(
  aLeft: number, aWidth: number,
  bLeft: number, bWidth: number,
): boolean {
  return aLeft < bLeft + bWidth && aLeft + aWidth > bLeft;
}

/**
 * Build connected-component overlap groups.
 * Two interventions in the same group means they overlap (directly or transitively).
 * Returns an array of groups, each group being an array of indices into the input.
 */
function buildOverlapGroups(layouts: BarLayout[]): number[][] {
  const n = layouts.length;
  // Union-Find
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (horizontalOverlap(layouts[i].left, layouts[i].width, layouts[j].left, layouts[j].width)) {
        union(i, j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  return Array.from(groups.values());
}

/**
 * Compute bar layouts for all events of a property.
 * Overlapping interventions are stacked in lanes.
 * Sort: by start position (left) first, then cleaning before maintenance for ties.
 * Non-overlapping interventions keep their full height.
 */
export function computePropertyBarLayouts(
  events: PlanningEvent[],
  days: Date[],
  dayWidth: number,
  density: DensityMode,
): BarLayout[] {
  const layouts: BarLayout[] = [];

  for (const event of events) {
    const layout = computeBarLayout(event, days, dayWidth, density);
    if (layout) {
      layouts.push(layout);
    }
  }

  // ── Post-process: stack only truly overlapping interventions ────────────
  const interventionLayouts = layouts.filter((l) => l.layer === 'secondary');

  if (interventionLayouts.length > 1) {
    const config = ROW_CONFIG[density];
    const groups = buildOverlapGroups(interventionLayouts);

    for (const group of groups) {
      // Groups of 1 → no stacking needed, keep default top/height
      if (group.length <= 1) continue;

      // Sort group members: by left (start time) first, cleaning before maintenance for ties
      const sorted = [...group].sort((a, b) => {
        const diff = interventionLayouts[a].left - interventionLayouts[b].left;
        if (Math.abs(diff) > 0.5) return diff;
        // Tie-break: cleaning (0) before maintenance (1)
        const typeA = interventionLayouts[a].event.type === 'cleaning' ? 0 : 1;
        const typeB = interventionLayouts[b].event.type === 'cleaning' ? 0 : 1;
        return typeA - typeB;
      });

      const maxLanes = sorted.length;
      const availableHeight = config.rowHeight - config.interventionTop - INTERVENTION_BOTTOM_PAD;
      const heightPerLane = availableHeight / maxLanes;
      const gap = INTERVENTION_LANE_GAP;
      const effectiveHeight = Math.max(8, heightPerLane - gap);

      // Assign each member a lane (simple sequential since they all overlap)
      sorted.forEach((idx, lane) => {
        interventionLayouts[idx].top = config.interventionTop + lane * heightPerLane;
        interventionLayouts[idx].height = effectiveHeight;
      });
    }
  }

  return layouts;
}

