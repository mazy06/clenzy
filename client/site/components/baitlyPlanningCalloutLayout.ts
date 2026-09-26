export interface CalloutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

/** Keep the caption clear of the action and any open product panels. */
export function placePlanningCallout(
  bounds: { width: number; height: number },
  target: CalloutRect,
  card: { width: number; height: number },
  obstacles: CalloutRect[],
  dockY?: number,
) {
  const margin = 12;
  const gap = 24;
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const candidates =
    dockY !== undefined
      ? [{ x: (bounds.width - card.width) / 2, y: dockY }]
      : [
          { x: target.x + target.width + gap, y: cy - card.height / 2 },
          { x: target.x - card.width - gap, y: cy - card.height / 2 },
          { x: cx - card.width / 2, y: target.y + target.height + gap },
          { x: cx - card.width / 2, y: target.y - card.height - gap },
          { x: margin, y: bounds.height - card.height - margin },
          {
            x: bounds.width - card.width - margin,
            y: bounds.height - card.height - margin,
          },
          { x: margin, y: margin },
          { x: bounds.width - card.width - margin, y: margin },
        ];
  const overlap = (a: CalloutRect, b: CalloutRect) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const positions = candidates.map((candidate) => {
    const rect = {
      ...card,
      x: clamp(candidate.x, margin, bounds.width - card.width - margin),
      y: clamp(candidate.y, margin, bounds.height - card.height - margin),
    };
    const distance = Math.hypot(
      rect.x + card.width / 2 - cx,
      rect.y + card.height / 2 - cy,
    );
    const score =
      overlap(rect, target) * 100 +
      obstacles.reduce(
        (sum, obstacle) => sum + overlap(rect, obstacle) * 20,
        0,
      ) +
      distance;
    return { ...rect, score };
  });
  positions.sort((a, b) => a.score - b.score);
  const position = positions[0];
  const horizontal =
    Math.abs(position.x + card.width / 2 - cx) >
    Math.abs(position.y + card.height / 2 - cy);
  const toRight = position.x + card.width / 2 > cx;
  const below = position.y + card.height / 2 > cy;
  const from = horizontal
    ? { x: target.x + (toRight ? target.width : 0), y: cy }
    : { x: cx, y: target.y + (below ? target.height : 0) };
  const to = horizontal
    ? {
        x: position.x + (toRight ? 0 : card.width),
        y: clamp(cy, position.y + 18, position.y + card.height - 18),
      }
    : {
        x: clamp(cx, position.x + 18, position.x + card.width - 18),
        y: position.y + (below ? 0 : card.height),
      };
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const path = horizontal
    ? `M${from.x},${from.y} C${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`
    : `M${from.x},${from.y} C${from.x},${my} ${to.x},${my} ${to.x},${to.y}`;
  return { ...position, from, path };
}
