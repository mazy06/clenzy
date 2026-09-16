import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../components/ui';
import { useMarketplacePresentation } from './useMarketplacePresentation';

/** Un seul panneau de filtres, dans le flux de la page sur toutes les tailles d'écran. */
export default function ProviderDirectoryLayout({ filters, children }: {
  filters: ReactNode; children: ReactNode;
}) {
  const { t } = useMarketplacePresentation();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return <div className="grid shrink-0 grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[16rem_minmax(0,1fr)] lg:overflow-hidden">
    <aside className="min-w-0 lg:min-h-0">
      <Button variant="outline" className="mb-2 w-full justify-between lg:hidden"
        aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
        <span className="flex items-center gap-2"><SlidersHorizontal size={16} />{t('marketplaceAdmin.filters')}</span>
        <ChevronDown size={16} className={expanded ? 'rotate-180' : ''} />
      </Button>
      <div id={panelId} className={expanded
        ? 'max-h-[60svh] overflow-y-auto overscroll-contain lg:h-full lg:max-h-none'
        : 'hidden overscroll-contain lg:block lg:h-full lg:overflow-y-auto'}>
        {filters}
      </div>
    </aside>
    <div tabIndex={0} aria-label={t('marketplaceWorkflow.title')}
      className="min-w-0 focus-visible:outline-2 focus-visible:outline-primary lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">{children}</div>
  </div>;
}
