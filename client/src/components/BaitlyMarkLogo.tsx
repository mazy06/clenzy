import React, { useId } from 'react';
import { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH, FLOW_STROKE_WIDTH, FLOW_LENGTH, FLOW_END, FLOW_LEG_MS, WORDMARK_SIZE_RATIO, WORDMARK_GAP_RATIO, WORDMARK_OFFSET_RATIO } from './baitlyLogoGeometry';
export { MARK_PATH, MARK_VIEWBOX, STROKE_WIDTH } from './baitlyLogoGeometry';

export interface BaitlyMarkLogoProps {
  scale?: number;
  size?: number | string;
  variant?: 'full' | 'mark' | 'wordmark';
  tone?: 'auto' | 'light' | 'dark';
  /** Conservé pour les consommateurs existants. */
  active?: boolean;
  idleAnimation?: boolean;
  disableAnimation?: boolean;
  colorMode?: 'accent' | 'inherit';
}

/** Logo approuvé : symbole et baitly., flux monochrome uniquement en animation. */
export default function BaitlyMarkLogo({ scale = 1, size, variant = 'full', tone = 'auto', idleAnimation = true, disableAnimation = false, colorMode = 'accent' }: BaitlyMarkLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '-');
  const iconSize = size ?? 56 * scale;
  const proportionalSize = (ratio: number) => typeof iconSize === 'number'
    ? iconSize * ratio
    : `calc(${iconSize} * ${ratio})`;
  const wordmarkOffset = proportionalSize(WORDMARK_OFFSET_RATIO);
  const animated = idleAnimation && !disableAnimation;
  const cls = `baitly-logo-${uid}-${animated ? 'animated' : 'static'}`;
  const color = colorMode === 'inherit' ? 'inherit' : tone === 'dark' ? '#FFFFFF' : tone === 'light' ? '#1B2A35' : undefined;
  return (
    <div className={cls} role="img" aria-label="Baitly" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, direction: 'ltr', gap: variant === 'full' ? proportionalSize(WORDMARK_GAP_RATIO) : 0, color }}>
      <style>{`
        .${cls} { color: #1B2A35; }
        [data-theme="dark"] .${cls} { color: #FFFFFF; }
        .${cls} .baitly-logo-base { opacity: ${animated ? '.42' : '1'}; }
        .${cls} .baitly-logo-flow { animation: ${cls}-flow ${FLOW_LEG_MS}ms cubic-bezier(.37,0,.63,1) infinite alternate; }
        @keyframes ${cls}-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: ${FLOW_END}; } }
        @media (prefers-reduced-motion: reduce) {
          .${cls} .baitly-logo-flow { display: none; animation: none; }
          .${cls} .baitly-logo-base { opacity: 1; }
        }
      `}</style>
      {variant !== 'wordmark' && (
        <svg width={typeof iconSize === 'number' ? iconSize : undefined} height={typeof iconSize === 'number' ? iconSize : undefined} viewBox={MARK_VIEWBOX} fill="none" aria-hidden="true" style={{ flexShrink: 0, width: iconSize, height: iconSize }}>
          <path className="baitly-logo-base" d={MARK_PATH} stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
          {animated && <path className="baitly-logo-flow" d={MARK_PATH} pathLength={100} stroke="currentColor" strokeWidth={FLOW_STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${FLOW_LENGTH} 400`} />}
        </svg>
      )}
      {variant !== 'mark' && <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: proportionalSize(WORDMARK_SIZE_RATIO), letterSpacing: '-.025em', lineHeight: 1, whiteSpace: 'nowrap', transform: `translateY(${typeof wordmarkOffset === 'number' ? `${wordmarkOffset}px` : wordmarkOffset})` }}>baitly.</span>}
    </div>
  );
}
