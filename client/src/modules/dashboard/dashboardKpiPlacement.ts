interface HorizontalBounds { left: number; right: number }

/** Match the expanded tile, including both 14px concave shoulders, in either reading direction. */
export function dashboardKpiPlacement(anchor: HorizontalBounds, strip: HorizontalBounds, viewportWidth: number, rtl: boolean) {
  const flushLeft = Math.abs(anchor.left - strip.left) < .5 && strip.left >= 1;
  const flushRight = Math.abs(anchor.right - strip.right) < .5 && strip.right <= viewportWidth - 1;
  // At an outside edge, share the strip's border; only interior edges need a shoulder.
  const start = Math.max(anchor.left, strip.left, 0) + (flushLeft ? -1 : 14);
  const end = Math.min(anchor.right, strip.right, viewportWidth) + (flushRight ? 1 : -14);
  const width = Math.max(0, end - start);
  return { width, alignOffset: rtl ? anchor.right - start - width : start - anchor.left, flushLeft, flushRight };
}
