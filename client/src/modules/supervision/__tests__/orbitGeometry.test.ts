import { describe, expect, it } from 'vitest';
import { fitOrbitSide, orbitRadiusFor, ORBIT_NODE_SIZE, ORBIT_LABEL_ROOM_PX } from '../core/orbitGeometry';

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
});
