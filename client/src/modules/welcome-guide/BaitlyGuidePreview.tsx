import type { ReactNode } from 'react';
import './baitlyGuidePreview.css';

/** One phone and one sticky position for the guide studio and the editing wizard. */
export function BaitlyGuidePreview({ children, label, phoneClassName = '' }: {
  children: ReactNode;
  label: string;
  phoneClassName?: string;
}) {
  return <aside className="baitly-guide-preview" aria-label={label}>
    <div className={`baitly-guide-preview__phone ${phoneClassName}`.trim()}>{children}</div>
  </aside>;
}
