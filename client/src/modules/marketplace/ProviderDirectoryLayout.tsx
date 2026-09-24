import type { ReactNode } from 'react';
import { DirectoryLayout } from '../../components/catalog/DirectoryLayout';
import { useMarketplacePresentation } from './useMarketplacePresentation';

export default function ProviderDirectoryLayout({ filters, children }: {
  filters: ReactNode; children: ReactNode;
}) {
  const { t } = useMarketplacePresentation();
  return <DirectoryLayout filters={filters} filtersLabel={t('marketplaceAdmin.filters')}
    resultsLabel={t('marketplaceWorkflow.title')}>{children}</DirectoryLayout>;
}
