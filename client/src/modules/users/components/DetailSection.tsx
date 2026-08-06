import React from 'react';
import { Card, CardContent } from '../../../components/ui';

interface DetailSectionProps {
  /** Overline title — uppercase, short. */
  title: string;
  /** Optional accent color (hex ou `var(--…)`). Drives the icon badge bg. */
  accentColor?: string;
  /** Optional icon for the small badge (kept varied across sections to avoid the
   *  "icon-badge over every heading" template). */
  icon?: React.ReactNode;
  /** Optional inline action slot (e.g. an edit button). */
  action?: React.ReactNode;
  /**
   * When true, children are rendered as-is (caller controls layout — useful for forms
   * that have their own grid). When false (default), wraps children in a 2-col CSS grid.
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
 *   <li>Impeccable: no side-stripe, carte plate hairline (baseline Baitly UI).</li>
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
  // Teinte calculee a l'execution (prop libre + color-mix) : elle reste une VALEUR
  // CSS, une classe Tailwind construite depuis une variable ne serait jamais emise.
  const accent = accentColor ?? 'var(--bui-primary)';

  return (
    <Card
      className="relative overflow-hidden rounded-lg bg-card ring-0 border border-solid border-border p-0 transition-[border-color] duration-200 ease-out hover:border-primary/30 motion-reduce:transition-none"
    >
      <CardContent className="p-3.5">
        {/* Section header */}
        <div className="flex items-center gap-1.5 mb-3">
          {icon && (
            <div className="size-6 rounded-md inline-flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
              {icon}
            </div>
          )}
          {/* `m-0` : sans preflight Tailwind, un <p> natif reprend les marges UA
              que portait `cn-text-*`. */}
          <p className="m-0 flex-1 text-2xs font-bold tracking-[0.06em] uppercase text-faint">
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
