import React from 'react';
import { Card, CardContent } from '../../../components/ui';

interface DetailSectionProps {
  /** Overline title — uppercase, short. */
  title: string;
  /** Optional accent color (hex). Drives the icon badge bg. */
  accentColor?: string;
  /** Optional icon for the small badge (kept varied across sections to avoid the
   *  "icon-badge over every heading" template). */
  icon?: React.ReactNode;
  /** Optional inline action slot (e.g. an edit button). */
  action?: React.ReactNode;
  /**
   * When true, children are rendered as-is (caller controls layout — useful for forms
   * that have their own MUI Grid). When false (default), wraps children in a 2-col CSS grid.
   */
  disableGrid?: boolean;
  /** Section content. */
  children: React.ReactNode;
}

/**
 * Card wrapper for one logical section of the user details page.
 *
 * <h4>Design rules respected</h4>
 * <ul>
 *   <li>Impeccable: no side-stripe, carte plate hairline (baseline Signature).</li>
 *   <li>Subtle hover: border tone shift, no transform on width/height.</li>
 *   <li>Reduced-motion respected.</li>
 *   <li>tabular-nums + balance handled by `DetailField`.</li>
 * </ul>
 */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  accentColor,
  icon,
  action,
  disableGrid = false,
  children,
}) => {
  const accent = accentColor ?? '#6B8A9A';

  return (
    <Card
      className="relative overflow-hidden rounded-[var(--radius-lg)] bg-[var(--card)] ring-0 border border-solid border-[var(--line)] p-0 transition-[border-color] duration-200 ease-out hover:border-[var(--line-2)] motion-reduce:transition-none"
    >
      <CardContent className="p-3.5">
        {/* Section header */}
        <div className="flex items-center gap-1.5 mb-3">
          {icon && (
            <div className="w-[24px] h-[24px] rounded-[6px] inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
              {icon}
            </div>
          )}
          <p className="cn-text-body1 text-[10.5px] font-bold tracking-[0.06em] uppercase text-[var(--faint)] flex-1">
            {title}
          </p>
          {action && (
            <div className="inline-flex shrink-0">{action}</div>
          )}
        </div>

        {/* Fields — single column on mobile, 2 cols on >=sm (unless caller opts out) */}
        {disableGrid ? (
          children
        ) : (
          <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[repeat(2,_minmax(0,_1fr))] gap-3">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DetailSection;
