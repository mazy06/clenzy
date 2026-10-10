import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from '../../icons/glyphs';
import { Button } from '../ui/button';
import './baitlyDirectory.css';

/** Structure de Prestataires, partagée par les catalogues Baitly. */
export function DirectoryLayout({ filters, filtersLabel, resultsLabel, children }: {
  filters: ReactNode; filtersLabel: string; resultsLabel: string; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return <div className="baitly-directory-layout">
    <aside className="baitly-directory-sidebar" aria-label={filtersLabel}>
      <Button variant="outline" className="mb-2 w-full justify-between lg:hidden"
        aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
        <span className="flex items-center gap-2"><SlidersHorizontal size={16} />{filtersLabel}</span>
        <ChevronDown size={16} className={expanded ? 'rotate-180' : ''} />
      </Button>
      <div id={panelId} className={'baitly-directory-filter-panel ' + (expanded
        ? 'max-h-[60svh] overflow-y-auto overscroll-contain lg:h-full lg:max-h-none'
        : 'hidden overscroll-contain lg:block lg:h-full lg:overflow-y-auto')}>
        <div className="baitly-directory-filter-title"><SlidersHorizontal size={15} /><span>{filtersLabel}</span></div>
        {filters}
      </div>
    </aside>
    <div tabIndex={0} aria-label={resultsLabel}
      className="baitly-directory-main focus-visible:outline-2 focus-visible:outline-primary">{children}</div>
  </div>;
}
