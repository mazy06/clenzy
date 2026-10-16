import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../utils/cn';
import './baitlyDirectory.css';

export type CatalogView = 'cards' | 'list';

export function DirectoryResults({ view = 'cards', loading, children }: {
  view?: CatalogView; loading?: boolean; children?: ReactNode;
}) {
  return <div data-view={view} aria-busy={loading || undefined} className={cn('group/directory baitly-directory-results',
    view === 'list' && 'baitly-directory-results--list')}>
    {loading ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 w-full motion-reduce:animate-none" />) : children}
  </div>;
}

export function DirectoryCard({ children }: { children: ReactNode }) {
  return <Card className="baitly-directory-card min-w-0 shrink-0 gap-0 overflow-hidden p-0">{children}</Card>;
}

export const DIRECTORY_CARD_BODY = 'baitly-directory-card__body text-start text-foreground';

export function DirectoryTag({ children }: { children: ReactNode }) {
  return <span className="baitly-directory-tag inline-flex items-center gap-1 [&>svg]:size-3">{children}</span>;
}

/** Identité, catégories, informations puis pied : même hiérarchie pour chaque catalogue. */
export function DirectoryCardContent({ media, title, description, trailing, tags, metadata, footerLeading, footerTrailing, metadataPlacement = 'content' }: {
  media: ReactNode; title: ReactNode; description?: string; trailing?: ReactNode; tags?: ReactNode;
  metadata?: ReactNode; footerLeading?: ReactNode; footerTrailing: ReactNode;
  metadataPlacement?: 'content' | 'full';
}) {
  return <>
    <div className="baitly-directory-card__media">{media}</div>
    <div className="baitly-directory-card__content">
      <div className="baitly-directory-card__heading">
        <h3>{title}</h3>
        {trailing && <div className="baitly-directory-card__trailing">{trailing}</div>}
      </div>
      {description && <p className="baitly-directory-card__description">{description}</p>}
      {tags && <div className="baitly-directory-card__tags">{tags}</div>}
      {metadata && metadataPlacement === 'content' && <div className="baitly-directory-card__metadata">{metadata}</div>}
    </div>
    {metadata && metadataPlacement === 'full' && <div className="baitly-provider-metadata">{metadata}</div>}
    <div className="baitly-directory-card__footer">
      <div className="baitly-directory-card__actions">{footerLeading}</div>
      <div className="baitly-directory-card__price">{footerTrailing}</div>
    </div>
  </>;
}
