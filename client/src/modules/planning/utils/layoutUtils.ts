import type { PlanningEvent, BarLayout, DensityMode } from '../types';
import { ROW_CONFIG, BAR_MIN_WIDTH, INTERVENTION_LANE_GAP, INTERVENTION_BOTTOM_PAD } from '../constants';
import { toDate, daysBetween, getHourOffsetPx } from './dateUtils';

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

  // Compute left position
  const startOffset = daysBetween(rangeStart, eventStart);
  const clampedStartOffset = Math.max(0, startOffset);
  let left = clampedStartOffset * dayWidth;

  // Add hour offset for zoomed-in views
  if (startOffset >= 0) {
    left += getHourOffsetPx(event.startTime, dayWidth);
  }

  // Compute width
  // In PMS logic, the checkout day is partially occupied (guest leaves in the morning).
  // We add a checkout overlap so the bar visually extends into the checkout day column.
  const durationDays = daysBetween(eventStart, eventEnd);
  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, startOffset + durationDays);
  let width = (visibleEnd - visibleStart) * dayWidth;

  // Checkout overlap: extend bar into the checkout day
  const isReservation = event.type === 'reservation';
  if (isReservation && startOffset + durationDays <= days.length) {
    if (event.endTime && dayWidth > 40) {
      // Use actual checkout time for precise positioning
      width += getHourOffsetPx(event.endTime, dayWidth);
    } else {
      // Default: extend 40% into checkout day (≈ morning occupation until ~10h)
      width += dayWidth * 0.4;
    }
  }

  // Check-in hour offset: shift start for precise positioning
  if (startOffset >= 0 && event.startTime && dayWidth > 40) {
    width -= getHourOffsetPx(event.startTime, dayWidth);
  }

  // Ensure minimum width
  width = Math.max(BAR_MIN_WIDTH, width);

  const isIntervention = event.type === 'cleaning' || event.type === 'maintenance';
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

// ─── Puzzle clip-path generators (extracted from DashboardPlanning) ───────────

const PUZZLE_TAB_DEPTH = 14;
const PUZZLE_NECK_HW = 3;
const PUZZLE_KNOB_HW = 10;
const PUZZLE_OVERLAP = 26;

export function buildMaleClipPath(w: number, h: number): string {
  const d = PUZZLE_TAB_DEPTH;
  const nk = PUZZLE_NECK_HW;
  const kb = PUZZLE_KNOB_HW;
  const cx = w - PUZZLE_OVERLAP / 2;
  const R = 14;

  return `path('M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${w - R} 0 A ${R} ${R} 0 0 1 ${w} ${R} L ${w} ${h} L ${cx + nk} ${h} C ${cx + nk} ${h + 4}, ${cx + kb} ${h + 4}, ${cx + kb} ${h + d * 0.5} C ${cx + kb} ${h + d - 3}, ${cx + 5} ${h + d}, ${cx} ${h + d} C ${cx - 5} ${h + d}, ${cx - kb} ${h + d - 3}, ${cx - kb} ${h + d * 0.5} C ${cx - kb} ${h + 4}, ${cx - nk} ${h + 4}, ${cx - nk} ${h} L ${R} ${h} A ${R} ${R} 0 0 1 0 ${h - R} Z')`;
}

export function buildFemaleClipPath(w: number, h: number): string {
  const d = PUZZLE_TAB_DEPTH;
  const nk = PUZZLE_NECK_HW;
  const kb = PUZZLE_KNOB_HW;
  const cx = PUZZLE_OVERLAP / 2;

  return `path('M 0 0 L ${cx - nk} 0 C ${cx - nk} 4, ${cx - kb} 4, ${cx - kb} ${d * 0.5} C ${cx - kb} ${d - 3}, ${cx - 5} ${d}, ${cx} ${d} C ${cx + 5} ${d}, ${cx + kb} ${d - 3}, ${cx + kb} ${d * 0.5} C ${cx + kb} 4, ${cx + nk} 4, ${cx + nk} 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z')`;
}

export { PUZZLE_OVERLAP };
