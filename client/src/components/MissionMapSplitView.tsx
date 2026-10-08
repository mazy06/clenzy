import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../utils/cn";

/** Shared desktop surface for PMS mission maps and public demonstrations. */
export default function MissionMapSplitView({
  map,
  listTitle,
  listIndicators,
  listResetKey,
  children,
  className,
}: {
  map: ReactNode;
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
        "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,40%)] gap-3 overflow-hidden",
        className,
      )}
    >
      <div className="relative min-h-0 overflow-hidden rounded-xl border border-border bg-card">
        {map}
      </div>
      <section
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
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
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-border"
        >
          {children}
        </div>
      </section>
    </div>
  );
}
