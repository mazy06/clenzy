import type { ReactNode } from 'react';
import { usePageHeaderFilters } from '../../../components/PageHeaderActionsContext';
import { useTranslation } from '../../../hooks/useTranslation';

/** Filtres et nombre exact de résultats dans le header partagé des trois vues. */
export default function DocumentsHeaderControls({ count, children }: { count: number; children: ReactNode }) {
  const { t } = useTranslation();
  return usePageHeaderFilters(<div className="documents-header-controls">
    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap" aria-live="polite">
      {t('documentsWorkspace.count', { count })}
    </span>
    {children}
  </div>);
}
