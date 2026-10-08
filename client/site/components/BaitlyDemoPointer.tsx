import type { CSSProperties } from 'react';
import { createIcon } from '../../src/icons/createIcon';

// One closed silhouette keeps the palm opaque; finger creases are stroke-only.
const BaitlyPointerHand = createIcon('BaitlyPointerHand', {
  outline: {
    body:
      '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path fill="#f5f8f8" d="M6 14V4a2 2 0 0 1 4 0v5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15Z"/>' +
      '<path d="M10 9v3M14 10v3M18 11v3"/></g>',
  },
});

/** Visual cue only: the demo's state machine performs the illustrated action. */
export default function BaitlyDemoPointer({
  show,
  duration = 3200,
  sequence,
}: {
  show: boolean;
  duration?: number;
  sequence: string;
}) {
  if (!show) return null;
  return (
    <span
      key={sequence}
      className="bb-demo-pointer"
      aria-hidden="true"
      data-demo-pointer="true"
      style={{ '--bb-pointer-duration': `${duration}ms` } as CSSProperties}
    >
      <span className="bb-pointer-ripple" />
      <span className="bb-pointer-hand">
        <BaitlyPointerHand />
      </span>
    </span>
  );
}
