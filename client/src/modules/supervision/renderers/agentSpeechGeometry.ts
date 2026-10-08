export type SpeechPoint = { x: number; y: number };
export type SpeechTailSide = 'left' | 'right' | 'top' | 'bottom';

/** Morph a notification into a rounded speech balloon with one continuous tail.
 * Physical coordinates come from the DOM, so RTL and collision flips use the same geometry. */
export function agentSpeechOutline(width: number, height: number, anchor: SpeechPoint, progress = 1, badgeRadius = 12, badgeWidth = badgeRadius * 2, tailSide?: SpeechTailSide): string {
  const p = Math.max(0, Math.min(1, progress));
  const mix = (from: number, to: number) => from + (to - from) * p;
  const w = mix(badgeWidth, Math.max(2, width - 2));
  const h = mix(badgeRadius * 2, Math.max(2, height - 2));
  const cx = mix(anchor.x, width / 2);
  const cy = mix(anchor.y, height / 2);
  const r = Math.min(w / 2, h / 2, mix(badgeRadius, 26));
  const x = cx - w / 2;
  const y = cy - h / 2;
  const side = tailSide ?? (anchor.x < 0 ? 'left' : anchor.x > width ? 'right' : anchor.y < 0 ? 'top' : 'bottom');
  const normals = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
  const normal = normals[side];
  const tip = { x: anchor.x + (1 - p) * badgeWidth / 2 * normal.x, y: anchor.y + (1 - p) * badgeRadius * normal.y };
  const xy = (v: SpeechPoint) => `${v.x.toFixed(2)} ${v.y.toFixed(2)}`;
  const edge = (name: keyof typeof normals, end: SpeechPoint) => {
    if (name !== side) return `L ${xy(end)}`;
    const vertical = side === 'left' || side === 'right';
    const size = vertical ? h : w;
    const start = vertical ? y : x;
    const source = vertical ? tip.y : tip.x;
    const half = Math.min(14 * p, Math.max(0, (size - 2 * r) / 2));
    // A comic tail sweeps sideways from a broad base to the badge. Keep the
    // tip fixed and bend the base inward when the bubble meets a screen edge.
    const sweep = vertical ? 0 : (source > start + size * .6 ? -1 : 1) * 36 * p;
    const centre = Math.max(start + r + half, Math.min(source + sweep, start + size - r - half));
    const direction = side === 'left' || side === 'bottom' ? -1 : 1;
    const fixed = side === 'left' ? x : side === 'right' ? x + w : side === 'top' ? y : y + h;
    const point = (v: number) => vertical ? { x: fixed, y: v } : { x: v, y: fixed };
    const a = point(centre - half * direction);
    const b = point(centre + half * direction);
    const reach = Math.abs(vertical ? tip.x - fixed : tip.y - fixed);
    const c1 = { x: a.x + (tip.x - a.x) * .35 + normal.x * reach * .3, y: a.y + (tip.y - a.y) * .35 + normal.y * reach * .3 };
    const c2 = { x: b.x + normal.x * reach * .65, y: b.y + normal.y * reach * .65 };
    return `L ${xy(a)} Q ${xy(c1)} ${xy(tip)} Q ${xy(c2)} ${xy(b)} L ${xy(end)}`;
  };
  const arc = (end: SpeechPoint) => `A ${r} ${r} 0 0 1 ${xy(end)}`;
  return [
    `M ${xy({ x: x + r, y })}`,
    edge('top', { x: x + w - r, y }), arc({ x: x + w, y: y + r }),
    edge('right', { x: x + w, y: y + h - r }), arc({ x: x + w - r, y: y + h }),
    edge('bottom', { x: x + r, y: y + h }), arc({ x, y: y + h - r }),
    edge('left', { x, y: y + r }), arc({ x: x + r, y }), 'Z',
  ].join(' ');
}

export const AGENT_SPEECH_MORPH_MS = 300;
