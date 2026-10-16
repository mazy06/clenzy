import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

/** Shared desktop surface for PMS mission maps and public demonstrations. */
export default function MissionMapSplitView({
  map,
  listTitle,
  listIndicators,
  listResetKey,
  aside,
  children,
  className,
}: {
  map: ReactNode;
  /** Colonne optionnelle entre la carte et la liste. */
  aside?: ReactNode;
  listTitle: ReactNode;
  listIndicators?: ReactNode;
  listResetKey?: string;
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [listResetKey]);
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 overflow-hidden",
        className,
      )}
      style={{ containerType: 'inline-size', containerName: 'baitly-map' }}
    >
      <div className={cn("baitly-map-split grid min-h-0 w-full flex-1 gap-3 overflow-hidden", aside && "baitly-map-split--aside")}>
      <div className="baitly-map-split__map relative min-h-0 overflow-hidden rounded-xl border border-border bg-card">
        {map}
      </div>
      {aside && <div className="baitly-map-split__aside flex min-h-0 min-w-0">{aside}</div>}
      <section
        className="baitly-map-split__list flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
        aria-label={typeof listTitle === "string" ? listTitle : undefined}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-3 text-sm font-medium tabular-nums">
          <span
            className="min-w-0 flex-1 truncate"
            title={typeof listTitle === "string" ? listTitle : undefined}
          >
            {listTitle}
          </span>
          {listIndicators}
        </div>
        <div
          ref={scrollRef}
          data-map-list-scroll
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-border"
        >
          {children}
        </div>
      </section>
      </div>
    </div>
  );
}
