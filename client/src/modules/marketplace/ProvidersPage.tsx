import { lazy, Suspense } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { Skeleton } from '../../components/ui';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';

const Catalog = lazy(() => import('../provider-catalog/ProviderCatalogPage'));
const Management = lazy(() => import('./MarketplaceProvidersPage'));

/** Une entrée, deux capacités. Seul le parcours autorisé monte ses hooks et ses API. */
export default function ProvidersPage() {
  const { hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  const canManage = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const catalogContext = params.has('replaceQuoteId') || params.has('propertyId');
  const mode = canManage && !catalogContext && params.get('view') !== 'catalog' ? 'management' : 'catalog';
  return <PageHeaderActionsProvider slot={slot}>
    <PageHeader title={t('marketplaceWorkflow.title')}
      subtitle={t(mode === 'management' ? 'marketplaceAdmin.subtitle' : 'marketplaceWorkflow.subtitle')}
      actions={portalContainer} />
    {canManage && <PageTabs value={mode} options={[
      { value: 'management', label: t('providerDirectory.management') },
      { value: 'catalog', label: t('providerDirectory.catalog') },
    ]} onChange={next => {
      const updated = new URLSearchParams(params);
      updated.set('view', next);
      if (next === 'management') { updated.delete('replaceQuoteId'); updated.delete('propertyId'); }
      setParams(updated);
    }} />}
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      {mode === 'management' ? <Management /> : <Catalog />}
    </Suspense>
  </PageHeaderActionsProvider>;
}

export function LegacyProvidersRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/prestataires', search: location.search, hash: location.hash }} replace />;
}
