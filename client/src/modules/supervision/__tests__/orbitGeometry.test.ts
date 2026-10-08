import { describe, expect, it } from 'vitest';
import { fitOrbitSide, orbitRadiusFor, orbitVerticalLayout, ORBIT_NODE_SIZE, ORBIT_LABEL_ROOM_PX } from '../core/orbitGeometry';

describe('constellation sizing shared by the PMS and landing', () => {
  it.each([
    [240, 320],
    [320, 240],
    [579, 454],
    [720, 480],
    [960, 880],
  ])('fills a %i × %i frame without clipping its visible footprint', (width, height) => {
    const side = fitOrbitSide(width, height);
    const visible = ((2 * orbitRadiusFor(side) + ORBIT_NODE_SIZE) / 100) * side;
    // Ten pixels at each edge, plus the label band below the nodes.
    const available = Math.min(width - 20, height - 20 - ORBIT_LABEL_ROOM_PX);
    expect(visible).toBeLessThanOrEqual(available);
    expect(available - visible).toBeLessThan(0.001);
  });

  it('grows beyond the old landing cap and follows both frame dimensions', () => {
    expect(fitOrbitSide(579, 454)).toBeGreaterThan(460);
    expect(fitOrbitSide(900, 700)).toBeGreaterThan(fitOrbitSide(579, 454));
    expect(fitOrbitSide(320, 700)).toBeLessThan(fitOrbitSide(579, 454));
    expect(fitOrbitSide(900, 240)).toBeLessThan(fitOrbitSide(579, 454));
  });

  it.each([[0, 400], [400, 0], [20, 400], [400, 58]])(
    'uses the initial-render fallback until a %i × %i frame offers enough room',
    (width, height) => expect(fitOrbitSide(width, height)).toBe(0),
  );

  it.each([
    { above: 11, below: 0 }, // Small screen: badge above, no labels below.
    { above: 11, below: 54 }, // Names and statuses on a large screen.
    { above: 62, below: 44 }, // Multi-line translations on both sides.
  ])('centres the visible footprint with $above px above and $below px below', ({ above, below }) => {
    const height = 410;
    const side = fitOrbitSide(900, height, above + below);
    const radius = ((orbitRadiusFor(side) + ORBIT_NODE_SIZE / 2) / 100) * side;
    const top = side / 2 - radius - above;
    const bottom = side / 2 + radius + below;
    const layout = orbitVerticalLayout(side, top, bottom);
    const frameTop = (height - side) / 2 + layout.offset;
    const gapAbove = frameTop + top;
    const gapBelow = height - frameTop - bottom;
    expect(layout.room).toBeCloseTo(above + below);
    expect(gapAbove).toBeCloseTo(gapBelow);
    expect(gapAbove).toBeCloseTo(10, 3);
  });

  it('recovers the unused label band on short screens without changing the landing default', () => {
    const compact = fitOrbitSide(579, 350, 11);
    expect(compact).toBeGreaterThan(fitOrbitSide(579, 350, 58));
    expect(fitOrbitSide(579, 350)).toBe(fitOrbitSide(579, 350, ORBIT_LABEL_ROOM_PX));
  });
});
