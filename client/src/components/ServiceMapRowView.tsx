import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "../icons/glyphs";

/** The real PMS row, with data and translated labels supplied by its caller. */
export default function ServiceMapRowView({
  title,
  serviceLabel,
  propertyName,
  propertyAddress,
  propertyCity,
  propertyThumb,
  assigneeLabel,
  assigneeAvatars,
  assigneeName,
  extraMemberCount,
  schedule,
  badges,
  children,
  actions,
  to,
  onSelect,
  selected,
  demoIndex,
}: {
  title: string;
  serviceLabel: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity?: string;
  propertyThumb: ReactNode;
  assigneeLabel: string;
  assigneeAvatars: ReactNode;
  assigneeName: string;
  extraMemberCount?: number;
  schedule: ReactNode;
  badges: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  to?: string;
  onSelect?: () => void;
  selected?: boolean;
  demoIndex?: number;
}) {
  const className =
    "group block w-full min-w-0 cursor-pointer p-4 text-start text-foreground no-underline transition-colors duration-150 motion-reduce:transition-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2";
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold leading-snug">{title}</span>
        <ChevronRight
          className="cn-rtl-flip size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </div>
      <span className="mt-1 block text-xs text-muted-foreground">
        {serviceLabel}
      </span>
      <div className="my-3 grid grid-cols-[minmax(0,1fr)_minmax(90px,34%)] gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {propertyThumb}
          <div className="min-w-0">
            <span dir="auto" className="block truncate text-sm font-medium">
              {propertyName}
            </span>
            <span
              className="mt-0.5 block truncate text-xs text-muted-foreground"
              title={propertyAddress}
            >
              {propertyAddress}
            </span>
            {propertyCity && (
              <span className="block text-xs text-muted-foreground">
                {propertyCity}
              </span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-start gap-1.5 border-s border-border ps-3">
          <span className="text-xs text-muted-foreground">{assigneeLabel}</span>
          <div className="flex -space-x-2">{assigneeAvatars}</div>
          <span className="text-xs font-medium">{assigneeName}</span>
          {!!extraMemberCount && (
            <span className="text-xs text-muted-foreground tabular-nums">
              +{extraMemberCount}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        {schedule}
        <div className="flex flex-wrap gap-1 [&>span]:rounded-md [&>span]:border [&>span]:border-border [&>span]:text-xs">
          {badges}
        </div>
      </div>
      {children}
    </>
  );
  return (
    <article>
      {to ? (
        <Link to={to} className={className}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={className}
          aria-pressed={selected}
          data-demo-mission={demoIndex}
          onClick={onSelect}
        >
          {content}
        </button>
      )}
      {actions && <div className="px-4 pb-4">{actions}</div>}
    </article>
  );
}
