import type { CSSProperties } from 'react';

/** Shared Baitly transmission, in the orbit's 100-unit SVG coordinate system. */
export const FLOW_CYCLE_MS = 3200;
export const FLOW_TRAVEL_FRACTION = 0.38;
export const FLOW_DASH = 4.5;
export const FLOW_STROKE = 0.32;

/** Negative delay keeps both legs on the same clock, including after a remount. */
export function flowClockDelay(phaseOffsetMs = 0): string {
  const phase = ((performance.now() - phaseOffsetMs) % FLOW_CYCLE_MS + FLOW_CYCLE_MS) % FLOW_CYCLE_MS;
  return `-${Math.round(phase)}ms`;
}

/** Real SVG lengths avoid Chromium's pathLength / non-scaling-stroke mismatch. */
export function flowPacketStyle(length: number, dash: number, delay: string): CSSProperties {
  return {
    '--bui-flow-dash': dash,
    // Longer than the entire trip, even when a card sits very close to its agent.
    '--bui-flow-gap': 2 * (length + dash),
    '--bui-flow-end': -(length + dash),
    animationDelay: delay,
  } as CSSProperties;
}

/** One animation for both legs. Only their start phase and SVG units differ. */
export const DATA_FLOW_STYLES = `
.baitly-data-packet {
  fill: none;
  stroke-linecap: round;
  opacity: .85;
  stroke-dasharray: var(--bui-flow-dash) var(--bui-flow-gap);
  animation: baitly-data-transmission ${FLOW_CYCLE_MS}ms linear infinite;
}
@keyframes baitly-data-transmission {
  0% { stroke-dashoffset: var(--bui-flow-dash); }
  ${FLOW_TRAVEL_FRACTION * 100}%, 100% { stroke-dashoffset: var(--bui-flow-end); }
}
@media (prefers-reduced-motion: reduce) {
  .baitly-data-packet { display: none !important; }
}
`;
