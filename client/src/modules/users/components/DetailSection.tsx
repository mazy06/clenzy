import React, { useId } from 'react';

interface DetailSectionProps {
  title: string;
  description?: string;
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

/** A flat section within the shared Baitly user sheet, never a nested card. */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  description,
  action,
  disableGrid = false,
  children,
}) => {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="grid min-w-0 grid-cols-1 gap-4 border-0 border-t border-solid border-border px-4 py-6 first:border-t-0 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:px-8"
    >
      <div className="min-w-0">
        <h2 id={titleId} className="m-0 text-sm font-semibold leading-6 text-foreground text-balance">
          {title}
        </h2>
        {description && (
          <p className="m-0 mt-1.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-2 flex flex-wrap gap-2" role="status">{action}</div>}
      </div>
      <div className={disableGrid ? 'min-w-0' : 'grid min-w-0 grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2'}>
        {children}
      </div>
    </section>
  );
};

export default DetailSection;
