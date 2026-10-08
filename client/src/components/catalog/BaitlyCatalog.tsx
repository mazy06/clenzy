import type { ReactNode } from 'react';
import { LayoutGrid, List } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { DirectoryLayout } from './DirectoryLayout';
import { DirectoryToolbar, DirectorySegments, DirectorySegment } from './DirectoryToolbar';
import { DirectoryCard, DirectoryCardContent, DirectoryTag, DIRECTORY_CARD_BODY, type CatalogView } from './DirectoryCard';

export { DirectoryFilterGroup as CatalogFilterGroup, DirectoryFilter as CatalogFilter } from './DirectoryFilters';
export { DirectoryResults as CatalogResults, type CatalogView } from './DirectoryCard';

/** Les marketplaces composent les mêmes primitives que l'annuaire Prestataires. */
export function BaitlyCatalog({ filters, title, count, view, onViewChange, toolbar, summary, children }: {
  filters: ReactNode; title: string; count: number; view: CatalogView;
  onViewChange: (view: CatalogView) => void; toolbar?: ReactNode;
  summary?: ReactNode; children: ReactNode;
}) {
  const { t } = useTranslation();
  return <>
    <DirectoryToolbar>
      <DirectorySegments label={t('baitlyCatalog.display')}>
        {([{ value: 'cards', icon: LayoutGrid }, { value: 'list', icon: List }] as const).map(({ value, icon: Icon }) =>
          <DirectorySegment key={value} active={view === value} onClick={() => onViewChange(value)}>
            <Icon size={14} />{t(`baitlyCatalog.${value}`)}
          </DirectorySegment>)}
      </DirectorySegments>
      {toolbar}
      {summary}
      <span className="ms-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">{title} · {count}</span>
    </DirectoryToolbar>
    <DirectoryLayout filters={<div className="px-1 pb-2">{filters}</div>}
      filtersLabel={t('baitlyCatalog.filters')} resultsLabel={title}>
      {children}
    </DirectoryLayout>
  </>;
}

/** Les actions restent hors du bouton d'ouverture de la fiche. */
export function CatalogCard({ title, source, media, description, trailing, badges, metadata, children, price, priceNote, action, onOpen }: {
  title: string; source: ReactNode; media: ReactNode; description?: string; trailing?: ReactNode;
  badges?: ReactNode; metadata?: ReactNode; children?: ReactNode;
  price: ReactNode; priceNote?: ReactNode; action: ReactNode; onOpen?: () => void;
}) {
  return <DirectoryCard>
    <div className={DIRECTORY_CARD_BODY}>
      <DirectoryCardContent
        media={<div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-primary-soft text-primary [&>img]:size-full [&>img]:object-cover">{media}</div>}
        title={onOpen ? <button type="button" onClick={onOpen}
          className="min-w-0 cursor-pointer rounded-sm text-start outline-none hover:underline hover:underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring/50">
          <span dir="auto" className="line-clamp-2">{title}</span>
        </button> : <span dir="auto" className="line-clamp-2">{title}</span>}
        description={description} trailing={trailing}
        tags={<><DirectoryTag>{source}</DirectoryTag>{badges}</>}
        metadata={<>{metadata && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">{metadata}</div>}{children}</>}
        footerLeading={action}
        footerTrailing={<>
          <div className="flex flex-wrap items-baseline gap-1">{price}</div>
          {priceNote && <div className="mt-0.5 text-xs font-normal text-muted-foreground">{priceNote}</div>}
        </>}
      />
    </div>
  </DirectoryCard>;
}
