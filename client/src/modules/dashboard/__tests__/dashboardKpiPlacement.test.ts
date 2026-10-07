import { describe, expect, it } from 'vitest';
import { dashboardKpiPlacement } from '../dashboardKpiPlacement';

describe('KPI drawer placement', () => {
  const strip = { left: 136, right: 1390 };
  it('aligns outside drawers with the strip border and keeps only the interior shoulder', () => {
    const first = dashboardKpiPlacement({ left: 136, right: 534 }, strip, 1440, false);
    const last = dashboardKpiPlacement({ left: 992, right: 1390 }, strip, 1440, false);
    expect(first).toEqual({ width: 385, alignOffset: -1, flushLeft: true, flushRight: false });
    expect(last).toEqual({ width: 385, alignOffset: 14, flushLeft: false, flushRight: true });
    expect(136 + first.alignOffset).toBe(strip.left - 1);
    expect(992 + last.alignOffset + last.width).toBe(strip.right + 1);
  });
  it('centres middle drawers under their KPI', () => {
    const tile = { left: 554, right: 763 };
    const result = dashboardKpiPlacement(tile, strip, 1440, false);
    expect(tile.left + result.alignOffset + result.width / 2).toBe((tile.left + tile.right) / 2);
  });
  it('fits a vertically stacked mobile KPI without horizontal scrolling', () => {
    const bounds = { left: 21, right: 354 };
    const result = dashboardKpiPlacement(bounds, bounds, 375, false);
    expect(result).toEqual({ width: 335, alignOffset: -1, flushLeft: true, flushRight: true });
  });
  it('uses logical alignment offsets to reach the same position in RTL', () => {
    const tile = { left: 1181, right: 1390 };
    const ltr = dashboardKpiPlacement(tile, strip, 1440, false);
    const rtl = dashboardKpiPlacement(tile, strip, 1440, true);
    expect(tile.right - rtl.width - rtl.alignOffset).toBe(tile.left + ltr.alignOffset);
  });
  it('also constrains a partially clipped strip to the viewport', () => {
    const tile = { left: 0, right: 400 };
    const result = dashboardKpiPlacement(tile, { left: -80, right: 480 }, 320, false);
    expect(result).toEqual({ width: 292, alignOffset: 14, flushLeft: false, flushRight: false });
  });
  it('keeps the drawer attached to an already wide tile instead of capping its body at 370px', () => {
    const tile = { left: 200, right: 750 };
    const result = dashboardKpiPlacement(tile, strip, 1440, false);
    expect(result).toEqual({ width: 522, alignOffset: 14, flushLeft: false, flushRight: false });
    expect(result.width + 28).toBe(tile.right - tile.left);
  });
});
