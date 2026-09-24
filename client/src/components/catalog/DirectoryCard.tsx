import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../utils/cn';

export type CatalogView = 'cards' | 'list';

export function DirectoryResults({ view = 'cards', loading, children }: {
  view?: CatalogView; loading?: boolean; children?: ReactNode;
}) {
  return <div data-view={view} aria-busy={loading || undefined} className={cn('group/directory grid gap-3',
    view === 'cards' ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]' : 'grid-cols-1')}>
    {loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 w-full motion-reduce:animate-none" />) : children}
  </div>;
}

export function DirectoryCard({ children }: { children: ReactNode }) {
  return <Card className="min-w-0 shrink-0 gap-0 overflow-hidden p-0 transition-colors duration-200 hover:border-primary/40 motion-reduce:transition-none">{children}</Card>;
}

export const DIRECTORY_CARD_BODY = 'flex h-full min-w-0 flex-1 flex-col text-start text-foreground group-data-[view=list]/directory:sm:flex-row';

export function DirectoryTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground [&>svg]:size-3">{children}</span>;
}

/** Identité, catégories, informations puis pied : même hiérarchie pour chaque catalogue. */
export function DirectoryCardContent({ media, title, description, trailing, tags, metadata, footerLeading, footerTrailing }: {
  media: ReactNode; title: ReactNode; description?: string; trailing?: ReactNode; tags?: ReactNode;
  metadata?: ReactNode; footerLeading?: ReactNode; footerTrailing: ReactNode;
}) {
  return <>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4">
        {media}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 flex items-center gap-1.5 text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="m-0 mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
        </div>
        {trailing}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 px-4">{tags}</div>
      <div className="mt-3 mb-3 flex flex-col gap-1 px-4 text-xs text-muted-foreground">{metadata}</div>
    </div>
    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5 group-data-[view=list]/directory:sm:mt-0 group-data-[view=list]/directory:sm:w-64 group-data-[view=list]/directory:sm:shrink-0 group-data-[view=list]/directory:sm:border-s group-data-[view=list]/directory:sm:border-t-0">
      <div className="flex flex-wrap items-center gap-1.5">{footerLeading}</div>
      <div className="text-sm font-semibold tabular-nums text-foreground">{footerTrailing}</div>
    </div>
  </>;
}
