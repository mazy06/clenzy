import type { ReactNode } from 'react';
import { usePageHeaderFilters } from '../../../components/PageHeaderActionsContext';

/** Même emplacement pour les filtres des différents onglets Finance. */
export default function FinanceHeaderFilters({ children }: { children: ReactNode }) {
  const controls = <div className="finance-header-filters">{children}</div>;
  return usePageHeaderFilters(controls, { fallbackWithoutHeader: controls });
}
