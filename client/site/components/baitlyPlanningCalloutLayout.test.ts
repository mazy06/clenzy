import { describe, expect, it } from 'vitest';
import {
  placePlanningCallout,
  type CalloutRect,
} from './baitlyPlanningCalloutLayout';

const intersects = (a: CalloutRect, b: CalloutRect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

describe('planning caption placement', () => {
  it('keeps edge captions inside the planning without covering the action', () => {
    for (const target of [
      { x: 8, y: 80, width: 120, height: 28 },
      { x: 820, y: 24, width: 170, height: 40 },
      { x: 350, y: 530, width: 320, height: 35 },
    ]) {
      const card = placePlanningCallout(
        { width: 1000, height: 600 },
        target,
        { width: 268, height: 170 },
        [],
      );
      expect(card.x).toBeGreaterThanOrEqual(12);
      expect(card.x + card.width).toBeLessThanOrEqual(988);
      expect(card.y).toBeGreaterThanOrEqual(12);
      expect(card.y + card.height).toBeLessThanOrEqual(588);
      expect(intersects(card, target)).toBe(false);
    }
  });

  it('moves the caption away from an open guest panel', () => {
    const target = { x: 490, y: 160, width: 200, height: 35 };
    const panel = { x: 480, y: 215, width: 270, height: 290 };
    const card = placePlanningCallout(
      { width: 1000, height: 600 },
      target,
      { width: 268, height: 170 },
      [panel],
    );
    expect(intersects(card, target)).toBe(false);
    expect(intersects(card, panel)).toBe(false);
  });

  it('docks below a narrow calendar to keep the action readable', () => {
    const card = placePlanningCallout(
      { width: 327, height: 790 },
      { x: 15, y: 100, width: 292, height: 430 },
      { width: 268, height: 180 },
      [],
      585,
    );
    expect(card.x).toBe(29.5);
    expect(card.y).toBe(585);
    expect(card.y + card.height).toBeLessThan(790);
  });
});
