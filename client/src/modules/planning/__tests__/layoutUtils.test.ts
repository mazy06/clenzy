import { describe, it, expect } from 'vitest';
import { computeBarLayout, computePropertyBarLayouts } from '../utils/layoutUtils';
import type { PlanningEvent, DensityMode } from '../types';
import { generateDays } from '../utils/dateUtils';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const days = generateDays(new Date(2026, 2, 1), new Date(2026, 2, 14)); // Mar 1-14
const dayWidth = 80;
const density: DensityMode = 'normal';

function makeEvent(overrides: Partial<PlanningEvent> = {}): PlanningEvent {
  return {
    id: 'res-1',
    type: 'reservation',
    propertyId: 1,
    startDate: '2026-03-03',
    endDate: '2026-03-07',
    label: 'Guest',
    status: 'confirmed',
    color: '#4A9B8E',
    ...overrides,
  };
}

// ─── computeBarLayout ────────────────────────────────────────────────────────

describe('computeBarLayout', () => {
  it('returns null for empty days array', () => {
    expect(computeBarLayout(makeEvent(), [], dayWidth, density)).toBeNull();
  });

  it('returns null for event completely outside visible range', () => {
    const event = makeEvent({ startDate: '2026-04-01', endDate: '2026-04-05' });
    expect(computeBarLayout(event, days, dayWidth, density)).toBeNull();
  });

  it('returns layout for event within range', () => {
    const event = makeEvent({ startDate: '2026-03-03', endDate: '2026-03-07' });
    const layout = computeBarLayout(event, days, dayWidth, density);
    expect(layout).not.toBeNull();
    expect(layout!.left).toBeGreaterThan(0);
    expect(layout!.width).toBeGreaterThan(0);
  });

  it('computes correct left position', () => {
    // Event starts March 3, visible starts March 1 → 2 day offset
    const event = makeEvent({ startDate: '2026-03-03', endDate: '2026-03-07' });
    const layout = computeBarLayout(event, days, dayWidth, density);
    expect(layout!.left).toBe(2 * dayWidth); // no hour offset at 80px width
  });

  it('computes correct width for 4-night stay', () => {
    // March 3 to March 7 = 4 days + checkout overlap
    const event = makeEvent({ startDate: '2026-03-03', endDate: '2026-03-07' });
    const layout = computeBarLayout(event, days, dayWidth, density);
    // 4 days * 80px + 40% checkout overlap = 320 + 32 = 352
    expect(layout!.width).toBe(4 * dayWidth + dayWidth * 0.4);
  });

  it('clamps start to 0 for event starting before visible range', () => {
    const event = makeEvent({ startDate: '2026-02-25', endDate: '2026-03-05' });
    const layout = computeBarLayout(event, days, dayWidth, density);
    expect(layout!.left).toBe(0);
  });

  it('marks interventions as secondary layer', () => {
    const event = makeEvent({ id: 'int-1', type: 'cleaning', startDate: '2026-03-05', endDate: '2026-03-05' });
    const layout = computeBarLayout(event, days, dayWidth, density);
    expect(layout!.layer).toBe('secondary');
  });

  it('marks reservations as primary layer', () => {
    const layout = computeBarLayout(makeEvent(), days, dayWidth, density);
    expect(layout!.layer).toBe('primary');
  });

  it('enforces minimum width', () => {
    // Single day event at narrow width
    const event = makeEvent({ startDate: '2026-03-05', endDate: '2026-03-05' });
    const layout = computeBarLayout(event, days, 10, density);
    expect(layout!.width).toBeGreaterThanOrEqual(28); // BAR_MIN_WIDTH
  });
});

// ─── computePropertyBarLayouts ───────────────────────────────────────────────

describe('computePropertyBarLayouts', () => {
  it('returns layouts for all visible events', () => {
    const events = [
      makeEvent({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeEvent({ id: 'res-2', startDate: '2026-03-07', endDate: '2026-03-10' }),
    ];
    const layouts = computePropertyBarLayouts(events, days, dayWidth, density);
    expect(layouts).toHaveLength(2);
  });

  it('filters out events outside visible range', () => {
    const events = [
      makeEvent({ id: 'res-1', startDate: '2026-03-01', endDate: '2026-03-05' }),
      makeEvent({ id: 'res-2', startDate: '2026-04-01', endDate: '2026-04-05' }),
    ];
    const layouts = computePropertyBarLayouts(events, days, dayWidth, density);
    expect(layouts).toHaveLength(1);
  });

  it('stacks overlapping interventions into lanes', () => {
    const events: PlanningEvent[] = [
      makeEvent({ id: 'int-1', type: 'cleaning', startDate: '2026-03-05', endDate: '2026-03-05' }),
      makeEvent({ id: 'int-2', type: 'maintenance', startDate: '2026-03-05', endDate: '2026-03-05' }),
    ];
    const layouts = computePropertyBarLayouts(events, days, dayWidth, density);
    const intLayouts = layouts.filter(l => l.layer === 'secondary');
    expect(intLayouts).toHaveLength(2);
    // They should have different top positions (stacked)
    expect(intLayouts[0].top).not.toBe(intLayouts[1].top);
  });

  it('does not stack non-overlapping interventions', () => {
    const events: PlanningEvent[] = [
      makeEvent({ id: 'int-1', type: 'cleaning', startDate: '2026-03-03', endDate: '2026-03-03' }),
      makeEvent({ id: 'int-2', type: 'cleaning', startDate: '2026-03-10', endDate: '2026-03-10' }),
    ];
    const layouts = computePropertyBarLayouts(events, days, dayWidth, density);
    const intLayouts = layouts.filter(l => l.layer === 'secondary');
    expect(intLayouts).toHaveLength(2);
    // Same top since they don't overlap
    expect(intLayouts[0].top).toBe(intLayouts[1].top);
  });
});
